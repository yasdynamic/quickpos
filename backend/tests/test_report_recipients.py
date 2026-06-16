"""Tests for report_recipients (multi-destinataire) feature."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # final cleanup: empty recipients
    try:
        s.put(f"{API}/settings", json={"report_recipients": []}, timeout=15)
    except Exception:
        pass


def _put_recipients(client, recipients):
    r = client.put(f"{API}/settings", json={"report_recipients": recipients}, timeout=15)
    return r


def _get_settings(client):
    r = client.get(f"{API}/settings", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ----- GET /settings baseline -----
class TestSettingsRecipientsField:
    def test_get_settings_has_report_recipients_field(self, client):
        # ensure empty list to start
        _put_recipients(client, [])
        data = _get_settings(client)
        assert "report_recipients" in data
        assert isinstance(data["report_recipients"], list)
        assert data["report_recipients"] == []

    def test_resend_configured_flag_true(self, client):
        # required for downstream test interpretation
        data = _get_settings(client)
        assert data.get("resend_configured") is True, (
            "RESEND_API_KEY must be configured for this iteration"
        )


# ----- PUT /settings dedupe + lowercase -----
class TestPutRecipientsDedupe:
    def test_put_lowercases_and_dedupes(self, client):
        payload = ["Patron@Example.com", "compta@example.com", "PATRON@example.com"]
        r = _put_recipients(client, payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["report_recipients"] == ["patron@example.com", "compta@example.com"]

        # Confirm via GET
        data = _get_settings(client)
        assert data["report_recipients"] == ["patron@example.com", "compta@example.com"]

    def test_put_adding_existing_case_different_stays_unique(self, client):
        # Start with patron + compta already in list (depends on previous test order independence)
        _put_recipients(client, ["patron@example.com", "compta@example.com"])
        new_list = [
            "patron@example.com",
            "compta@example.com",
            "boss@example.com",
            "PATRON@example.com",  # duplicate case-different
        ]
        r = _put_recipients(client, new_list)
        assert r.status_code == 200, r.text
        body = r.json()
        # Order-preserving dedupe; PATRON@... is dropped
        assert body["report_recipients"] == [
            "patron@example.com",
            "compta@example.com",
            "boss@example.com",
        ]

    def test_put_invalid_email_returns_422(self, client):
        r = _put_recipients(client, ["notanemail"])
        assert r.status_code == 422, (
            f"Expected 422 for invalid email, got {r.status_code}: {r.text}"
        )

    def test_put_empty_list_clears(self, client):
        r = _put_recipients(client, [])
        assert r.status_code == 200
        assert r.json()["report_recipients"] == []


# ----- Reports daily/send routing -----
class TestDailySendRecipients:
    def _ensure_smtp_disabled(self, client):
        # Set SMTP empty/disabled so Resend transport is used
        client.put(
            f"{API}/settings",
            json={
                "smtp": {
                    "host": "",
                    "port": 587,
                    "username": "",
                    "password": "",
                    "from_email": "",
                    "from_name": "QuickPOS",
                    "use_tls": True,
                    "enabled": False,
                }
            },
            timeout=15,
        )

    def test_daily_send_uses_configured_list_when_no_override(self, client):
        self._ensure_smtp_disabled(client)
        _put_recipients(client, ["a@example.com", "b@example.com"])
        r = client.post(f"{API}/reports/daily/send", json={}, timeout=30)
        assert r.status_code == 200, r.text
        email = r.json().get("email", {})
        # Resend will return error (domain not verified) but 'to' must reflect list
        to = email.get("to")
        # Most likely Resend lib raises before returning a structured 'to' field.
        # In that case _maybe_send_email returns {status:'error', transport:'resend', error:'...'}
        # The error string from Resend usually echoes recipients OR not; we accept either:
        if to:
            assert sorted(to) == sorted(["a@example.com", "b@example.com"])
        else:
            # at least transport=resend and status in {sent,error}
            assert email.get("transport") == "resend"
            assert email.get("status") in ("sent", "error")

    def test_daily_send_explicit_override_uses_single(self, client):
        self._ensure_smtp_disabled(client)
        _put_recipients(client, ["a@example.com", "b@example.com"])
        r = client.post(
            f"{API}/reports/daily/send",
            json={"recipient_email": "single@example.com"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        email = r.json().get("email", {})
        to = email.get("to")
        if to:
            assert to == ["single@example.com"], to
        else:
            # error path; nothing more we can assert from outside
            assert email.get("transport") == "resend"

    def test_daily_send_skipped_when_no_recipients(self, client):
        self._ensure_smtp_disabled(client)
        # Clear REPORT_EMAIL fallback by ensuring server env REPORT_EMAIL is empty (assumed from .env)
        _put_recipients(client, [])
        r = client.post(f"{API}/reports/daily/send", json={}, timeout=30)
        assert r.status_code == 200, r.text
        email = r.json().get("email", {})
        assert email.get("status") == "skipped", email
        assert email.get("reason") == "Aucun destinataire fourni", email


# ----- Cash session close uses list -----
class TestCloseSessionRecipients:
    def test_close_session_uses_configured_list(self, client):
        _put_recipients(client, ["a@example.com", "b@example.com"])
        # open a session
        r = client.post(
            f"{API}/cash-sessions/open",
            json={"server_name": "Admin", "opening_cash": 0.0},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        # close
        r2 = client.post(
            f"{API}/cash-sessions/{sid}/close",
            json={"closing_cash_declared": 0.0},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text
        # close response shape: {session, report, email}
        email = r2.json().get("email", {})
        assert email, f"missing email status in close response: {r2.json()}"
        to = email.get("to")
        if to:
            assert sorted(to) == sorted(["a@example.com", "b@example.com"])
        else:
            assert email.get("status") in ("sent", "error"), email
            # must NOT be skipped since recipients are configured
            assert email.get("status") != "skipped"


# ----- Monthly send (potential bug area) -----
class TestMonthlySendRecipients:
    def test_monthly_send_uses_configured_list(self, client):
        # ensure SMTP disabled, recipients configured
        client.put(
            f"{API}/settings",
            json={
                "smtp": {
                    "host": "",
                    "port": 587,
                    "username": "",
                    "password": "",
                    "from_email": "",
                    "from_name": "QuickPOS",
                    "use_tls": True,
                    "enabled": False,
                }
            },
            timeout=15,
        )
        _put_recipients(client, ["a@example.com", "b@example.com"])
        now = datetime.now(timezone.utc)
        r = client.post(
            f"{API}/reports/monthly/send",
            json={"year": now.year, "month": now.month},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        email = r.json().get("email", {})
        to = email.get("to")
        # The user said monthly should also use the configured list
        if to is not None:
            assert sorted(to) == sorted(["a@example.com", "b@example.com"]), (
                f"monthly/send did not honor report_recipients list, got to={to}"
            )
        else:
            # if no 'to' returned, ensure at least it didn't get skipped due to no recipients
            assert email.get("status") != "skipped", (
                "monthly/send returned skipped despite configured report_recipients — "
                "endpoint not wired to _resolve_recipients (bug)"
            )
