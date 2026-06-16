"""QuickPOS Clyo-style backend tests: auth, zones/tables, sessions, orders+modifiers, X/Z reports."""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin(s):
    r = s.post(f"{API}/auth/login", json={"pin": "000000"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def sophie(s):
    r = s.post(f"{API}/auth/login", json={"pin": "1111"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session", autouse=True)
def _ensure_no_open_session(s):
    cur = s.get(f"{API}/cash-sessions/current").json()
    if cur:
        s.post(f"{API}/cash-sessions/{cur['id']}/close", json={"closing_cash_declared": 0.0})
    yield


class TestAuth:
    def test_admin_login(self, admin):
        assert admin["name"] == "Admin"
        assert admin["role"] == "admin"

    def test_sophie_login(self, sophie):
        assert sophie["name"] == "Sophie"
        assert sophie["role"] == "server"

    def test_marc_login(self, s):
        r = s.post(f"{API}/auth/login", json={"pin": "2222"})
        assert r.status_code == 200
        assert r.json()["name"] == "Marc"

    def test_invalid_pin(self, s):
        r = s.post(f"{API}/auth/login", json={"pin": "9999"})
        assert r.status_code == 401


class TestZonesTables:
    def test_zones_seeded(self, s):
        r = s.get(f"{API}/zones")
        assert r.status_code == 200
        names = {z["name"] for z in r.json()}
        assert {"Salle", "Terrasse", "Bar"}.issubset(names)

    def test_tables_have_status(self, s):
        r = s.get(f"{API}/tables")
        assert r.status_code == 200
        tables = r.json()
        assert len(tables) >= 13
        for t in tables:
            assert t["status"] in ("free", "occupied")


class TestCashSession:
    def test_open_session(self, s, sophie):
        r = s.post(f"{API}/cash-sessions/open", json={"opening_cash": 100, "server_id": sophie["id"]})
        assert r.status_code == 200, r.text
        sess = r.json()
        assert sess["opening_cash"] == 100
        assert sess["status"] == "open"
        pytest.session_id = sess["id"]

    def test_current_session_returns_it(self, s):
        r = s.get(f"{API}/cash-sessions/current")
        assert r.status_code == 200
        cur = r.json()
        assert cur and cur["id"] == pytest.session_id

    def test_cannot_open_second(self, s):
        r = s.post(f"{API}/cash-sessions/open", json={"opening_cash": 50})
        assert r.status_code == 400


class TestOrdersModifiers:
    def test_full_order_flow(self, s, sophie):
        tables = s.get(f"{API}/tables").json()
        free = next(t for t in tables if t["status"] == "free")
        table_id = free["id"]

        r = s.post(f"{API}/orders", json={"table_id": table_id, "server_id": sophie["id"], "covers": 2})
        assert r.status_code == 200, r.text
        order = r.json()
        oid = order["id"]
        assert order["status"] == "open"
        pytest.order_id = oid

        tables2 = s.get(f"{API}/tables").json()
        t2 = next(t for t in tables2 if t["id"] == table_id)
        assert t2["status"] == "occupied"

        products = s.get(f"{API}/products").json()
        burger = next(p for p in products if p["name"] == "Burger maison")
        espresso = next(p for p in products if p["name"] == "Café Espresso")
        assert burger["price"] == 12.5
        assert any(g["name"] == "Cuisson" for g in burger["modifiers"])

        r = s.post(f"{API}/orders/{oid}/items", json={
            "product_id": burger["id"],
            "quantity": 1,
            "modifiers": [
                {"name": "Saignant", "price_delta": 0},
                {"name": "Fromage", "price_delta": 1.0},
            ],
        })
        assert r.status_code == 200
        assert r.json()["total"] == 13.5

        r = s.post(f"{API}/orders/{oid}/items", json={
            "product_id": espresso["id"], "quantity": 2, "modifiers": []
        })
        assert r.status_code == 200
        assert r.json()["total"] == 16.5

        r = s.post(f"{API}/orders/{oid}/send")
        assert r.status_code == 200
        sent_items = r.json()["items"]
        assert all(it["sent"] for it in sent_items)
        first_item_id = sent_items[0]["id"]

        r = s.put(f"{API}/orders/{oid}/items/{first_item_id}", json={"quantity": 5})
        assert r.status_code == 400

        r = s.delete(f"{API}/orders/{oid}/items/{first_item_id}")
        assert r.status_code == 400

        r = s.post(f"{API}/orders/{oid}/pay", json={"payment_method": "cash", "amount_received": 50})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["order"]["status"] == "paid"
        assert body["sale"]["total"] == 16.5
        assert body["sale"]["change_due"] == round(50 - 16.5, 2)

        tables3 = s.get(f"{API}/tables").json()
        t3 = next(t for t in tables3 if t["id"] == table_id)
        assert t3["status"] == "free"

    def test_cancel_order(self, s, sophie):
        tables = s.get(f"{API}/tables").json()
        free = next(t for t in tables if t["status"] == "free")
        r = s.post(f"{API}/orders", json={"table_id": free["id"], "server_id": sophie["id"]})
        oid = r.json()["id"]
        r2 = s.post(f"{API}/orders/{oid}/cancel")
        assert r2.status_code == 200
        assert r2.json()["status"] == "cancelled"

    def test_cannot_delete_table_with_open_order(self, s, sophie):
        tables = s.get(f"{API}/tables").json()
        free = next(t for t in tables if t["status"] == "free")
        r = s.post(f"{API}/orders", json={"table_id": free["id"], "server_id": sophie["id"]})
        assert r.status_code == 200
        oid = r.json()["id"]
        r2 = s.delete(f"{API}/tables/{free['id']}")
        assert r2.status_code == 400
        s.post(f"{API}/orders/{oid}/cancel")


class TestXZReports:
    def test_x_report(self, s):
        r = s.get(f"{API}/reports/x")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["report_type"] == "X"
        assert data["opening_cash"] == 100
        assert data["expected_cash"] == 116.5
        assert data["total_revenue"] >= 16.5

    def test_close_session_z(self, s):
        sid = pytest.session_id
        r = s.post(f"{API}/cash-sessions/{sid}/close", json={"closing_cash_declared": 150})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["session"]["status"] == "closed"
        assert body["session"]["expected_cash"] == 116.5
        assert body["session"]["cash_difference"] == round(150 - 116.5, 2)
        assert body["email"]["status"] == "skipped"

    def test_z_report_listed(self, s):
        r = s.get(f"{API}/reports?report_type=Z")
        assert r.status_code == 200
        reports = r.json()
        assert any(rep.get("session_id") == pytest.session_id for rep in reports)

    def test_no_open_session_after_close(self, s):
        cur = s.get(f"{API}/cash-sessions/current").json()
        assert cur is None
