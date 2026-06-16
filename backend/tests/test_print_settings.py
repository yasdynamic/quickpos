"""Print settings + PWA manifest tests (iteration 6)."""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def baseline_print():
    """Save baseline print settings; restore after."""
    r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
    assert r.status_code == 200
    baseline = r.json().get("print") or {}
    yield baseline
    # restore
    requests.put(f"{BASE_URL}/api/settings", json={"print": baseline}, timeout=15)


# --- GET defaults --------------------------------------------------------
def test_get_settings_print_defaults():
    r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "print" in data, "missing 'print' object in /api/settings"
    p = data["print"]
    # core keys requested by review request
    for key in ("auto_print_z", "paper_width_mm", "shop_name", "footer_line"):
        assert key in p, f"missing print.{key}"


def test_get_settings_has_auto_print_receipt_and_drawer():
    """Review requires keys auto_print_receipt and open_drawer_on_cash to be returned."""
    r = requests.get(f"{BASE_URL}/api/settings", timeout=15)
    p = r.json().get("print", {})
    assert "auto_print_receipt" in p, "GET /api/settings.print missing auto_print_receipt"
    assert "open_drawer_on_cash" in p, "GET /api/settings.print missing open_drawer_on_cash"


# --- PUT persistence ----------------------------------------------------
def test_put_settings_persists_receipt_and_drawer(baseline_print):
    payload = {
        "print": {
            "auto_print_z": True,
            "auto_print_receipt": True,
            "open_drawer_on_cash": True,
            "paper_width_mm": 80,
            "shop_name": "TEST_Shop",
            "footer_line": "TEST_Footer",
        }
    }
    r = requests.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)
    assert r.status_code == 200
    saved = r.json().get("print", {})
    assert saved.get("auto_print_receipt") is True, \
        "PUT did not persist auto_print_receipt"
    assert saved.get("open_drawer_on_cash") is True, \
        "PUT did not persist open_drawer_on_cash"
    # Re-GET to confirm DB persistence
    r2 = requests.get(f"{BASE_URL}/api/settings", timeout=15)
    p2 = r2.json().get("print", {})
    assert p2.get("auto_print_receipt") is True
    assert p2.get("open_drawer_on_cash") is True
    assert p2.get("shop_name") == "TEST_Shop"
    assert p2.get("footer_line") == "TEST_Footer"


def test_put_settings_paper_width_58(baseline_print):
    payload = {"print": {"paper_width_mm": 58, "auto_print_z": True,
                         "shop_name": "TEST_58", "footer_line": "x"}}
    r = requests.put(f"{BASE_URL}/api/settings", json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json()["print"]["paper_width_mm"] == 58
    r2 = requests.get(f"{BASE_URL}/api/settings", timeout=15)
    assert r2.json()["print"]["paper_width_mm"] == 58


# --- Manifest.json -------------------------------------------------------
def test_manifest_served_at_root():
    r = requests.get(f"{BASE_URL}/manifest.json", timeout=15)
    assert r.status_code == 200, f"manifest.json not served (got {r.status_code})"
    # Must be JSON-ish (PWA)
    assert "name" in r.text or "short_name" in r.text


# --- Regression: login + session + order + cash payment -----------------
class TestPaymentRegressionNoPrinter:
    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": "000000"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_full_cash_payment_flow(self):
        # Ensure session: close any existing then open fresh
        cur = requests.get(f"{BASE_URL}/api/cash-sessions/current", timeout=15).json()
        if cur:
            requests.post(
                f"{BASE_URL}/api/cash-sessions/{cur['id']}/close",
                json={"closing_cash_declared": 0.0},
                timeout=30,
            )
        r = requests.post(
            f"{BASE_URL}/api/cash-sessions/open",
            json={"opening_cash": 50.0},
            timeout=15,
        )
        assert r.status_code == 200
        session_id = r.json()["id"]

        # Pick a free table
        tables = requests.get(f"{BASE_URL}/api/tables", timeout=15).json()
        free = next((t for t in tables if t.get("status") == "free"), None)
        assert free, "No free table available"

        # Create order
        r = requests.post(
            f"{BASE_URL}/api/orders",
            json={"table_id": free["id"], "covers": 1},
            timeout=15,
        )
        assert r.status_code == 200
        order_id = r.json()["id"]

        # Add a product
        prods = requests.get(f"{BASE_URL}/api/products", timeout=15).json()
        assert prods, "no products seeded"
        prod = prods[0]
        r = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/items",
            json={"product_id": prod["id"], "quantity": 1},
            timeout=15,
        )
        assert r.status_code == 200

        # Pay cash (no printer connected - backend should succeed regardless)
        r = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/pay",
            json={"payment_method": "cash", "amount_received": 10.0},
            timeout=15,
        )
        assert r.status_code == 200, f"cash payment failed: {r.text}"
        assert r.json()["order"]["status"] == "paid"

        # Cleanup: close session
        r = requests.post(
            f"{BASE_URL}/api/cash-sessions/{session_id}/close",
            json={"closing_cash_declared": 50.0 + prod["price"]},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["session"]["status"] == "closed"
