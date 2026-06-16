"""WARYA — License module (Ed25519 + AES-256-GCM).

Public-key verification only. The private signing key MUST stay on the
publisher side (off-server in V2 Electron admin tool).
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import platform
import re
import socket
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# --------------------------------------------------------------------------
# Paths and configuration
# --------------------------------------------------------------------------
BASE = Path(__file__).parent
PUBLIC_KEY_PATH = BASE / "public_ed25519.pem"
PRIVATE_KEY_PATH = BASE.parent / ".secrets" / "private_ed25519.pem"

LICENSE_SALT = os.environ.get("LICENSE_SALT", "warya-default-salt")
LICENSE_AES_PASS = os.environ.get(
    "LICENSE_AES_KEY", "warya-default-aes-key"
).encode("utf-8")

# Single PBKDF2 derivation for AES-256 envelope. Iterations small on purpose:
# the AES layer is obfuscation, not security (key shipped in app).
AES_KEY_LEN = 32  # 256-bit
AES_KDF_ITER = 100_000
AES_KDF_SALT = b"warya-lic-aes-salt"


def _aes_key() -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=AES_KEY_LEN,
        salt=AES_KDF_SALT,
        iterations=AES_KDF_ITER,
    )
    return kdf.derive(LICENSE_AES_PASS)


# --------------------------------------------------------------------------
# Keys
# --------------------------------------------------------------------------
def load_public_key() -> Ed25519PublicKey:
    data = PUBLIC_KEY_PATH.read_bytes()
    return serialization.load_pem_public_key(data)  # type: ignore[return-value]


def load_private_key() -> Ed25519PrivateKey:
    data = PRIVATE_KEY_PATH.read_bytes()
    return serialization.load_pem_private_key(data, password=None)  # type: ignore[return-value]


# --------------------------------------------------------------------------
# Machine fingerprint
# --------------------------------------------------------------------------
def _get_mac() -> str:
    n = uuid.getnode()
    return ":".join(f"{(n >> ele) & 0xff:02x}" for ele in (40, 32, 24, 16, 8, 0))


def _get_machine_id() -> str:
    """OS-level stable machine identifier (Linux /etc/machine-id, Windows
    MachineGuid, macOS IOPlatformUUID).
    """
    try:
        path = Path("/etc/machine-id")
        if path.exists():
            return path.read_text().strip()
    except Exception:
        pass
    try:
        if platform.system() == "Darwin":
            out = subprocess.check_output(
                ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
                stderr=subprocess.DEVNULL,
                timeout=2,
            ).decode()
            m = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', out)
            if m:
                return m.group(1)
        elif platform.system() == "Windows":
            out = subprocess.check_output(
                ["reg", "query",
                 r"HKLM\SOFTWARE\Microsoft\Cryptography",
                 "/v", "MachineGuid"],
                stderr=subprocess.DEVNULL,
                timeout=2,
            ).decode()
            m = re.search(r"REG_SZ\s+(\S+)", out)
            if m:
                return m.group(1)
    except Exception:
        pass
    return platform.node() or "unknown"


def compute_fingerprint() -> str:
    """Stable per-host fingerprint formatted as POS-XXXX-XXXX-XXXX.

    Uses hostname + MAC + machine-id + LICENSE_SALT then SHA-256.
    """
    parts = [
        platform.node() or "",
        _get_mac(),
        _get_machine_id(),
        platform.machine(),
        LICENSE_SALT,
    ]
    raw = "|".join(parts).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest().upper()
    return f"POS-{digest[0:4]}-{digest[4:8]}-{digest[8:12]}"


# --------------------------------------------------------------------------
# License payload canonicalisation
# --------------------------------------------------------------------------
SIGNED_FIELDS = [
    "licenseNumber",
    "company",
    "clientName",
    "edition",
    "maxUsers",
    "maxWorkstations",
    "activationDate",
    "expirationDate",
    "machineFingerprint",
]


def canonical_bytes(payload: dict) -> bytes:
    """Canonical representation of the signed fields (stable JSON)."""
    subset = {k: payload.get(k) for k in SIGNED_FIELDS}
    return json.dumps(subset, sort_keys=True, separators=(",", ":")).encode("utf-8")


# --------------------------------------------------------------------------
# Sign + verify
# --------------------------------------------------------------------------
def sign_payload(payload: dict, private_key: Ed25519PrivateKey) -> dict:
    """Adds 'signature' (base64) to the payload."""
    sig = private_key.sign(canonical_bytes(payload))
    payload = dict(payload)
    payload["signature"] = base64.b64encode(sig).decode("ascii")
    payload["signatureAlgorithm"] = "Ed25519"
    return payload


def verify_signature(payload: dict, public_key: Optional[Ed25519PublicKey] = None) -> bool:
    pk = public_key or load_public_key()
    sig_b64 = payload.get("signature")
    if not sig_b64:
        return False
    try:
        sig = base64.b64decode(sig_b64)
        pk.verify(sig, canonical_bytes(payload))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


# --------------------------------------------------------------------------
# AES-256-GCM envelope (obfuscation layer)
# --------------------------------------------------------------------------
MAGIC = b"QPLIC\x01"  # 6 bytes


def wrap_license(payload: dict) -> bytes:
    """Encrypts the signed payload with AES-256-GCM and prepends a magic."""
    plaintext = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    key = _aes_key()
    aes = AESGCM(key)
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, plaintext, MAGIC)
    return MAGIC + nonce + ct


def unwrap_license(raw: bytes) -> dict:
    """Inverse of wrap_license. Falls back to plain JSON for backwards-compat."""
    # Allow plain-JSON .lic files as well (handy for dev/admin tooling)
    txt = raw.lstrip()
    if txt.startswith(b"{"):
        return json.loads(txt.decode("utf-8"))
    if not raw.startswith(MAGIC):
        raise ValueError("Format de licence non reconnu")
    if len(raw) < len(MAGIC) + 12 + 16:
        raise ValueError("Licence tronquée")
    nonce = raw[len(MAGIC):len(MAGIC) + 12]
    ct = raw[len(MAGIC) + 12:]
    key = _aes_key()
    aes = AESGCM(key)
    plaintext = aes.decrypt(nonce, ct, MAGIC)
    return json.loads(plaintext.decode("utf-8"))


# --------------------------------------------------------------------------
# High-level verification
# --------------------------------------------------------------------------
def verify_full(payload: dict, expected_fingerprint: Optional[str] = None) -> dict:
    """Returns dict with status: 'valid' / 'expired' / 'invalid' + reason + days_left."""
    if not verify_signature(payload):
        return {"status": "invalid", "reason": "Signature invalide"}
    fp = expected_fingerprint or compute_fingerprint()
    license_fp = payload.get("machineFingerprint")
    if license_fp and license_fp != fp:
        return {
            "status": "invalid",
            "reason": f"Empreinte machine ne correspond pas (attendu {fp})",
        }
    exp_str = payload.get("expirationDate")
    if not exp_str:
        return {"status": "invalid", "reason": "Date d'expiration absente"}
    try:
        exp = datetime.fromisoformat(exp_str).replace(tzinfo=timezone.utc) \
            if "T" not in exp_str \
            else datetime.fromisoformat(exp_str)
    except ValueError:
        try:
            exp = datetime.strptime(exp_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return {"status": "invalid", "reason": "Format de date invalide"}
    now = datetime.now(timezone.utc)
    days_left = (exp - now).days
    if days_left < 0:
        return {"status": "expired", "reason": "Licence expirée", "days_left": days_left}
    return {"status": "valid", "days_left": days_left, "expires_at": exp.isoformat()}


# --------------------------------------------------------------------------
# Utility for CLI generator
# --------------------------------------------------------------------------
def build_license(
    *,
    license_number: str,
    company: str,
    fingerprint: str,
    expiration_date: str,
    edition: str = "Business",
    client_name: Optional[str] = None,
    max_users: int = 5,
    max_workstations: int = 1,
    activation_date: Optional[str] = None,
) -> dict:
    return {
        "licenseNumber": license_number,
        "company": company,
        "clientName": client_name or "",
        "edition": edition,
        "maxUsers": max_users,
        "maxWorkstations": max_workstations,
        "activationDate": activation_date
        or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "expirationDate": expiration_date,
        "machineFingerprint": fingerprint,
    }


__all__ = [
    "compute_fingerprint",
    "load_public_key",
    "load_private_key",
    "sign_payload",
    "verify_signature",
    "verify_full",
    "wrap_license",
    "unwrap_license",
    "build_license",
    "SIGNED_FIELDS",
]
