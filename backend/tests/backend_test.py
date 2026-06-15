"""QuickPOS backend API tests."""
import os
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env
    from pathlib import Path
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Auth ----------------------------------------------------------------
class TestAuth:
    def test_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"pin": "1234"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Admin"
        assert data["role"] == "admin"
        assert "id" in data

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"pin": "0000"})
        assert r.status_code == 401


# --- Categories ----------------------------------------------------------
class TestCategories:
    def test_list_seeded(self, session):
        r = session.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        names = [c["name"] for c in cats]
        for expected in ["Boissons", "Plats", "Desserts", "Épicerie"]:
            assert expected in names
        assert len(cats) >= 4

    def test_crud_category(self, session):
        # Create
        r = session.post(f"{API}/categories", json={"name": "TEST_Cat", "color": "#123456", "icon": "Star"})
        assert r.status_code == 200
        cat = r.json()
        cat_id = cat["id"]
        assert cat["name"] == "TEST_Cat"

        # Update
        r = session.put(f"{API}/categories/{cat_id}", json={"name": "TEST_Cat2", "color": "#000000", "icon": "Star"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Cat2"

        # Delete (no product refs)
        r = session.delete(f"{API}/categories/{cat_id}")
        assert r.status_code == 200

    def test_delete_blocked_when_referenced(self, session):
        # Create category with product
        r = session.post(f"{API}/categories", json={"name": "TEST_CatRef"})
        cat_id = r.json()["id"]
        r = session.post(f"{API}/products", json={"name": "TEST_P", "price": 1.0, "category_id": cat_id, "stock": 5})
        prod_id = r.json()["id"]
        r = session.delete(f"{API}/categories/{cat_id}")
        assert r.status_code == 400
        # Cleanup
        session.delete(f"{API}/products/{prod_id}")
        session.delete(f"{API}/categories/{cat_id}")


# --- Products ------------------------------------------------------------
class TestProducts:
    def test_list_seeded(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 11

    def test_crud_product(self, session):
        # Get a category
        cats = session.get(f"{API}/categories").json()
        cat_id = cats[0]["id"]
        r = session.post(f"{API}/products", json={"name": "TEST_Prod", "price": 9.99, "category_id": cat_id, "stock": 10})
        assert r.status_code == 200
        prod = r.json()
        pid = prod["id"]
        assert prod["price"] == 9.99

        r = session.put(f"{API}/products/{pid}", json={"name": "TEST_Prod2", "price": 12.50, "category_id": cat_id, "stock": 20})
        assert r.status_code == 200
        assert r.json()["price"] == 12.50

        r = session.delete(f"{API}/products/{pid}")
        assert r.status_code == 200


# --- Sales ---------------------------------------------------------------
class TestSales:
    def test_create_sale_cash(self, session):
        prods = session.get(f"{API}/products").json()
        prod = prods[0]
        initial_stock = prod["stock"]
        payload = {
            "items": [
                {"product_id": prod["id"], "name": prod["name"], "price": prod["price"], "quantity": 2}
            ],
            "payment_method": "cash",
            "amount_received": prod["price"] * 2 + 5,
            "cashier_name": "Admin",
        }
        r = session.post(f"{API}/sales", json=payload)
        assert r.status_code == 200, r.text
        sale = r.json()
        assert sale["subtotal"] == round(prod["price"] * 2, 2)
        assert sale["total"] == sale["subtotal"]
        assert sale["change_due"] == 5.0
        assert isinstance(sale["ticket_number"], int) and sale["ticket_number"] >= 1
        assert sale["payment_method"] == "cash"

        # Stock decremented
        updated = next(p for p in session.get(f"{API}/products").json() if p["id"] == prod["id"])
        assert updated["stock"] == max(0, initial_stock - 2)

    def test_list_sales_today(self, session):
        today = datetime.now(timezone.utc).date().isoformat()
        r = session.get(f"{API}/sales", params={"target_date": today})
        assert r.status_code == 200
        sales = r.json()
        assert isinstance(sales, list)
        assert len(sales) >= 1


# --- Dashboard & reports -------------------------------------------------
class TestDashboard:
    def test_dashboard(self, session):
        r = session.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_revenue", "num_sales", "avg_ticket", "by_hour", "by_payment", "by_category", "top_products"]:
            assert k in d
        assert len(d["by_hour"]) == 24

    def test_daily_report(self, session):
        today = datetime.now(timezone.utc).date().isoformat()
        r = session.get(f"{API}/reports/daily", params={"target_date": today})
        assert r.status_code == 200
        assert r.json()["date"] == today

    def test_monthly_report(self, session):
        now = datetime.now(timezone.utc)
        r = session.get(f"{API}/reports/monthly", params={"year": now.year, "month": now.month})
        assert r.status_code == 200
        d = r.json()
        assert d["year"] == now.year
        assert d["month"] == now.month


# --- Email skipped flow --------------------------------------------------
class TestEmail:
    def test_send_daily_skipped(self, session):
        r = session.post(f"{API}/reports/daily/send", json={})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"]["status"] == "skipped"
        assert "report" in data

    def test_closure_persisted(self, session):
        r = session.get(f"{API}/closures")
        assert r.status_code == 200
        closures = r.json()
        assert len(closures) >= 1
        assert "data" in closures[0]
        assert "email_status" in closures[0]

    def test_send_monthly_skipped(self, session):
        now = datetime.now(timezone.utc)
        r = session.post(f"{API}/reports/monthly/send", json={"year": now.year, "month": now.month})
        assert r.status_code == 200
        assert r.json()["email"]["status"] == "skipped"

    def test_settings(self, session):
        r = session.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert s["email_configured"] is False
        assert s["currency"] == "EUR"
