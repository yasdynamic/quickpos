"""Tests for WARYA priority tasks:
- Permission gating (refund.create, discount.apply)
- Journal verify/repair
- Permissions catalog
- End-to-end refund flow as admin
- Static review: append_journal rollback safety
"""

import os
import inspect
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_ID = "5e5207c5-7d10-4fd4-9427-88fa405ff874"
SOPHIE_ID = "6be86f94-8890-4a1c-a0d2-735147d7ef49"  # server
MARC_ID = "4727401f-04c7-42bb-ac76-03843d8345fd"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


def H(uid):
    return {"X-User-Id": uid}


# ---------- Permissions catalog ----------
def test_permissions_catalog(session):
    r = session.get(f"{API}/permissions/catalog")
    assert r.status_code == 200
    data = r.json()
    # accept either list or dict structure - just look for keys somewhere
    blob = str(data)
    assert "refund.create" in blob
    assert "discount.apply" in blob


# ---------- Refund permission gating ----------
def test_refund_requires_auth(session):
    r = session.post(f"{API}/refunds", json={"sale_id": "fake", "items": []})
    assert r.status_code == 401, r.text


def test_refund_forbidden_for_server(session):
    r = session.post(
        f"{API}/refunds",
        json={"sale_id": "fake", "items": []},
        headers=H(SOPHIE_ID),
    )
    assert r.status_code == 403, r.text
    assert "refund.create" in r.json().get("detail", "")


def test_refund_admin_passes_permission_check(session):
    # Admin: permission passes -> will then 404 (or 400) on missing sale_id, NOT 401/403
    r = session.post(
        f"{API}/refunds",
        json={"sale_id": "does-not-exist", "items": []},
        headers=H(ADMIN_ID),
    )
    assert r.status_code not in (401, 403), r.text


# ---------- Discount permission gating ----------
def test_discount_requires_auth(session):
    r = session.post(f"{API}/orders/anyid/discount", json={"type": "percent", "value": 10})
    assert r.status_code == 401, r.text


def test_discount_server_passes_permission(session):
    # Sophie has discount.apply by default → expect non-401/403 (likely 404 on invalid order)
    r = session.post(
        f"{API}/orders/does-not-exist/discount",
        json={"type": "percent", "value": 10},
        headers=H(SOPHIE_ID),
    )
    assert r.status_code not in (401, 403), r.text


# ---------- Journal verify/repair ----------
def test_journal_verify_valid(session):
    r = session.post(f"{API}/journal/verify")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("valid") is True, data


def test_journal_repair_requires_confirm(session):
    r = session.post(f"{API}/journal/repair")
    assert r.status_code == 400, r.text


# ---------- End-to-end refund (admin) ----------
def _ensure_open_session(session):
    # If a cash session is already open, return it. Else open one.
    r = session.get(f"{API}/cash-sessions/current", headers=H(ADMIN_ID))
    if r.status_code == 200 and r.json():
        return r.json()
    r2 = session.post(
        f"{API}/cash-sessions/open",
        json={"opening_cash": 0},
        headers=H(ADMIN_ID),
    )
    if r2.status_code in (200, 201):
        return r2.json()
    return None


def _get_simple_product(session):
    r = session.get(f"{API}/products", headers=H(ADMIN_ID))
    if r.status_code != 200:
        return None
    items = r.json()
    if not items:
        return None
    # pick any with a price > 0
    for p in items:
        if (p.get("price") or 0) > 0:
            return p
    return items[0]


def test_end_to_end_refund_and_journal_still_valid(session):
    _ensure_open_session(session)
    product = _get_simple_product(session)
    if not product:
        pytest.skip("No products seeded — cannot exercise the refund flow")

    sale_payload = {
        "items": [
            {
                "product_id": product["id"],
                "name": product["name"],
                "price": product["price"],
                "quantity": 1,
            }
        ],
        "payment_method": "cash",
        "amount_received": product["price"],
    }
    rs = session.post(f"{API}/sales", json=sale_payload, headers=H(ADMIN_ID))
    if rs.status_code not in (200, 201):
        pytest.skip(f"Could not create sale (status {rs.status_code}): {rs.text[:300]}")
    sale = rs.json()
    sale_id = sale.get("id") or sale.get("sale_id")
    assert sale_id, sale

    refund_payload = {
        "sale_id": sale_id,
        "items": [
            {
                "product_id": product["id"],
                "name": product["name"],
                "price": product["price"],
                "quantity": 1,
            }
        ],
        "reason": "TEST refund",
    }
    rr = session.post(f"{API}/refunds", json=refund_payload, headers=H(ADMIN_ID))
    assert rr.status_code in (200, 201), rr.text
    refund = rr.json()
    # The refund record has total > 0 but a negative sale entry was created
    # alongside it (sale.total < 0). Confirm both.
    assert refund.get("id"), refund
    assert (refund.get("sale") or {}).get("total", 0) < 0, refund

    # journal still valid
    rv = session.post(f"{API}/journal/verify")
    assert rv.status_code == 200
    assert rv.json().get("valid") is True


# ---------- Static code review: append_journal rollback ----------
def test_append_journal_has_rollback():
    from backend import nf525_loyalty  # type: ignore
    src = inspect.getsource(nf525_loyalty.append_journal)
    assert "try:" in src
    assert "except" in src
    # rollback decrements the counter
    assert "$inc" in src and "-1" in src
    assert "nf525-" in src
