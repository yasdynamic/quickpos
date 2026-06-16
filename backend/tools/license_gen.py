#!/usr/bin/env python3
"""WARYA — License generator CLI (publisher-side tool).

Usage examples
--------------

    # Generate a license for a client (interactive)
    python license_gen.py

    # Generate a license non-interactively
    python license_gen.py \
        --license-number POS-2026-000042 \
        --company "Boutique Diarra" \
        --client-name "Aïcha Diarra" \
        --fingerprint POS-7D5A-A1C9-6F82 \
        --edition Business \
        --max-users 5 \
        --expires 2027-12-31 \
        --out license.lic

The CLI signs the payload with the Ed25519 private key
(/app/backend/.secrets/private_ed25519.pem) and writes an AES-256-GCM
encrypted `.lic` file that the customer can drag-and-drop into the app.

Keep the private key offline and never commit it.
"""

from __future__ import annotations

import argparse
import datetime as dt
import getpass
import json
import sys
import uuid
from pathlib import Path

THIS = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS.parent))

from licensing import (  # noqa: E402
    build_license,
    load_private_key,
    sign_payload,
    verify_signature,
    wrap_license,
)


def parse_args():
    p = argparse.ArgumentParser(description="WARYA license generator")
    p.add_argument("--license-number")
    p.add_argument("--company")
    p.add_argument("--client-name", default="")
    p.add_argument("--fingerprint", help="Machine fingerprint POS-XXXX-XXXX-XXXX")
    p.add_argument("--edition", default="Business",
                   choices=["Starter", "Business", "Pro", "Enterprise", "Demo"])
    p.add_argument("--max-users", type=int, default=5)
    p.add_argument("--max-workstations", type=int, default=1)
    p.add_argument("--expires", help="YYYY-MM-DD")
    p.add_argument("--years", type=int, help="Shortcut: expires in N years")
    p.add_argument("--out", default=None, help="Output path (.lic). Default: <licenseNumber>.lic")
    p.add_argument("--plain", action="store_true", help="Write plain signed JSON (no AES wrap)")
    return p.parse_args()


def prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{label}{suffix}: ").strip()
    return val or default


def main() -> int:
    args = parse_args()

    license_number = args.license_number or prompt(
        "Numéro de licence", f"POS-{dt.date.today().year}-{uuid.uuid4().hex[:6].upper()}"
    )
    company = args.company or prompt("Nom de l'entreprise cliente")
    if not company:
        print("ERROR: --company requis", file=sys.stderr)
        return 2
    client_name = args.client_name or prompt("Nom du contact (optionnel)", "")
    fingerprint = args.fingerprint or prompt("Empreinte machine (POS-XXXX-XXXX-XXXX)")
    if not fingerprint:
        print("ERROR: --fingerprint requis", file=sys.stderr)
        return 2

    if args.years and not args.expires:
        target = dt.date.today() + dt.timedelta(days=365 * args.years)
        expires = target.isoformat()
    else:
        expires = args.expires or prompt(
            "Date d'expiration (YYYY-MM-DD)",
            (dt.date.today() + dt.timedelta(days=365)).isoformat(),
        )

    payload = build_license(
        license_number=license_number,
        company=company,
        client_name=client_name,
        fingerprint=fingerprint,
        edition=args.edition,
        max_users=args.max_users,
        max_workstations=args.max_workstations,
        expiration_date=expires,
    )

    try:
        priv = load_private_key()
    except FileNotFoundError:
        print("ERROR: private key not found at "
              ".secrets/private_ed25519.pem", file=sys.stderr)
        return 3

    signed = sign_payload(payload, priv)
    assert verify_signature(signed), "self-check failed: signature invalid right after signing"

    out_path = Path(args.out or f"{license_number}.lic")
    if args.plain:
        out_path.write_text(json.dumps(signed, indent=2, ensure_ascii=False))
    else:
        out_path.write_bytes(wrap_license(signed))

    print("=" * 60)
    print(f"  Licence générée : {out_path}")
    print(f"  Client         : {company} ({client_name or '—'})")
    print(f"  Edition        : {args.edition}  /  Users: {args.max_users}")
    print(f"  Empreinte      : {fingerprint}")
    print(f"  Expire         : {expires}")
    print(f"  Format         : {'JSON signé en clair' if args.plain else 'JSON signé + AES-256-GCM'}")
    print(f"  Editeur        : {getpass.getuser()}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
