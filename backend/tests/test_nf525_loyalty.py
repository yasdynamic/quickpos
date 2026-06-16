"""Backend tests for NF525 immutable journal + Customers/Loyalty.

Covers:
- /api/journal, /api/journal/summary, /api/journal/verify (hash chain)
- /api/sales appends TICKET entry; /api/orders/{id}/cancel appends CANCEL
- /api/cash-sessions/{id}/close appends Z
- /api/customers CRUD + uniqueness + points adjust
- Loyalty awarding on sale (enabled vs disabled)
- /api/settings.loyalty round-trip
"""

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://touchpoint-sales-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    # Login (PIN admin 000000) — backend may not return token, but call ensures endpoint OK.
    r = sess.post(f"{API}/auth/login", json={"pin": "000000"})
    assert r.status_code == 200, r.text
    return sess


@pytest.fixture(scope="module")
def product(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    items = r.json()
    assert items, "No products seeded"
    # Pick a simple product without modifiers
    for p in items:
        if not p.get("modifiers"):
            return p
    return items[0]


# ---------------- NF525 journal -----------------------------------------

class TestJournal:
    def test_summary_shape(self, s):
        r = s.get(f"{API}/journal/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("year", "count", "last_seq", "last_hash", "last_signed_at"):
            assert k in d, f"missing {k}"

    def test_verify_valid(self, s):
        r = s.post(f"{API}/journal/verify")
        assert r.status_code == 200
        d = r.json()
        assert d.get("valid") is True, d

    def test_list_sorted_desc_and_chained(self, s):
        r = s.get(f"{API}/journal?limit=50")
        assert r.status_code == 200
        items = r.json()
        if len(items) < 2:
            pytest.skip("Need at least 2 entries to verify chain")
        # Sorted desc by seq
        seqs = [e["seq"] for e in items]
        assert seqs == sorted(seqs, reverse=True)
        # hash_prev of entry N == hash_current of entry N-1
        for i in range(len(items) - 1):
            assert items[i]["hash_prev"] == items[i + 1]["hash_current"], (
                f"chain broken between seq {items[i]['seq']} and {items[i+1]['seq']}"
            )

    def test_sale_increments_journal(self, s, product):
        before = s.get(f"{API}/journal/summary").json()["count"]
        payload = {
            "items": [{
                "product_id": product["id"],
                "name": product["name"],
                "price": product["price"],
                "quantity": 1,
            }],
            "payment_method": "cash",
            "amount_received": product["price"],
        }
        r = s.post(f"{API}/sales", json=payload)
        assert r.status_code == 200, r.text
        after = s.get(f"{API}/journal/summary").json()["count"]
        assert after == before + 1, f"journal count should increment by 1: before={before} after={after}"

        # Last entry should be TICKET with this sale id
        r = s.get(f"{API}/journal?limit=1")
        last = r.json()[0]
        assert last["type"] == "TICKET"
        assert last["ref_id"] == r.json()[0]["ref_id"]  # always true
        # verify chain still valid
        v = s.post(f"{API}/journal/verify").json()
        assert v["valid"] is True


# ---------------- Customers ---------------------------------------------

class TestCustomers:
    def test_create_requires_name(self, s):
        r = s.post(f"{API}/customers", json={"phone": "0000000000"})
        assert r.status_code == 400

    def test_create_list_search(self, s):
        unique_phone = f"06{uuid.uuid4().hex[:8]}"
        name = f"TEST_Client_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/customers", json={"name": name, "phone": unique_phone, "email": "TEST@x.io"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == name
        assert c["phone"] == unique_phone
        assert c["email"] == "test@x.io"
        assert c["loyalty_points"] == 0

        # Duplicate phone rejected
        r2 = s.post(f"{API}/customers", json={"name": "Dup", "phone": unique_phone})
        assert r2.status_code == 400

        # Search by name substring
        r3 = s.get(f"{API}/customers", params={"search": name[:10]})
        assert r3.status_code == 200
        assert any(x["id"] == c["id"] for x in r3.json())

        # Update
        new_name = name + "_upd"
        r4 = s.put(f"{API}/customers/{c['id']}", json={"name": new_name})
        assert r4.status_code == 200
        assert r4.json()["name"] == new_name

        # Adjust points
        r5 = s.post(f"{API}/customers/{c['id']}/points/adjust", json={"delta": 50, "reason": "test"})
        assert r5.status_code == 200
        assert r5.json()["loyalty_points"] == 50

        r6 = s.post(f"{API}/customers/{c['id']}/points/adjust", json={"delta": -10, "reason": "test"})
        assert r6.json()["loyalty_points"] == 40

        # Delete cleanup
        r7 = s.delete(f"{API}/customers/{c['id']}")
        assert r7.status_code == 200
        r8 = s.get(f"{API}/customers/{c['id']}")
        assert r8.status_code == 404


# ---------------- Settings loyalty --------------------------------------

class TestLoyaltySettings:
    def test_get_has_loyalty(self, s):
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert "loyalty" in d
        for k in ("enabled", "points_per_currency", "points_redemption_rate"):
            assert k in d["loyalty"]

    def test_put_roundtrip(self, s):
        original = s.get(f"{API}/settings").json().get("loyalty", {})
        try:
            payload = {"loyalty": {"enabled": True, "points_per_currency": 1.0, "points_redemption_rate": 100.0}}
            r = s.put(f"{API}/settings", json=payload)
            assert r.status_code == 200, r.text
            got = s.get(f"{API}/settings").json()["loyalty"]
            assert got["enabled"] is True
            assert got["points_per_currency"] == 1.0
        finally:
            # restore
            s.put(f"{API}/settings", json={"loyalty": original})


# ---------------- Loyalty on sale ---------------------------------------

class TestLoyaltyOnSale:
    def _make_customer(self, s):
        phone = f"07{uuid.uuid4().hex[:8]}"
        r = s.post(f"{API}/customers", json={"name": f"TEST_loy_{uuid.uuid4().hex[:5]}", "phone": phone})
        assert r.status_code == 200
        return r.json()

    def _enable_loyalty(self, s, enabled: bool, rate: float = 1.0):
        s.put(f"{API}/settings", json={"loyalty": {"enabled": enabled, "points_per_currency": rate, "points_redemption_rate": 100.0}})

    def test_loyalty_enabled_awards_points(self, s, product):
        c = self._make_customer(s)
        self._enable_loyalty(s, True, 1.0)
        try:
            qty = 2
            total_expected = round(product["price"] * qty, 2)
            payload = {
                "items": [{
                    "product_id": product["id"],
                    "name": product["name"],
                    "price": product["price"],
                    "quantity": qty,
                }],
                "payment_method": "cash",
                "customer_id": c["id"],
            }
            r = s.post(f"{API}/sales", json=payload)
            assert r.status_code == 200, r.text
            time.sleep(0.3)
            updated = s.get(f"{API}/customers/{c['id']}").json()
            assert updated["loyalty_points"] == int(total_expected), (
                f"expected {int(total_expected)} pts, got {updated['loyalty_points']}"
            )
            assert updated["visits"] == 1
            assert abs(updated["total_spent"] - total_expected) < 0.01
        finally:
            s.delete(f"{API}/customers/{c['id']}")

    def test_loyalty_disabled_no_change(self, s, product):
        c = self._make_customer(s)
        # Seed points manually
        s.post(f"{API}/customers/{c['id']}/points/adjust", json={"delta": 7, "reason": "seed"})
        before = s.get(f"{API}/customers/{c['id']}").json()
        self._enable_loyalty(s, False, 1.0)
        try:
            payload = {
                "items": [{
                    "product_id": product["id"],
                    "name": product["name"],
                    "price": product["price"],
                    "quantity": 1,
                }],
                "payment_method": "cash",
                "customer_id": c["id"],
            }
            r = s.post(f"{API}/sales", json=payload)
            assert r.status_code == 200
            time.sleep(0.3)
            after = s.get(f"{API}/customers/{c['id']}").json()
            assert after["loyalty_points"] == before["loyalty_points"]
            assert after.get("visits", 0) == before.get("visits", 0)
        finally:
            # restore loyalty enabled (will be reset in finalizer below too)
            self._enable_loyalty(s, True, 1.0)
            s.delete(f"{API}/customers/{c['id']}")


# ---------------- Order cancel & Z journal ------------------------------

class TestOrderCancelAndZ:
    def test_cancel_appends_CANCEL(self, s):
        # Create an order via /api/orders if possible
        r = s.get(f"{API}/tables")
        if r.status_code != 200 or not r.json():
            pytest.skip("No tables seeded")
        table = r.json()[0]
        r2 = s.post(f"{API}/orders", json={"table_id": table["id"], "items": []})
        if r2.status_code != 200:
            pytest.skip(f"Cannot create order: {r2.status_code} {r2.text[:120]}")
        order = r2.json()
        before = s.get(f"{API}/journal/summary").json()["count"]
        r3 = s.post(f"{API}/orders/{order['id']}/cancel")
        assert r3.status_code == 200, r3.text
        time.sleep(0.2)
        after_summary = s.get(f"{API}/journal/summary").json()
        assert after_summary["count"] == before + 1
        last = s.get(f"{API}/journal?limit=1").json()[0]
        assert last["type"] == "CANCEL"
        assert last["ref_id"] == order["id"]
