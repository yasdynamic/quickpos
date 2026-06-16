"""
Backend tests for the Caisse Hub iteration:
- Sales / orders rejected without open session
- Reopen permission: any role can reopen on same day
- Reopen rejected when not closed today or already open
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://touchpoint-sales-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- helpers / fixtures ----------

@pytest.fixture(scope="session")
def admin():
    r = requests.post(f"{API}/auth/login", json={"pin": "000000"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def sophie():
    r = requests.post(f"{API}/auth/login", json={"pin": "1111"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(user):
    return {"X-User-Id": user["id"], "Content-Type": "application/json"}


def _current_session():
    r = requests.get(f"{API}/cash-sessions/current", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _close_open_session_if_any(admin):
    s = _current_session()
    if s:
        r = requests.post(
            f"{API}/cash-sessions/{s['id']}/close",
            json={"closing_cash_declared": s.get("opening_cash", 0)},
            headers=_hdr(admin),
            timeout=15,
        )
        assert r.status_code == 200, r.text


def _open_session(server):
    r = requests.post(
        f"{API}/cash-sessions/open",
        json={"server_id": server["id"], "opening_cash": 50.0},
        headers=_hdr(server),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Session enforcement on sales/orders ----------

class TestSessionEnforcement:
    def test_sales_rejected_without_session(self, admin):
        _close_open_session_if_any(admin)
        assert _current_session() is None
        payload = {
            "items": [{"product_id": "x", "name": "Test", "price": 5.0, "qty": 1, "quantity": 1}],
            "payment_method": "cash",
            "total": 5.0,
        }
        r = requests.post(f"{API}/sales", json=payload, headers=_hdr(admin), timeout=15)
        assert r.status_code == 400, r.text
        assert "session" in r.json().get("detail", "").lower()

    def test_order_pay_rejected_without_session(self, admin):
        # create the order with a session open so that we have an open order
        _close_open_session_if_any(admin)
        sess = _open_session(admin)
        try:
            # try to create an order
            r = requests.post(
                f"{API}/orders",
                json={"table_id": None, "items": [{"product_id": "x", "name": "Coffee", "price": 3.0, "qty": 1}]},
                headers=_hdr(admin), timeout=15)
            assert r.status_code in (200, 201), r.text
            order_id = r.json()["id"]
        finally:
            requests.post(
                f"{API}/cash-sessions/{sess['id']}/close",
                json={"closing_cash_declared": sess.get("opening_cash", 0)},
                headers=_hdr(admin), timeout=15,
            )

        # now no session is open. Pay should be rejected
        assert _current_session() is None
        r = requests.post(
            f"{API}/orders/{order_id}/pay",
            json={"payment_method": "cash"},
            headers=_hdr(admin), timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "session" in r.json().get("detail", "").lower()


# ---------- Reopen permission and guards ----------

class TestReopenSession:
    def test_reopen_same_day_as_server(self, admin, sophie):
        _close_open_session_if_any(admin)
        sess = _open_session(sophie)
        # close session today
        r = requests.post(
            f"{API}/cash-sessions/{sess['id']}/close",
            json={"closing_cash_declared": sess.get("opening_cash", 0)},
            headers=_hdr(sophie), timeout=15,
        )
        assert r.status_code == 200, r.text

        # reopen as Sophie (server role) — should NOT require manager
        r = requests.post(
            f"{API}/cash-sessions/{sess['id']}/reopen",
            headers=_hdr(sophie), timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "open"

        # cleanup: close again
        _close_open_session_if_any(admin)

    def test_reopen_non_closed_returns_400(self, admin):
        _close_open_session_if_any(admin)
        sess = _open_session(admin)
        try:
            r = requests.post(
                f"{API}/cash-sessions/{sess['id']}/reopen",
                headers=_hdr(admin), timeout=15,
            )
            assert r.status_code == 400, r.text
            assert "clôturée" in r.json().get("detail", "").lower() or "non clôturée" in r.json().get("detail", "").lower()
        finally:
            _close_open_session_if_any(admin)

    def test_reopen_when_another_open_returns_400(self, admin):
        _close_open_session_if_any(admin)
        # create then close a session A
        sess_a = _open_session(admin)
        requests.post(
            f"{API}/cash-sessions/{sess_a['id']}/close",
            json={"closing_cash_declared": sess_a.get("opening_cash", 0)},
            headers=_hdr(admin), timeout=15,
        )
        # open another (B)
        sess_b = _open_session(admin)
        try:
            # try to reopen A while B is open
            r = requests.post(
                f"{API}/cash-sessions/{sess_a['id']}/reopen",
                headers=_hdr(admin), timeout=15,
            )
            assert r.status_code == 400, r.text
        finally:
            _close_open_session_if_any(admin)


# ---------- Nav / Hub data needs ----------

class TestHubData:
    def test_current_session_endpoint(self, admin):
        r = requests.get(f"{API}/cash-sessions/current", timeout=15)
        assert r.status_code == 200

    def test_cash_sessions_history(self, admin):
        r = requests.get(f"{API}/cash-sessions", params={"limit": 10}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders_open_filter(self, admin):
        r = requests.get(f"{API}/orders", params={"status": "open"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
