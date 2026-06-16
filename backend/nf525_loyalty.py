"""NF525 compliance + Loyalty extensions for QuickPOS.

Imported by server.py at the bottom; defines models, helpers and routes
attached to the existing `api_router` and `db`.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

# --- These will be set by server.py once it imports this module
db = None  # type: ignore
api_router: APIRouter = None  # type: ignore


def _new_id() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------ NF525

JournalEntryType = Literal[
    "TICKET", "REFUND", "CANCEL", "Z", "X", "PARAM", "LOGIN", "USER"
]


class JournalEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_new_id)
    seq: int
    year: int
    type: JournalEntryType
    ref_id: Optional[str] = None
    payload: dict = {}
    hash_prev: str
    hash_current: str
    signed_at: str = Field(default_factory=_now_iso)


def _hash_entry(seq: int, year: int, type_: str, ref_id: Optional[str], payload: dict, prev_hash: str, signed_at: str) -> str:
    body = json.dumps(
        {
            "seq": seq,
            "year": year,
            "type": type_,
            "ref_id": ref_id or "",
            "payload": payload,
            "prev": prev_hash,
            "at": signed_at,
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


async def _next_seq(year: int) -> int:
    res = await db.counters.find_one_and_update(
        {"_id": f"nf525-{year}"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    return res["value"]


async def _last_hash(year: int) -> str:
    cursor = db.journal.find({"year": year}, {"_id": 0, "hash_current": 1}).sort("seq", -1).limit(1)
    docs = await cursor.to_list(1)
    if not docs:
        return "0" * 64  # genesis
    return docs[0]["hash_current"]


async def append_journal(type_: JournalEntryType, ref_id: Optional[str], payload: dict) -> dict:
    """Append an immutable, hash-chained entry. Returns the entry."""
    year = datetime.now(timezone.utc).year
    seq = await _next_seq(year)
    prev_hash = await _last_hash(year)
    signed_at = _now_iso()
    current = _hash_entry(seq, year, type_, ref_id, payload, prev_hash, signed_at)
    entry = JournalEntry(
        seq=seq,
        year=year,
        type=type_,
        ref_id=ref_id,
        payload=payload,
        hash_prev=prev_hash,
        hash_current=current,
        signed_at=signed_at,
    ).model_dump()
    await db.journal.insert_one(entry)
    return entry


def register_routes():
    @api_router.get("/journal")
    async def list_journal(
        year: Optional[int] = None,
        type: Optional[str] = None,
        limit: int = Query(default=100, le=500),
    ):
        q: dict = {}
        if year:
            q["year"] = year
        if type:
            q["type"] = type
        cursor = db.journal.find(q, {"_id": 0}).sort("seq", -1).limit(limit)
        return await cursor.to_list(limit)

    @api_router.post("/journal/verify")
    async def verify_journal(year: Optional[int] = None):
        target_year = year or datetime.now(timezone.utc).year
        cursor = db.journal.find({"year": target_year}, {"_id": 0}).sort("seq", 1)
        entries = await cursor.to_list(100000)
        if not entries:
            return {"year": target_year, "count": 0, "valid": True}
        prev = "0" * 64
        expected_seq = 1
        for e in entries:
            if e["seq"] != expected_seq:
                return {
                    "year": target_year,
                    "valid": False,
                    "error": f"Gap in sequence: expected {expected_seq}, found {e['seq']}",
                    "at_seq": e["seq"],
                }
            if e["hash_prev"] != prev:
                return {
                    "year": target_year,
                    "valid": False,
                    "error": "Chain break (prev hash mismatch)",
                    "at_seq": e["seq"],
                }
            recomputed = _hash_entry(
                e["seq"], e["year"], e["type"], e.get("ref_id"), e["payload"], e["hash_prev"], e["signed_at"]
            )
            if recomputed != e["hash_current"]:
                return {
                    "year": target_year,
                    "valid": False,
                    "error": "Hash mismatch (entry tampered)",
                    "at_seq": e["seq"],
                }
            prev = e["hash_current"]
            expected_seq += 1
        return {
            "year": target_year,
            "count": len(entries),
            "valid": True,
            "last_seq": entries[-1]["seq"],
            "last_hash": entries[-1]["hash_current"],
        }

    @api_router.get("/journal/summary")
    async def journal_summary():
        year = datetime.now(timezone.utc).year
        count = await db.journal.count_documents({"year": year})
        last = await db.journal.find({"year": year}, {"_id": 0, "seq": 1, "hash_current": 1, "signed_at": 1}).sort("seq", -1).limit(1).to_list(1)
        return {
            "year": year,
            "count": count,
            "last_seq": last[0]["seq"] if last else 0,
            "last_hash": last[0]["hash_current"] if last else None,
            "last_signed_at": last[0]["signed_at"] if last else None,
        }

    # ----- Customers -----------------------------------------------------
    @api_router.get("/customers")
    async def list_customers(search: Optional[str] = None, limit: int = Query(100, le=500)):
        q: dict = {}
        if search:
            esc = search.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replace(".", "\\.")
            q["$or"] = [
                {"name": {"$regex": esc, "$options": "i"}},
                {"phone": {"$regex": esc}},
                {"email": {"$regex": esc, "$options": "i"}},
            ]
        cursor = db.customers.find(q, {"_id": 0}).sort("name", 1).limit(limit)
        return await cursor.to_list(limit)

    @api_router.get("/customers/{customer_id}")
    async def get_customer(customer_id: str):
        c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Client introuvable")
        return c

    @api_router.post("/customers")
    async def create_customer(payload: dict):
        phone = (payload.get("phone") or "").strip()
        if phone and await db.customers.find_one({"phone": phone}):
            raise HTTPException(400, "Ce numéro de téléphone existe déjà")
        c = {
            "id": _new_id(),
            "name": (payload.get("name") or "").strip(),
            "phone": phone,
            "email": (payload.get("email") or "").strip().lower() or None,
            "loyalty_points": 0,
            "total_spent": 0.0,
            "visits": 0,
            "created_at": _now_iso(),
        }
        if not c["name"]:
            raise HTTPException(400, "Nom requis")
        await db.customers.insert_one(c)
        return {k: v for k, v in c.items() if k != "_id"}

    @api_router.put("/customers/{customer_id}")
    async def update_customer(customer_id: str, payload: dict):
        update = {}
        for k in ("name", "phone", "email"):
            if k in payload:
                update[k] = (payload[k] or "").strip() if payload[k] else None
        if "phone" in update and update["phone"]:
            clash = await db.customers.find_one({"phone": update["phone"], "id": {"$ne": customer_id}})
            if clash:
                raise HTTPException(400, "Ce numéro existe déjà")
        if not update:
            raise HTTPException(400, "Aucune modification fournie")
        res = await db.customers.update_one({"id": customer_id}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(404, "Client introuvable")
        return await db.customers.find_one({"id": customer_id}, {"_id": 0})

    @api_router.delete("/customers/{customer_id}")
    async def delete_customer(customer_id: str):
        res = await db.customers.delete_one({"id": customer_id})
        if res.deleted_count == 0:
            raise HTTPException(404, "Client introuvable")
        return {"ok": True}

    @api_router.post("/customers/{customer_id}/points/adjust")
    async def adjust_points(customer_id: str, payload: dict):
        delta = int(payload.get("delta", 0))
        reason = payload.get("reason", "manual")
        c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Client introuvable")
        new_points = max(0, int(c.get("loyalty_points", 0)) + delta)
        await db.customers.update_one(
            {"id": customer_id},
            {"$set": {"loyalty_points": new_points}},
        )
        await db.point_transactions.insert_one(
            {
                "id": _new_id(),
                "customer_id": customer_id,
                "delta": delta,
                "reason": reason,
                "created_at": _now_iso(),
            }
        )
        return {"loyalty_points": new_points}


async def apply_loyalty_on_sale(sale: dict) -> Optional[dict]:
    """If sale has a customer_id, award points based on settings.loyalty.
    Returns the updated customer or None."""
    customer_id = sale.get("customer_id")
    if not customer_id:
        return None
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        return None
    settings_doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    loyalty = (settings_doc or {}).get("loyalty") or {}
    if not loyalty.get("enabled", False):
        return None
    rate = float(loyalty.get("points_per_currency", 1.0))  # points per 1 unit currency spent
    points_earned = int(sale.get("total", 0) * rate)
    update = {
        "loyalty_points": int(customer.get("loyalty_points", 0)) + points_earned,
        "total_spent": round(float(customer.get("total_spent", 0)) + float(sale.get("total", 0)), 2),
        "visits": int(customer.get("visits", 0)) + 1,
        "last_visit_at": _now_iso(),
    }
    await db.customers.update_one({"id": customer_id}, {"$set": update})
    await db.point_transactions.insert_one(
        {
            "id": _new_id(),
            "customer_id": customer_id,
            "delta": points_earned,
            "reason": "sale",
            "sale_id": sale.get("id"),
            "created_at": _now_iso(),
        }
    )
    return {**customer, **update, "points_earned": points_earned}
