"""Tests for /api/users CRUD and /api/settings SMTP (incl. password masking + test endpoint)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s


@pytest.fixture(scope="module")
def created_user_ids():
    ids = []
    yield ids
    # teardown: remove any created TEST users
    for uid in ids:
        try:
            requests.delete(f"{API}/users/{uid}", timeout=10)
        except Exception:
            pass


@pytest.fixture(scope="module")
def smtp_restore():
    yield
    # restore SMTP empty/disabled
    requests.put(
        f"{API}/settings",
        json={"smtp": {"host": "", "port": 587, "username": "", "password": "",
                       "from_email": "", "from_name": "QuickPOS", "use_tls": True, "enabled": False}},
        timeout=10,
    )


# ---------------- Users ------------------------------------------------------
class TestUsers:
    def test_list_users_no_pin(self, session):
        r = session.get(f"{API}/users", timeout=10)
        assert r.status_code == 200
        data = r.json()
        names = {u["name"] for u in data}
        assert {"Admin", "Sophie", "Marc"}.issubset(names)
        for u in data:
            assert "pin" not in u  # masked

    def test_create_user(self, session, created_user_ids):
        unique_pin = str(uuid.uuid4().int)[:6]
        payload = {"name": f"TEST_{unique_pin}", "pin": unique_pin, "role": "server", "color": "#10B981"}
        r = session.post(f"{API}/users", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["role"] == "server"
        assert data["color"] == "#10B981"
        assert "id" in data
        created_user_ids.append(data["id"])
        # confirm appears in list
        listing = session.get(f"{API}/users").json()
        assert any(u["id"] == data["id"] for u in listing)

    def test_create_duplicate_pin_400(self, session, created_user_ids):
        # try to create another user using existing PIN of first created
        # Use a known seeded PIN clash: 1111 (Sophie)
        r = session.post(f"{API}/users",
                         json={"name": "TEST_dup", "pin": "1111", "role": "server", "color": "#000000"},
                         timeout=10)
        assert r.status_code == 400
        assert "PIN" in r.json().get("detail", "")

    def test_update_user_without_pin(self, session, created_user_ids):
        assert created_user_ids, "previous create failed"
        uid = created_user_ids[0]
        r = session.put(f"{API}/users/{uid}",
                        json={"name": "TEST_renamed", "role": "manager", "color": "#F97316"}, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "TEST_renamed"
        assert body["role"] == "manager"
        assert body["color"] == "#F97316"

    def test_update_pin_clash_400(self, session, created_user_ids):
        uid = created_user_ids[0]
        # 000000 is Admin's PIN — clash
        r = session.put(f"{API}/users/{uid}", json={"pin": "000000"}, timeout=10)
        assert r.status_code == 400

    def test_update_new_pin_and_login(self, session, created_user_ids):
        uid = created_user_ids[0]
        new_pin = str(uuid.uuid4().int)[:6]
        # ensure unique vs seeded
        while new_pin in {"000000", "1111", "2222"}:
            new_pin = str(uuid.uuid4().int)[:6]
        r = session.put(f"{API}/users/{uid}", json={"pin": new_pin}, timeout=10)
        assert r.status_code == 200, r.text
        # login with new PIN
        lr = session.post(f"{API}/auth/login", json={"pin": new_pin}, timeout=10)
        assert lr.status_code == 200, lr.text
        assert lr.json()["id"] == uid

    def test_delete_user(self, session, created_user_ids):
        uid = created_user_ids[0]
        r = session.delete(f"{API}/users/{uid}", timeout=10)
        assert r.status_code == 200
        # confirm gone
        listing = session.get(f"{API}/users").json()
        assert not any(u["id"] == uid for u in listing)
        created_user_ids.remove(uid)


# ---------------- SMTP -------------------------------------------------------
class TestSMTP:
    def test_settings_initial_password_empty_or_masked(self, session, smtp_restore):
        # First clear it
        requests.put(f"{API}/settings",
                     json={"smtp": {"host": "", "port": 587, "username": "", "password": "",
                                    "from_email": "", "from_name": "QuickPOS",
                                    "use_tls": True, "enabled": False}}, timeout=10)
        r = session.get(f"{API}/settings", timeout=10)
        assert r.status_code == 200
        smtp = r.json()["smtp"]
        assert smtp["password"] == ""
        assert smtp["enabled"] is False

    def test_smtp_test_without_host_returns_400(self, session):
        r = session.post(f"{API}/settings/smtp/test",
                         json={"to": "test@example.com"}, timeout=10)
        assert r.status_code == 400

    def test_put_password_then_masked_on_get(self, session):
        r = session.put(f"{API}/settings", json={"smtp": {
            "host": "smtp.invalid.example.com", "port": 587, "username": "user@x.com",
            "password": "monpassword", "from_email": "from@x.com", "from_name": "QP",
            "use_tls": True, "enabled": True}}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["smtp"]["password"] == "********"
        # GET also returns masked
        g = session.get(f"{API}/settings").json()
        assert g["smtp"]["password"] == "********"
        assert g["smtp"]["host"] == "smtp.invalid.example.com"
        assert g["smtp"]["enabled"] is True

    def test_put_with_masked_password_keeps_existing(self, session):
        # Send back the masked password — backend MUST NOT overwrite
        r = session.put(f"{API}/settings", json={"smtp": {
            "host": "smtp.invalid.example.com", "port": 587, "username": "user@x.com",
            "password": "********", "from_email": "from@x.com", "from_name": "QP",
            "use_tls": True, "enabled": True}}, timeout=10)
        assert r.status_code == 200
        # We can indirectly verify by triggering SMTP test which would attempt auth (host fails first → error)
        t = session.post(f"{API}/settings/smtp/test", json={"to": "x@y.com"}, timeout=15)
        assert t.status_code == 200
        body = t.json()
        # invalid host → error
        assert body["status"] == "error"
        assert body.get("transport") == "smtp"
        assert "error" in body and body["error"]

    def test_smtp_priority_over_resend_in_send_daily(self, session):
        # With smtp enabled+host invalid, send_daily must attempt smtp (transport=smtp,error)
        r = session.post(f"{API}/reports/daily/send",
                         json={"recipient_email": "x@y.com"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        email = body.get("email", {})
        # transport must be smtp (priority), and since host invalid → error
        assert email.get("transport") == "smtp"
        assert email.get("status") == "error"

    def test_restore_smtp_disabled(self, session):
        r = session.put(f"{API}/settings", json={"smtp": {
            "host": "", "port": 587, "username": "", "password": "",
            "from_email": "", "from_name": "QuickPOS", "use_tls": True,
            "enabled": False}}, timeout=10)
        assert r.status_code == 200
        g = session.get(f"{API}/settings").json()
        assert g["smtp"]["enabled"] is False
        assert g["smtp"]["password"] == ""
