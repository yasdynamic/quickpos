"""QuickPOS backend - lightweight point of sale API."""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Literal, Optional

import resend
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- Configuration -------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
REPORT_EMAIL = os.environ.get("REPORT_EMAIL", "")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="QuickPOS API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# --- Helpers -------------------------------------------------------------
PaymentMethod = Literal["cash", "card", "mobile"]
PAYMENT_LABELS = {"cash": "Espèces", "card": "Carte", "mobile": "Mobile Money"}


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def day_bounds(target: date) -> tuple[str, str]:
    start = datetime.combine(target, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start.isoformat(), end.isoformat()


def month_bounds(year: int, month: int) -> tuple[str, str]:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year + (month // 12), (month % 12) + 1, 1, tzinfo=timezone.utc)
    return start.isoformat(), end.isoformat()


# --- Models --------------------------------------------------------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    pin: str  # 4 digit
    role: Literal["admin", "cashier"] = "cashier"
    created_at: str = Field(default_factory=now_iso)


class UserCreate(BaseModel):
    name: str
    pin: str = Field(min_length=4, max_length=6)
    role: Literal["admin", "cashier"] = "cashier"


class LoginRequest(BaseModel):
    pin: str


class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    color: str = "#002FA7"
    icon: str = "Package"


class CategoryCreate(BaseModel):
    name: str
    color: str = "#002FA7"
    icon: str = "Package"


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    price: float
    category_id: str
    stock: int = 0
    track_stock: bool = True
    image_url: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    price: float
    category_id: str
    stock: int = 0
    track_stock: bool = True
    image_url: Optional[str] = None


class CartLine(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int


class SaleCreate(BaseModel):
    items: List[CartLine]
    payment_method: PaymentMethod
    amount_received: Optional[float] = None
    cashier_id: Optional[str] = None
    cashier_name: Optional[str] = None


class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    ticket_number: int
    items: List[CartLine]
    subtotal: float
    total: float
    payment_method: PaymentMethod
    amount_received: Optional[float] = None
    change_due: Optional[float] = None
    cashier_id: Optional[str] = None
    cashier_name: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class SendReportRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None
    target_date: Optional[str] = None  # YYYY-MM-DD


class SendMonthlyRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None
    year: int
    month: int


# --- DB helpers ----------------------------------------------------------
async def next_ticket_number() -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    res = await db.counters.find_one_and_update(
        {"_id": f"ticket-{today}"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    return res["value"]


async def get_categories_map() -> dict:
    cats = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return {c["id"]: c for c in cats}


# --- Seed ----------------------------------------------------------------
@app.on_event("startup")
async def seed_data() -> None:
    if await db.users.count_documents({}) == 0:
        admin = User(name="Admin", pin="1234", role="admin")
        await db.users.insert_one(admin.model_dump())
        logger.info("Seeded default admin PIN=1234")

    if await db.categories.count_documents({}) == 0:
        cats = [
            Category(name="Boissons", color="#0EA5E9", icon="Coffee"),
            Category(name="Plats", color="#F97316", icon="UtensilsCrossed"),
            Category(name="Desserts", color="#EC4899", icon="Cake"),
            Category(name="Épicerie", color="#10B981", icon="ShoppingBasket"),
        ]
        await db.categories.insert_many([c.model_dump() for c in cats])
        prods = [
            Product(name="Café Espresso", price=1.50, category_id=cats[0].id, stock=200),
            Product(name="Cappuccino", price=2.80, category_id=cats[0].id, stock=150),
            Product(name="Jus d'orange", price=3.00, category_id=cats[0].id, stock=80),
            Product(name="Eau minérale", price=1.00, category_id=cats[0].id, stock=300),
            Product(name="Sandwich poulet", price=5.50, category_id=cats[1].id, stock=40),
            Product(name="Salade César", price=7.20, category_id=cats[1].id, stock=25),
            Product(name="Pizza Margherita", price=8.50, category_id=cats[1].id, stock=20),
            Product(name="Tiramisu", price=4.00, category_id=cats[2].id, stock=30),
            Product(name="Brownie", price=3.20, category_id=cats[2].id, stock=35),
            Product(name="Chocolat noir 100g", price=2.50, category_id=cats[3].id, stock=60),
            Product(name="Biscuits", price=1.80, category_id=cats[3].id, stock=100),
        ]
        await db.products.insert_many([p.model_dump() for p in prods])
        logger.info("Seeded sample categories and products")


# --- Auth ----------------------------------------------------------------
@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user_doc = await db.users.find_one({"pin": req.pin}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="PIN incorrect")
    return {
        "id": user_doc["id"],
        "name": user_doc["name"],
        "role": user_doc["role"],
    }


@api_router.get("/users")
async def list_users():
    users = await db.users.find({}, {"_id": 0, "pin": 0}).to_list(1000)
    return users


@api_router.post("/users")
async def create_user(payload: UserCreate):
    if await db.users.find_one({"pin": payload.pin}):
        raise HTTPException(status_code=400, detail="Ce code PIN existe déjà")
    user = User(**payload.model_dump())
    await db.users.insert_one(user.model_dump())
    return {"id": user.id, "name": user.name, "role": user.role}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {"ok": True}


# --- Categories ----------------------------------------------------------
@api_router.get("/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/categories")
async def create_category(payload: CategoryCreate):
    cat = Category(**payload.model_dump())
    await db.categories.insert_one(cat.model_dump())
    return cat


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryCreate):
    res = await db.categories.update_one({"id": cat_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    if await db.products.count_documents({"category_id": cat_id}) > 0:
        raise HTTPException(status_code=400, detail="Catégorie utilisée par des produits")
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    return {"ok": True}


# --- Products ------------------------------------------------------------
@api_router.get("/products")
async def list_products(category_id: Optional[str] = None):
    q: dict = {}
    if category_id:
        q["category_id"] = category_id
    return await db.products.find(q, {"_id": 0}).to_list(1000)


@api_router.post("/products")
async def create_product(payload: ProductCreate):
    if not await db.categories.find_one({"id": payload.category_id}):
        raise HTTPException(status_code=400, detail="Catégorie inconnue")
    p = Product(**payload.model_dump())
    await db.products.insert_one(p.model_dump())
    return p


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, payload: ProductCreate):
    res = await db.products.update_one({"id": product_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return {"ok": True}


# --- Sales ---------------------------------------------------------------
@api_router.post("/sales")
async def create_sale(payload: SaleCreate):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Panier vide")

    subtotal = round(sum(line.price * line.quantity for line in payload.items), 2)
    total = subtotal
    change_due = None
    if payload.payment_method == "cash" and payload.amount_received is not None:
        change_due = round(payload.amount_received - total, 2)

    # Decrement stock
    for line in payload.items:
        product = await db.products.find_one({"id": line.product_id}, {"_id": 0})
        if not product:
            continue
        if product.get("track_stock", True):
            new_stock = max(0, int(product.get("stock", 0)) - line.quantity)
            await db.products.update_one(
                {"id": line.product_id}, {"$set": {"stock": new_stock}}
            )

    sale = Sale(
        ticket_number=await next_ticket_number(),
        items=payload.items,
        subtotal=subtotal,
        total=total,
        payment_method=payload.payment_method,
        amount_received=payload.amount_received,
        change_due=change_due,
        cashier_id=payload.cashier_id,
        cashier_name=payload.cashier_name,
    )
    doc = sale.model_dump()
    await db.sales.insert_one(doc)
    return sale


@api_router.get("/sales")
async def list_sales(
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    limit: int = 200,
):
    q: dict = {}
    if target_date:
        try:
            d = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Date invalide (YYYY-MM-DD)")
        start, end = day_bounds(d)
        q["created_at"] = {"$gte": start, "$lt": end}
    cursor = db.sales.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(limit)


# --- Dashboard / Reports -------------------------------------------------
async def _aggregate_range(start_iso: str, end_iso: str) -> dict:
    sales = await db.sales.find(
        {"created_at": {"$gte": start_iso, "$lt": end_iso}}, {"_id": 0}
    ).to_list(10000)

    total_revenue = 0.0
    by_payment = defaultdict(float)
    by_hour = defaultdict(float)
    by_day = defaultdict(float)
    by_category = defaultdict(float)
    top_products: dict = defaultdict(lambda: {"name": "", "qty": 0, "revenue": 0.0})

    cats = await get_categories_map()
    prods = await db.products.find({}, {"_id": 0}).to_list(2000)
    product_to_cat = {p["id"]: p.get("category_id") for p in prods}

    for s in sales:
        total_revenue += s["total"]
        by_payment[s["payment_method"]] += s["total"]
        dt = datetime.fromisoformat(s["created_at"])
        by_hour[dt.hour] += s["total"]
        by_day[dt.date().isoformat()] += s["total"]
        for line in s["items"]:
            cat_id = product_to_cat.get(line["product_id"])
            cat_name = cats.get(cat_id, {}).get("name", "Autre")
            line_total = line["price"] * line["quantity"]
            by_category[cat_name] += line_total
            tp = top_products[line["product_id"]]
            tp["name"] = line["name"]
            tp["qty"] += line["quantity"]
            tp["revenue"] += line_total

    num_sales = len(sales)
    avg_ticket = total_revenue / num_sales if num_sales else 0.0
    top_list = sorted(top_products.values(), key=lambda x: x["revenue"], reverse=True)[:10]

    return {
        "total_revenue": round(total_revenue, 2),
        "num_sales": num_sales,
        "avg_ticket": round(avg_ticket, 2),
        "by_payment": {k: round(v, 2) for k, v in by_payment.items()},
        "by_hour": [
            {"hour": h, "revenue": round(by_hour.get(h, 0.0), 2)} for h in range(24)
        ],
        "by_day": [
            {"day": d, "revenue": round(r, 2)}
            for d, r in sorted(by_day.items())
        ],
        "by_category": [
            {"category": k, "revenue": round(v, 2)} for k, v in by_category.items()
        ],
        "top_products": [
            {"name": v["name"], "qty": v["qty"], "revenue": round(v["revenue"], 2)}
            for v in top_list
        ],
    }


@api_router.get("/dashboard")
async def dashboard(target_date: Optional[str] = None):
    d = date.fromisoformat(target_date) if target_date else datetime.now(timezone.utc).date()
    start, end = day_bounds(d)
    data = await _aggregate_range(start, end)
    data["date"] = d.isoformat()
    return data


@api_router.get("/reports/daily")
async def daily_report(target_date: Optional[str] = None):
    d = date.fromisoformat(target_date) if target_date else datetime.now(timezone.utc).date()
    start, end = day_bounds(d)
    data = await _aggregate_range(start, end)
    data["date"] = d.isoformat()
    return data


@api_router.get("/reports/monthly")
async def monthly_report(
    year: int = Query(..., ge=2000, le=3000),
    month: int = Query(..., ge=1, le=12),
):
    start, end = month_bounds(year, month)
    data = await _aggregate_range(start, end)
    data["year"] = year
    data["month"] = month
    return data


# --- Email ---------------------------------------------------------------
def _format_currency(value: float) -> str:
    return f"{value:,.2f} €".replace(",", " ").replace(".", ",")


def _build_daily_html(data: dict) -> str:
    rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{PAYMENT_LABELS.get(k, k)}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{_format_currency(v)}</td></tr>"
        for k, v in data.get("by_payment", {}).items()
    ) or "<tr><td colspan='2' style='padding:8px'>Aucune vente.</td></tr>"

    cat_rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{c['category']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{_format_currency(c['revenue'])}</td></tr>"
        for c in data.get("by_category", [])
    ) or "<tr><td colspan='2' style='padding:8px'>—</td></tr>"

    top_rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{p['name']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{p['qty']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{_format_currency(p['revenue'])}</td></tr>"
        for p in data.get("top_products", [])[:5]
    ) or "<tr><td colspan='3' style='padding:8px'>—</td></tr>"

    return f"""
    <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0A0A0A'>
      <h1 style='color:#002FA7;margin-bottom:4px'>Clôture journalière</h1>
      <p style='color:#4B5563;margin-top:0'>Date : <strong>{data.get('date', '')}</strong></p>
      <table style='width:100%;border-collapse:collapse;margin-top:16px'>
        <tr><td style='padding:12px;background:#F4F6FB;font-weight:bold'>Chiffre d'affaires</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right;font-weight:bold;color:#002FA7'>{_format_currency(data.get('total_revenue', 0))}</td></tr>
        <tr><td style='padding:12px'>Nombre de ventes</td>
            <td style='padding:12px;text-align:right'>{data.get('num_sales', 0)}</td></tr>
        <tr><td style='padding:12px;background:#F4F6FB'>Panier moyen</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right'>{_format_currency(data.get('avg_ticket', 0))}</td></tr>
      </table>
      <h2 style='margin-top:24px;color:#0A0A0A'>Par moyen de paiement</h2>
      <table style='width:100%;border-collapse:collapse'>{rows}</table>
      <h2 style='margin-top:24px;color:#0A0A0A'>Par catégorie</h2>
      <table style='width:100%;border-collapse:collapse'>{cat_rows}</table>
      <h2 style='margin-top:24px;color:#0A0A0A'>Top 5 produits</h2>
      <table style='width:100%;border-collapse:collapse'>
        <tr><th align='left' style='padding:8px;border-bottom:2px solid #E5E7EB'>Produit</th>
            <th align='right' style='padding:8px;border-bottom:2px solid #E5E7EB'>Qté</th>
            <th align='right' style='padding:8px;border-bottom:2px solid #E5E7EB'>CA</th></tr>
        {top_rows}
      </table>
      <p style='margin-top:32px;color:#9CA3AF;font-size:12px'>QuickPOS · Rapport automatique</p>
    </div>
    """


def _build_monthly_html(data: dict) -> str:
    day_rows = "".join(
        f"<tr><td style='padding:6px;border-bottom:1px solid #eee'>{d['day']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #eee;text-align:right'>{_format_currency(d['revenue'])}</td></tr>"
        for d in data.get("by_day", [])
    ) or "<tr><td colspan='2' style='padding:8px'>Aucune vente.</td></tr>"
    return f"""
    <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0A0A0A'>
      <h1 style='color:#002FA7'>État mensuel</h1>
      <p style='color:#4B5563'>{data.get('month'):02d}/{data.get('year')}</p>
      <table style='width:100%;border-collapse:collapse;margin-top:16px'>
        <tr><td style='padding:12px;background:#F4F6FB;font-weight:bold'>Chiffre d'affaires</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right;font-weight:bold;color:#002FA7'>{_format_currency(data.get('total_revenue', 0))}</td></tr>
        <tr><td style='padding:12px'>Nombre de ventes</td>
            <td style='padding:12px;text-align:right'>{data.get('num_sales', 0)}</td></tr>
        <tr><td style='padding:12px;background:#F4F6FB'>Panier moyen</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right'>{_format_currency(data.get('avg_ticket', 0))}</td></tr>
      </table>
      <h2 style='margin-top:24px'>Détail journalier</h2>
      <table style='width:100%;border-collapse:collapse'>{day_rows}</table>
      <p style='margin-top:32px;color:#9CA3AF;font-size:12px'>QuickPOS · Rapport automatique</p>
    </div>
    """


async def _send_email(to: str, subject: str, html: str) -> dict:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY non configurée, email simulé.")
        return {"status": "skipped", "reason": "RESEND_API_KEY non configurée"}
    if not to:
        raise HTTPException(status_code=400, detail="Aucun destinataire fourni")
    params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "email_id": result.get("id"), "to": to}
    except Exception as exc:
        logger.exception("Resend error")
        raise HTTPException(status_code=500, detail=f"Échec envoi: {exc}")


@api_router.post("/reports/daily/send")
async def send_daily(payload: SendReportRequest):
    d = date.fromisoformat(payload.target_date) if payload.target_date else datetime.now(timezone.utc).date()
    start, end = day_bounds(d)
    data = await _aggregate_range(start, end)
    data["date"] = d.isoformat()
    html = _build_daily_html(data)
    recipient = payload.recipient_email or REPORT_EMAIL
    result = await _send_email(recipient, f"QuickPOS · Clôture {d.isoformat()}", html)

    # Persist closure
    closure = {
        "id": new_id(),
        "date": d.isoformat(),
        "data": data,
        "email_status": result,
        "created_at": now_iso(),
    }
    await db.closures.insert_one(closure)
    return {"report": data, "email": result}


@api_router.post("/reports/monthly/send")
async def send_monthly(payload: SendMonthlyRequest):
    start, end = month_bounds(payload.year, payload.month)
    data = await _aggregate_range(start, end)
    data["year"] = payload.year
    data["month"] = payload.month
    html = _build_monthly_html(data)
    recipient = payload.recipient_email or REPORT_EMAIL
    result = await _send_email(
        recipient, f"QuickPOS · Rapport mensuel {payload.month:02d}/{payload.year}", html
    )
    return {"report": data, "email": result}


@api_router.get("/closures")
async def list_closures(limit: int = 30):
    cursor = db.closures.find({}, {"_id": 0}).sort("date", -1).limit(limit)
    return await cursor.to_list(limit)


@api_router.get("/settings")
async def get_settings():
    return {
        "report_email": REPORT_EMAIL,
        "sender_email": SENDER_EMAIL,
        "email_configured": bool(RESEND_API_KEY),
        "currency": "EUR",
    }


@api_router.get("/")
async def root():
    return {"app": "QuickPOS", "status": "ok"}


# --- App wiring ----------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
