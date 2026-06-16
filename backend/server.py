"""QuickPOS backend - Clyo-style POS with tables, sessions, modifiers, X/Z reports."""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import resend
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

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

PaymentMethod = Literal["cash", "card", "mobile"]
PAYMENT_LABELS = {"cash": "Espèces", "card": "Carte", "mobile": "Mobile Money"}
Role = Literal["admin", "manager", "server"]
ROLE_RANK = {"server": 1, "manager": 2, "admin": 3}


from fastapi import Header  # noqa: E402


async def current_user(x_user_id: Optional[str] = Header(None)) -> Optional[dict]:
    if not x_user_id:
        return None
    return await db.users.find_one({"id": x_user_id}, {"_id": 0, "pin": 0})


def require_role(min_role: Role):
    async def _dep(x_user_id: Optional[str] = Header(None)) -> dict:
        if not x_user_id:
            raise HTTPException(status_code=401, detail="Authentification requise")
        u = await db.users.find_one({"id": x_user_id}, {"_id": 0, "pin": 0})
        if not u:
            raise HTTPException(status_code=401, detail="Utilisateur inconnu")
        if ROLE_RANK.get(u.get("role", "server"), 0) < ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail=f"Rôle {min_role} ou supérieur requis")
        return u
    return _dep


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
    pin: str
    role: Role = "server"
    color: str = "#002FA7"
    created_at: str = Field(default_factory=now_iso)


class UserCreate(BaseModel):
    name: str
    pin: str = Field(min_length=4, max_length=6)
    role: Role = "server"
    color: str = "#002FA7"


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


class ModifierOption(BaseModel):
    name: str
    price_delta: float = 0.0


class ModifierGroup(BaseModel):
    name: str
    options: List[ModifierOption] = []
    required: bool = False
    multi: bool = False  # multi-select


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    price: float
    category_id: str
    stock: int = 0
    track_stock: bool = True
    image_url: Optional[str] = None
    modifiers: List[ModifierGroup] = []
    tva_rate: float = 20.0
    barcode: Optional[str] = None
    sku: Optional[str] = None
    supplier_id: Optional[str] = None
    cost_price: Optional[float] = None
    low_stock_threshold: int = 0
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    price: float
    category_id: str
    stock: int = 0
    track_stock: bool = True
    image_url: Optional[str] = None
    modifiers: List[ModifierGroup] = []
    tva_rate: float = 20.0
    barcode: Optional[str] = None
    sku: Optional[str] = None
    supplier_id: Optional[str] = None
    cost_price: Optional[float] = None
    low_stock_threshold: int = 0


class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    color: str = "#002FA7"


class ZoneCreate(BaseModel):
    name: str
    color: str = "#002FA7"


class Table(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    zone_id: str
    capacity: int = 2
    x: int = 0  # plan position
    y: int = 0


class TableCreate(BaseModel):
    name: str
    zone_id: str
    capacity: int = 2
    x: int = 0
    y: int = 0


class OrderItem(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    name: str
    base_price: float
    quantity: int = 1
    modifiers: List[ModifierOption] = []
    note: Optional[str] = None
    sent: bool = False
    sent_at: Optional[str] = None

    def line_total(self) -> float:
        unit = self.base_price + sum(m.price_delta for m in self.modifiers)
        return round(unit * self.quantity, 2)


class OrderItemAdd(BaseModel):
    product_id: str
    quantity: int = 1
    modifiers: List[ModifierOption] = []
    note: Optional[str] = None


class OrderItemUpdate(BaseModel):
    quantity: Optional[int] = None
    note: Optional[str] = None
    modifiers: Optional[List[ModifierOption]] = None


class OrderDiscount(BaseModel):
    type: Literal["percent", "fixed"] = "percent"
    value: float = 0.0
    reason: Optional[str] = None
    granted_by: Optional[str] = None
    granted_at: str = Field(default_factory=now_iso)


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    table_id: Optional[str] = None
    table_name: Optional[str] = None
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    status: Literal["open", "paid", "cancelled"] = "open"
    items: List[OrderItem] = []
    discount: Optional[OrderDiscount] = None
    opened_at: str = Field(default_factory=now_iso)
    sent_at: Optional[str] = None
    paid_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    sale_id: Optional[str] = None
    session_id: Optional[str] = None
    covers: int = 1  # number of guests


class OrderCreate(BaseModel):
    table_id: Optional[str] = None
    server_id: Optional[str] = None
    covers: int = 1
    label: Optional[str] = None  # for counter holds (no table)


class OrderPay(BaseModel):
    payment_method: PaymentMethod
    amount_received: Optional[float] = None


class CashSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    opening_cash: float = 0.0
    opened_at: str = Field(default_factory=now_iso)
    closed_at: Optional[str] = None
    closing_cash_declared: Optional[float] = None
    expected_cash: Optional[float] = None
    cash_difference: Optional[float] = None
    status: Literal["open", "closed"] = "open"


class OpenSessionRequest(BaseModel):
    server_id: Optional[str] = None
    opening_cash: float = 0.0


class CloseSessionRequest(BaseModel):
    closing_cash_declared: float
    recipient_email: Optional[EmailStr] = None


class CartLine(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    modifiers: List[ModifierOption] = []


class SaleCreate(BaseModel):
    items: List[CartLine]
    payment_method: PaymentMethod
    amount_received: Optional[float] = None
    cashier_id: Optional[str] = None
    cashier_name: Optional[str] = None
    customer_id: Optional[str] = None


class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    ticket_number: int
    items: List[CartLine] = []
    subtotal: float
    discount_amount: float = 0.0
    total: float
    tva_breakdown: dict = {}
    payment_method: PaymentMethod
    amount_received: Optional[float] = None
    change_due: Optional[float] = None
    cashier_id: Optional[str] = None
    cashier_name: Optional[str] = None
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    table_id: Optional[str] = None
    table_name: Optional[str] = None
    order_id: Optional[str] = None
    session_id: Optional[str] = None
    customer_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class SendReportRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None
    target_date: Optional[str] = None


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


async def get_current_session(server_id: Optional[str] = None) -> Optional[dict]:
    q: dict = {"status": "open"}
    if server_id:
        q["server_id"] = server_id
    return await db.cash_sessions.find_one(q, {"_id": 0})


# --- Seed / Migration ----------------------------------------------------
@app.on_event("startup")
async def seed_data() -> None:
    # Migration: default admin PIN from 1234 -> 000000
    await db.users.update_one(
        {"name": "Admin", "pin": "1234"}, {"$set": {"pin": "000000"}}
    )
    # Ensure demo servers exist (idempotent)
    if not await db.users.find_one({"name": "Sophie"}):
        await db.users.insert_one(
            User(name="Sophie", pin="1111", role="server", color="#EC4899").model_dump()
        )
    if not await db.users.find_one({"name": "Marc"}):
        await db.users.insert_one(
            User(name="Marc", pin="2222", role="server", color="#10B981").model_dump()
        )

    if await db.users.count_documents({}) == 0:
        admin = User(name="Admin", pin="000000", role="admin", color="#0A0A0A")
        await db.users.insert_one(admin.model_dump())
        logger.info("Seeded admin (PIN 000000)")

    # Migration: ensure modifiers field on products
    await db.products.update_many(
        {"modifiers": {"$exists": False}}, {"$set": {"modifiers": []}}
    )

    if await db.categories.count_documents({}) == 0:
        cats = [
            Category(name="Boissons", color="#0EA5E9", icon="Coffee"),
            Category(name="Plats", color="#F97316", icon="UtensilsCrossed"),
            Category(name="Desserts", color="#EC4899", icon="Cake"),
            Category(name="Épicerie", color="#10B981", icon="ShoppingBasket"),
        ]
        await db.categories.insert_many([c.model_dump() for c in cats])

        cuisson = ModifierGroup(
            name="Cuisson",
            required=True,
            multi=False,
            options=[
                ModifierOption(name="Saignant", price_delta=0),
                ModifierOption(name="À point", price_delta=0),
                ModifierOption(name="Bien cuit", price_delta=0),
            ],
        )
        supplements = ModifierGroup(
            name="Suppléments",
            multi=True,
            options=[
                ModifierOption(name="Fromage", price_delta=1.0),
                ModifierOption(name="Bacon", price_delta=1.5),
                ModifierOption(name="Œuf", price_delta=1.2),
            ],
        )
        prods = [
            Product(name="Café Espresso", price=1.50, category_id=cats[0].id, stock=200),
            Product(name="Cappuccino", price=2.80, category_id=cats[0].id, stock=150),
            Product(name="Jus d'orange", price=3.00, category_id=cats[0].id, stock=80),
            Product(name="Eau minérale", price=1.00, category_id=cats[0].id, stock=300),
            Product(
                name="Burger maison",
                price=12.50,
                category_id=cats[1].id,
                stock=40,
                modifiers=[cuisson, supplements],
            ),
            Product(name="Salade César", price=11.20, category_id=cats[1].id, stock=25),
            Product(name="Pizza Margherita", price=10.50, category_id=cats[1].id, stock=20),
            Product(name="Steak frites", price=18.00, category_id=cats[1].id, stock=15, modifiers=[cuisson]),
            Product(name="Tiramisu", price=6.00, category_id=cats[2].id, stock=30),
            Product(name="Brownie glacé", price=6.50, category_id=cats[2].id, stock=35),
            Product(name="Chocolat noir 100g", price=2.50, category_id=cats[3].id, stock=60),
            Product(name="Biscuits", price=1.80, category_id=cats[3].id, stock=100),
        ]
        await db.products.insert_many([p.model_dump() for p in prods])

    if await db.zones.count_documents({}) == 0:
        zones = [
            Zone(name="Salle", color="#002FA7"),
            Zone(name="Terrasse", color="#10B981"),
            Zone(name="Bar", color="#F97316"),
        ]
        await db.zones.insert_many([z.model_dump() for z in zones])
        tables = []
        for i in range(1, 7):
            tables.append(Table(name=f"T{i}", zone_id=zones[0].id, capacity=4, x=((i - 1) % 3) * 120, y=((i - 1) // 3) * 120))
        for i in range(1, 5):
            tables.append(Table(name=f"TR{i}", zone_id=zones[1].id, capacity=2, x=((i - 1) % 2) * 120, y=((i - 1) // 2) * 120))
        for i in range(1, 4):
            tables.append(Table(name=f"B{i}", zone_id=zones[2].id, capacity=1, x=(i - 1) * 120, y=0))
        await db.tables.insert_many([t.model_dump() for t in tables])
        logger.info("Seeded zones and tables")


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
        "color": user_doc.get("color", "#002FA7"),
    }


@api_router.get("/users")
async def list_users():
    return await db.users.find({}, {"_id": 0, "pin": 0}).to_list(1000)


@api_router.post("/users")
async def create_user(payload: UserCreate):
    if await db.users.find_one({"pin": payload.pin}):
        raise HTTPException(status_code=400, detail="Ce code PIN existe déjà")
    user = User(**payload.model_dump())
    await db.users.insert_one(user.model_dump())
    return {"id": user.id, "name": user.name, "role": user.role, "color": user.color}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {"ok": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    pin: Optional[str] = Field(default=None, min_length=4, max_length=6)
    role: Optional[Role] = None
    color: Optional[str] = None


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate):
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    update: dict = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.pin is not None:
        clash = await db.users.find_one({"pin": payload.pin, "id": {"$ne": user_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Ce code PIN existe déjà")
        update["pin"] = payload.pin
    if payload.role is not None:
        update["role"] = payload.role
    if payload.color is not None:
        update["color"] = payload.color
    if not update:
        raise HTTPException(status_code=400, detail="Aucune modification fournie")
    await db.users.update_one({"id": user_id}, {"$set": update})
    out = await db.users.find_one({"id": user_id}, {"_id": 0, "pin": 0})
    return out


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


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return doc


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


# --- Zones & Tables ------------------------------------------------------
@api_router.get("/zones")
async def list_zones():
    return await db.zones.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/zones")
async def create_zone(payload: ZoneCreate):
    z = Zone(**payload.model_dump())
    await db.zones.insert_one(z.model_dump())
    return z


@api_router.put("/zones/{zone_id}")
async def update_zone(zone_id: str, payload: ZoneCreate):
    res = await db.zones.update_one({"id": zone_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return await db.zones.find_one({"id": zone_id}, {"_id": 0})


@api_router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str):
    if await db.tables.count_documents({"zone_id": zone_id}) > 0:
        raise HTTPException(status_code=400, detail="Zone utilisée par des tables")
    res = await db.zones.delete_one({"id": zone_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone introuvable")
    return {"ok": True}


@api_router.get("/tables")
async def list_tables():
    tables = await db.tables.find({}, {"_id": 0}).to_list(1000)
    # Attach open order info
    open_orders = await db.orders.find(
        {"status": "open", "table_id": {"$ne": None}}, {"_id": 0}
    ).to_list(2000)
    by_table: dict = {}
    for o in open_orders:
        by_table[o["table_id"]] = o
    for t in tables:
        order = by_table.get(t["id"])
        if order:
            total = _order_total(order)
            t["status"] = "occupied"
            t["order_id"] = order["id"]
            t["order_total"] = total
            t["order_opened_at"] = order.get("opened_at")
            t["server_name"] = order.get("server_name")
            t["covers"] = order.get("covers", 1)
        else:
            t["status"] = "free"
            t["order_id"] = None
            t["order_total"] = 0.0
    return tables


@api_router.post("/tables")
async def create_table(payload: TableCreate):
    if not await db.zones.find_one({"id": payload.zone_id}):
        raise HTTPException(status_code=400, detail="Zone inconnue")
    t = Table(**payload.model_dump())
    await db.tables.insert_one(t.model_dump())
    return t


@api_router.put("/tables/{table_id}")
async def update_table(table_id: str, payload: TableCreate):
    res = await db.tables.update_one({"id": table_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table introuvable")
    return await db.tables.find_one({"id": table_id}, {"_id": 0})


@api_router.delete("/tables/{table_id}")
async def delete_table(table_id: str):
    if await db.orders.count_documents({"table_id": table_id, "status": "open"}) > 0:
        raise HTTPException(status_code=400, detail="Table avec une commande ouverte")
    res = await db.tables.delete_one({"id": table_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Table introuvable")
    return {"ok": True}


# --- Orders --------------------------------------------------------------
def _order_subtotal(order: dict) -> float:
    total = 0.0
    for item in order.get("items", []):
        unit = item["base_price"] + sum(m["price_delta"] for m in item.get("modifiers", []))
        total += unit * item["quantity"]
    return round(total, 2)


def _apply_discount(subtotal: float, discount: Optional[dict]) -> float:
    if not discount or not discount.get("value"):
        return 0.0
    val = float(discount["value"])
    if discount.get("type") == "percent":
        return round(subtotal * min(val, 100) / 100.0, 2)
    return round(min(val, subtotal), 2)


def _order_total(order: dict) -> float:
    sub = _order_subtotal(order)
    disc = _apply_discount(sub, order.get("discount"))
    return round(sub - disc, 2)


async def _compute_tva_breakdown(items: List[dict]) -> dict:
    """Returns {rate_str: {ht, tva, ttc}} from cart lines using product TVA rates."""
    out: dict = {}
    prod_cache: dict = {}
    for it in items:
        pid = it.get("product_id")
        if pid and pid not in prod_cache:
            prod_cache[pid] = await db.products.find_one({"id": pid}, {"_id": 0}) or {}
        rate = float(prod_cache.get(pid, {}).get("tva_rate", 20.0))
        ttc = float(it.get("price", 0)) * int(it.get("quantity", 1))
        ht = round(ttc / (1 + rate / 100.0), 2)
        tva = round(ttc - ht, 2)
        key = f"{rate}"
        cur = out.setdefault(key, {"ht": 0.0, "tva": 0.0, "ttc": 0.0})
        cur["ht"] = round(cur["ht"] + ht, 2)
        cur["tva"] = round(cur["tva"] + tva, 2)
        cur["ttc"] = round(cur["ttc"] + ttc, 2)
    return out


async def _persist_order(order: dict) -> dict:
    await db.orders.replace_one({"id": order["id"]}, order)
    return order


@api_router.get("/orders")
async def list_orders(status: Optional[str] = None, table_id: Optional[str] = None):
    q: dict = {}
    if status:
        q["status"] = status
    if table_id:
        q["table_id"] = table_id
    cursor = db.orders.find(q, {"_id": 0}).sort("opened_at", -1).limit(500)
    items = await cursor.to_list(500)
    for o in items:
        o["total"] = _order_total(o)
    return items


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    o["total"] = _order_total(o)
    return o


@api_router.post("/orders")
async def create_order(payload: OrderCreate):
    await _require_open_session_or_400()
    server = None
    if payload.server_id:
        server = await db.users.find_one({"id": payload.server_id}, {"_id": 0, "pin": 0})
    table_name = None
    if payload.table_id:
        # Check no other open order on this table
        existing = await db.orders.find_one(
            {"table_id": payload.table_id, "status": "open"}, {"_id": 0}
        )
        if existing:
            existing["total"] = _order_total(existing)
            return existing
        table = await db.tables.find_one({"id": payload.table_id}, {"_id": 0})
        if not table:
            raise HTTPException(status_code=404, detail="Table introuvable")
        table_name = table["name"]
    elif payload.label:
        # Counter hold: free-form label
        table_name = payload.label.strip()[:60] or None

    session = await get_current_session()

    o = Order(
        table_id=payload.table_id,
        table_name=table_name,
        server_id=payload.server_id,
        server_name=server["name"] if server else None,
        session_id=session["id"] if session else None,
        covers=payload.covers,
    )
    await db.orders.insert_one(o.model_dump())
    out = o.model_dump()
    out["total"] = 0.0
    return out


@api_router.post("/orders/{order_id}/items")
async def add_item(order_id: str, payload: OrderItemAdd):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["status"] != "open":
        raise HTTPException(status_code=400, detail="Commande non ouverte")
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    item = OrderItem(
        product_id=product["id"],
        name=product["name"],
        base_price=product["price"],
        quantity=payload.quantity,
        modifiers=payload.modifiers,
        note=payload.note,
    )
    order.setdefault("items", []).append(item.model_dump())
    await _persist_order(order)
    order["total"] = _order_total(order)
    return order


@api_router.put("/orders/{order_id}/items/{item_id}")
async def update_item(order_id: str, item_id: str, payload: OrderItemUpdate):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    items = order.get("items", [])
    for it in items:
        if it["id"] == item_id:
            if it.get("sent"):
                raise HTTPException(status_code=400, detail="Article déjà envoyé en cuisine")
            if payload.quantity is not None:
                it["quantity"] = max(1, payload.quantity)
            if payload.note is not None:
                it["note"] = payload.note
            if payload.modifiers is not None:
                it["modifiers"] = [m.model_dump() for m in payload.modifiers]
            await _persist_order(order)
            order["total"] = _order_total(order)
            return order
    raise HTTPException(status_code=404, detail="Article introuvable")


@api_router.delete("/orders/{order_id}/items/{item_id}")
async def delete_item(order_id: str, item_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    items = order.get("items", [])
    target = next((it for it in items if it["id"] == item_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Article introuvable")
    if target.get("sent"):
        raise HTTPException(status_code=400, detail="Article déjà envoyé en cuisine")
    order["items"] = [it for it in items if it["id"] != item_id]
    await _persist_order(order)
    order["total"] = _order_total(order)
    return order


@api_router.post("/orders/{order_id}/send")
async def send_to_kitchen(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["status"] != "open":
        raise HTTPException(status_code=400, detail="Commande non ouverte")
    ts = now_iso()
    new_count = 0
    for it in order.get("items", []):
        if not it.get("sent"):
            it["sent"] = True
            it["sent_at"] = ts
            new_count += 1
    if new_count == 0:
        raise HTTPException(status_code=400, detail="Aucun nouvel article à envoyer")
    order["sent_at"] = ts
    await _persist_order(order)
    order["total"] = _order_total(order)
    order["sent_count"] = new_count
    return order


@api_router.post("/orders/{order_id}/pay")
async def pay_order(order_id: str, payload: OrderPay):
    await _require_open_session_or_400()
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["status"] != "open":
        raise HTTPException(status_code=400, detail="Commande déjà clôturée")
    if not order.get("items"):
        raise HTTPException(status_code=400, detail="Commande vide")

    subtotal_before_discount = _order_subtotal(order)
    discount_amount = _apply_discount(subtotal_before_discount, order.get("discount"))
    total = round(subtotal_before_discount - discount_amount, 2)
    change_due = None
    if payload.payment_method == "cash" and payload.amount_received is not None:
        change_due = round(payload.amount_received - total, 2)

    # decrement stock
    for it in order["items"]:
        product = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if product and product.get("track_stock", True):
            new_stock = max(0, int(product.get("stock", 0)) - it["quantity"])
            await db.products.update_one(
                {"id": it["product_id"]}, {"$set": {"stock": new_stock}}
            )

    cart_lines = []
    for it in order["items"]:
        unit = it["base_price"] + sum(m["price_delta"] for m in it.get("modifiers", []))
        cart_lines.append(
            CartLine(
                product_id=it["product_id"],
                name=it["name"]
                + (
                    " (" + ", ".join(m["name"] for m in it.get("modifiers", [])) + ")"
                    if it.get("modifiers")
                    else ""
                ),
                price=round(unit, 2),
                quantity=it["quantity"],
                modifiers=[ModifierOption(**m) for m in it.get("modifiers", [])],
            )
        )

    session = await get_current_session()

    tva_breakdown = await _compute_tva_breakdown([cl.model_dump() for cl in cart_lines])
    sale = Sale(
        ticket_number=await next_ticket_number(),
        items=cart_lines,
        subtotal=subtotal_before_discount,
        discount_amount=discount_amount,
        total=total,
        tva_breakdown=tva_breakdown,
        payment_method=payload.payment_method,
        amount_received=payload.amount_received,
        change_due=change_due,
        cashier_id=order.get("server_id"),
        cashier_name=order.get("server_name"),
        server_id=order.get("server_id"),
        server_name=order.get("server_name"),
        table_id=order.get("table_id"),
        table_name=order.get("table_name"),
        order_id=order["id"],
        session_id=session["id"] if session else order.get("session_id"),
        customer_id=payload.customer_id,
    )
    sale_doc = sale.model_dump()
    await db.sales.insert_one(sale_doc)

    from nf525_loyalty import append_journal as _aj, apply_loyalty_on_sale as _loy
    await _aj("TICKET", sale.id, {
        "ticket_number": sale.ticket_number,
        "total": sale.total,
        "payment_method": sale.payment_method,
        "table": sale.table_name,
        "items": [{"name": i.name, "qty": i.quantity, "price": i.price} for i in sale.items],
    })
    await _loy(sale_doc)

    order["status"] = "paid"
    order["paid_at"] = now_iso()
    order["sale_id"] = sale.id
    await _persist_order(order)
    return {"order": order, "sale": sale}


@api_router.post("/orders/{order_id}/discount")
async def set_order_discount(order_id: str, payload: dict, user=Depends(require_role("manager"))):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    if order["status"] != "open":
        raise HTTPException(400, "Commande non ouverte")
    if not payload.get("value"):
        order["discount"] = None
    else:
        order["discount"] = OrderDiscount(
            type=payload.get("type", "percent"),
            value=float(payload.get("value", 0)),
            reason=payload.get("reason"),
            granted_by=user.get("name"),
        ).model_dump()
    await _persist_order(order)
    order["total"] = _order_total(order)
    return order


@api_router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order["status"] != "open":
        raise HTTPException(status_code=400, detail="Commande déjà clôturée")
    order["status"] = "cancelled"
    order["cancelled_at"] = now_iso()
    await _persist_order(order)
    from nf525_loyalty import append_journal as _aj
    await _aj("CANCEL", order["id"], {"reason": "manual"})
    return order


# --- Sales (direct/take-away) -------------------------------------------
@api_router.post("/sales")
async def create_sale(payload: SaleCreate):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Panier vide")
    await _require_open_session_or_400()

    subtotal = round(sum(line.price * line.quantity for line in payload.items), 2)
    total = subtotal
    change_due = None
    if payload.payment_method == "cash" and payload.amount_received is not None:
        change_due = round(payload.amount_received - total, 2)

    for line in payload.items:
        product = await db.products.find_one({"id": line.product_id}, {"_id": 0})
        if product and product.get("track_stock", True):
            new_stock = max(0, int(product.get("stock", 0)) - line.quantity)
            await db.products.update_one(
                {"id": line.product_id}, {"$set": {"stock": new_stock}}
            )

    session = await get_current_session()
    tva_breakdown = await _compute_tva_breakdown([line.model_dump() for line in payload.items])
    sale = Sale(
        ticket_number=await next_ticket_number(),
        items=payload.items,
        subtotal=subtotal,
        total=total,
        tva_breakdown=tva_breakdown,
        payment_method=payload.payment_method,
        amount_received=payload.amount_received,
        change_due=change_due,
        cashier_id=payload.cashier_id,
        cashier_name=payload.cashier_name,
        server_id=payload.cashier_id,
        server_name=payload.cashier_name,
        session_id=session["id"] if session else None,
        customer_id=payload.customer_id,
    )
    sale_doc = sale.model_dump()
    await db.sales.insert_one(sale_doc)
    # NF525 immutable journal + Loyalty
    from nf525_loyalty import append_journal as _aj, apply_loyalty_on_sale as _loy
    await _aj("TICKET", sale.id, {
        "ticket_number": sale.ticket_number,
        "total": sale.total,
        "payment_method": sale.payment_method,
        "items": [{"name": i.name, "qty": i.quantity, "price": i.price} for i in sale.items],
    })
    await _loy(sale_doc)
    return sale


@api_router.get("/sales")
async def list_sales(
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    session_id: Optional[str] = None,
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
    if session_id:
        q["session_id"] = session_id
    cursor = db.sales.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(limit)


# --- Cash Sessions -------------------------------------------------------
@api_router.get("/cash-sessions")
async def list_sessions(limit: int = 30):
    cursor = db.cash_sessions.find({}, {"_id": 0}).sort("opened_at", -1).limit(limit)
    return await cursor.to_list(limit)


@api_router.get("/cash-sessions/current")
async def current_session():
    s = await get_current_session()
    return s or None


async def _require_open_session_or_400() -> dict:
    s = await get_current_session()
    if not s:
        raise HTTPException(status_code=400, detail="Aucune session de caisse ouverte. Ouvrez la caisse avant de vendre.")
    return s


@api_router.post("/cash-sessions/{session_id}/reopen")
async def reopen_session(session_id: str, user: Optional[dict] = Depends(current_user)):
    s = await db.cash_sessions.find_one({"id": session_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Session introuvable")
    if s["status"] != "closed":
        raise HTTPException(400, "Session non clôturée")
    # Only allow reopen on the same system day
    closed_at = s.get("closed_at", "")
    try:
        closed_day = datetime.fromisoformat(closed_at).date()
    except (ValueError, TypeError):
        raise HTTPException(400, "Date de clôture invalide")
    today = datetime.now(timezone.utc).date()
    if closed_day != today:
        raise HTTPException(400, "Réouverture impossible : la journée est terminée")
    # Make sure no other session is open
    if await get_current_session():
        raise HTTPException(400, "Une autre session est déjà ouverte")
    await db.cash_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "open"}, "$unset": {"closed_at": "", "closing_cash_declared": "", "expected_cash": "", "cash_difference": ""}},
    )
    from nf525_loyalty import append_journal as _aj
    await _aj("PARAM", session_id, {"action": "reopen_session", "by": (user or {}).get("name", "?")})
    return await db.cash_sessions.find_one({"id": session_id}, {"_id": 0})


@api_router.post("/cash-sessions/open")
async def open_session(payload: OpenSessionRequest):
    existing = await get_current_session()
    if existing:
        raise HTTPException(status_code=400, detail="Une session est déjà ouverte")
    server = None
    if payload.server_id:
        server = await db.users.find_one({"id": payload.server_id}, {"_id": 0, "pin": 0})
    s = CashSession(
        server_id=payload.server_id,
        server_name=server["name"] if server else None,
        opening_cash=payload.opening_cash,
    )
    await db.cash_sessions.insert_one(s.model_dump())
    return s


@api_router.post("/cash-sessions/{session_id}/close")
async def close_session(session_id: str, payload: CloseSessionRequest, user: Optional[dict] = Depends(current_user)):
    s = await db.cash_sessions.find_one({"id": session_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable")
    if s["status"] != "open":
        raise HTTPException(status_code=400, detail="Session déjà fermée")

    # Block closure while there are pending (open) orders — they must be paid or cancelled first
    pending_count = await db.orders.count_documents({"status": "open"})
    if pending_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Clôture impossible : {pending_count} vente(s) en attente. Encaissez ou annulez ces commandes avant de clôturer.",
        )

    # Aggregate sales since opened_at
    sales = await db.sales.find(
        {"created_at": {"$gte": s["opened_at"]}, "session_id": session_id},
        {"_id": 0},
    ).to_list(10000)
    cash_sales = sum(x["total"] for x in sales if x["payment_method"] == "cash")
    expected = round(s["opening_cash"] + cash_sales, 2)
    diff = round(payload.closing_cash_declared - expected, 2)
    closed_at = now_iso()
    await db.cash_sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "status": "closed",
                "closed_at": closed_at,
                "closing_cash_declared": payload.closing_cash_declared,
                "expected_cash": expected,
                "cash_difference": diff,
            }
        },
    )

    # Generate Z report (definitive)
    data = await _aggregate_sales(sales)
    data["session_id"] = session_id
    data["server_name"] = s.get("server_name")
    data["opened_at"] = s["opened_at"]
    data["closed_at"] = closed_at
    data["opening_cash"] = s["opening_cash"]
    data["closing_cash_declared"] = payload.closing_cash_declared
    data["expected_cash"] = expected
    data["cash_difference"] = diff
    data["report_type"] = "Z"

    currency = await _get_currency()
    html = _build_z_html(data, currency)
    # Server role cannot override the recipient list configured by admin
    is_admin = user and user.get("role") == "admin"
    override = payload.recipient_email if is_admin else None
    recipients = await _resolve_recipients(override)
    email_result = await _maybe_send_email(
        recipients, f"QuickPOS · Rapport Z {closed_at[:10]}", html
    )

    z_report = {
        "id": new_id(),
        "type": "Z",
        "session_id": session_id,
        "data": data,
        "email_status": email_result,
        "created_at": closed_at,
    }
    await db.reports.insert_one(z_report)
    from nf525_loyalty import append_journal as _aj
    await _aj("Z", session_id, {
        "total_revenue": data["total_revenue"],
        "num_sales": data["num_sales"],
        "cash_difference": diff,
        "expected_cash": expected,
        "closing_cash_declared": payload.closing_cash_declared,
    })

    return {
        "session": await db.cash_sessions.find_one({"id": session_id}, {"_id": 0}),
        "report": data,
        "email": email_result,
    }


# --- Aggregation helpers -------------------------------------------------
async def _aggregate_sales(sales: List[dict]) -> dict:
    total_revenue = 0.0
    by_payment: dict = defaultdict(float)
    by_hour: dict = defaultdict(float)
    by_day: dict = defaultdict(float)
    by_category: dict = defaultdict(float)
    by_server: dict = defaultdict(float)
    top_products: dict = defaultdict(lambda: {"name": "", "qty": 0, "revenue": 0.0})

    cats = {c["id"]: c for c in await db.categories.find({}, {"_id": 0}).to_list(1000)}
    prods = await db.products.find({}, {"_id": 0}).to_list(2000)
    product_to_cat = {p["id"]: p.get("category_id") for p in prods}

    for s in sales:
        total_revenue += s["total"]
        by_payment[s["payment_method"]] += s["total"]
        dt = datetime.fromisoformat(s["created_at"])
        by_hour[dt.hour] += s["total"]
        by_day[dt.date().isoformat()] += s["total"]
        if s.get("server_name"):
            by_server[s["server_name"]] += s["total"]
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
    return {
        "total_revenue": round(total_revenue, 2),
        "num_sales": num_sales,
        "avg_ticket": round(avg_ticket, 2),
        "by_payment": {k: round(v, 2) for k, v in by_payment.items()},
        "by_hour": [{"hour": h, "revenue": round(by_hour.get(h, 0.0), 2)} for h in range(24)],
        "by_day": [{"day": d, "revenue": round(r, 2)} for d, r in sorted(by_day.items())],
        "by_category": [{"category": k, "revenue": round(v, 2)} for k, v in by_category.items()],
        "by_server": [{"server": k, "revenue": round(v, 2)} for k, v in by_server.items()],
        "top_products": [
            {"name": v["name"], "qty": v["qty"], "revenue": round(v["revenue"], 2)}
            for v in sorted(top_products.values(), key=lambda x: x["revenue"], reverse=True)[:10]
        ],
    }


async def _aggregate_range(start_iso: str, end_iso: str) -> dict:
    sales = await db.sales.find(
        {"created_at": {"$gte": start_iso, "$lt": end_iso}}, {"_id": 0}
    ).to_list(10000)
    return await _aggregate_sales(sales)


@api_router.get("/reports/tva")
async def tva_report(
    target_date: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
):
    if year and month:
        start, end = month_bounds(year, month)
        scope = f"{year}-{month:02d}"
    else:
        d = date.fromisoformat(target_date) if target_date else datetime.now(timezone.utc).date()
        start, end = day_bounds(d)
        scope = d.isoformat()
    sales = await db.sales.find(
        {"created_at": {"$gte": start, "$lt": end}}, {"_id": 0}
    ).to_list(10000)
    total: dict = {}
    for s in sales:
        for rate, b in (s.get("tva_breakdown") or {}).items():
            cur = total.setdefault(rate, {"ht": 0.0, "tva": 0.0, "ttc": 0.0})
            cur["ht"] = round(cur["ht"] + b["ht"], 2)
            cur["tva"] = round(cur["tva"] + b["tva"], 2)
            cur["ttc"] = round(cur["ttc"] + b["ttc"], 2)
    totals = {
        "ht": round(sum(v["ht"] for v in total.values()), 2),
        "tva": round(sum(v["tva"] for v in total.values()), 2),
        "ttc": round(sum(v["ttc"] for v in total.values()), 2),
    }
    return {"scope": scope, "by_rate": total, "totals": totals, "num_sales": len(sales)}


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


@api_router.get("/reports/x")
async def x_report(session_id: Optional[str] = None):
    """État X : aperçu intermédiaire (sans clôturer)."""
    s = None
    if session_id:
        s = await db.cash_sessions.find_one({"id": session_id}, {"_id": 0})
    else:
        s = await get_current_session()
    if not s:
        raise HTTPException(status_code=400, detail="Aucune session ouverte")

    sales = await db.sales.find(
        {"session_id": s["id"], "created_at": {"$gte": s["opened_at"]}}, {"_id": 0}
    ).to_list(10000)
    cash_sales = sum(x["total"] for x in sales if x["payment_method"] == "cash")
    expected = round(s["opening_cash"] + cash_sales, 2)
    data = await _aggregate_sales(sales)
    data["session_id"] = s["id"]
    data["server_name"] = s.get("server_name")
    data["opened_at"] = s["opened_at"]
    data["opening_cash"] = s["opening_cash"]
    data["expected_cash"] = expected
    data["report_type"] = "X"
    return data


# --- Email ---------------------------------------------------------------
def _fmt_money(value: float, currency: Optional[dict] = None) -> str:
    c = currency or {"symbol": "€", "decimals": 2, "position": "after"}
    decimals = int(c.get("decimals", 2))
    fixed = f"{value:,.{decimals}f}"
    # French format: thousand=space, decimal=comma
    int_part, _, dec_part = fixed.partition(".")
    int_part = int_part.replace(",", " ")
    number = f"{int_part},{dec_part}" if decimals > 0 else int_part
    symbol = c.get("symbol", "€")
    return f"{symbol} {number}" if c.get("position") == "before" else f"{number} {symbol}"


# Compat: keep old name for any caller; default to EUR
def _fmt_eur(value: float) -> str:
    return _fmt_money(value)


async def _get_currency() -> dict:
    doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    return (doc or {}).get("currency") or {
        "code": "EUR",
        "symbol": "€",
        "decimals": 2,
        "position": "after",
    }


def _build_table_rows(rows, cols=2):
    return "".join(
        "<tr>" + "".join(
            f"<td style='padding:8px;border-bottom:1px solid #eee{';text-align:right' if i else ''}'>{c}</td>"
            for i, c in enumerate(r)
        ) + "</tr>" for r in rows
    ) or f"<tr><td colspan='{cols}' style='padding:8px;color:#9CA3AF'>—</td></tr>"


def _build_z_html(data: dict, currency: Optional[dict] = None) -> str:
    def fm(v: float) -> str:
        return _fmt_money(v, currency)
    pay_rows = [
        (PAYMENT_LABELS.get(k, k), fm(v))
        for k, v in data.get("by_payment", {}).items()
    ]
    cat_rows = [(c["category"], fm(c["revenue"])) for c in data.get("by_category", [])]
    srv_rows = [(s["server"], fm(s["revenue"])) for s in data.get("by_server", [])]
    top_rows_html = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{p['name']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{p['qty']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{fm(p['revenue'])}</td></tr>"
        for p in data.get("top_products", [])[:8]
    ) or "<tr><td colspan='3' style='padding:8px'>—</td></tr>"

    diff = data.get("cash_difference", 0)
    diff_color = "#10B981" if diff >= 0 else "#FF2A2A"

    return f"""
    <div style='font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#0A0A0A'>
      <div style='border-left:4px solid #002FA7;padding-left:16px;margin-bottom:24px'>
        <p style='color:#4B5563;margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:12px;font-weight:700'>Rapport Z · Clôture définitive</p>
        <h1 style='color:#002FA7;margin:4px 0 0'>Service du {data.get('opened_at', '')[:10]}</h1>
        <p style='color:#4B5563;margin:4px 0 0'>Serveur : {data.get('server_name') or '—'} · Clos à {data.get('closed_at', '')[11:16]}</p>
      </div>

      <table style='width:100%;border-collapse:collapse;margin-bottom:16px'>
        <tr><td style='padding:12px;background:#F4F6FB;font-weight:bold'>Chiffre d'affaires</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right;font-weight:bold;color:#002FA7;font-size:18px'>{fm(data.get('total_revenue', 0))}</td></tr>
        <tr><td style='padding:12px'>Nombre de ventes</td>
            <td style='padding:12px;text-align:right'>{data.get('num_sales', 0)}</td></tr>
        <tr><td style='padding:12px;background:#F4F6FB'>Panier moyen</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right'>{fm(data.get('avg_ticket', 0))}</td></tr>
      </table>

      <h2 style='margin-top:24px;color:#0A0A0A;font-size:16px'>Caisse</h2>
      <table style='width:100%;border-collapse:collapse'>
        <tr><td style='padding:8px;border-bottom:1px solid #eee'>Fond de caisse initial</td>
            <td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{fm(data.get('opening_cash', 0))}</td></tr>
        <tr><td style='padding:8px;border-bottom:1px solid #eee'>Espèces attendues</td>
            <td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{fm(data.get('expected_cash', 0))}</td></tr>
        <tr><td style='padding:8px;border-bottom:1px solid #eee'>Espèces comptées</td>
            <td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{fm(data.get('closing_cash_declared', 0))}</td></tr>
        <tr><td style='padding:8px;font-weight:bold'>Écart de caisse</td>
            <td style='padding:8px;text-align:right;font-weight:bold;color:{diff_color}'>{fm(diff)}</td></tr>
      </table>

      <h2 style='margin-top:24px;color:#0A0A0A;font-size:16px'>Par moyen de paiement</h2>
      <table style='width:100%;border-collapse:collapse'>{_build_table_rows(pay_rows)}</table>

      <h2 style='margin-top:24px;color:#0A0A0A;font-size:16px'>Par catégorie</h2>
      <table style='width:100%;border-collapse:collapse'>{_build_table_rows(cat_rows)}</table>

      {"<h2 style='margin-top:24px;color:#0A0A0A;font-size:16px'>Par serveur</h2><table style='width:100%;border-collapse:collapse'>" + _build_table_rows(srv_rows) + "</table>" if srv_rows else ""}

      <h2 style='margin-top:24px;color:#0A0A0A;font-size:16px'>Top produits</h2>
      <table style='width:100%;border-collapse:collapse'>
        <tr><th align='left' style='padding:8px;border-bottom:2px solid #E5E7EB'>Produit</th>
            <th align='right' style='padding:8px;border-bottom:2px solid #E5E7EB'>Qté</th>
            <th align='right' style='padding:8px;border-bottom:2px solid #E5E7EB'>CA</th></tr>
        {top_rows_html}
      </table>

      <p style='margin-top:32px;color:#9CA3AF;font-size:12px'>QuickPOS · Rapport Z automatique non modifiable</p>
    </div>
    """


def _build_daily_html(data: dict, currency: Optional[dict] = None) -> str:
    return _build_z_html({**data, "report_type": "Daily"}, currency)


def _build_monthly_html(data: dict, currency: Optional[dict] = None) -> str:
    def fm(v: float) -> str:
        return _fmt_money(v, currency)
    day_rows = [(d["day"], fm(d["revenue"])) for d in data.get("by_day", [])]
    return f"""
    <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0A0A0A'>
      <h1 style='color:#002FA7'>État mensuel</h1>
      <p style='color:#4B5563'>{data.get('month', 0):02d}/{data.get('year', 0)}</p>
      <table style='width:100%;border-collapse:collapse;margin-top:16px'>
        <tr><td style='padding:12px;background:#F4F6FB;font-weight:bold'>Chiffre d'affaires</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right;font-weight:bold;color:#002FA7'>{fm(data.get('total_revenue', 0))}</td></tr>
        <tr><td style='padding:12px'>Nombre de ventes</td>
            <td style='padding:12px;text-align:right'>{data.get('num_sales', 0)}</td></tr>
        <tr><td style='padding:12px;background:#F4F6FB'>Panier moyen</td>
            <td style='padding:12px;background:#F4F6FB;text-align:right'>{fm(data.get('avg_ticket', 0))}</td></tr>
      </table>
      <h2 style='margin-top:24px'>Détail journalier</h2>
      <table style='width:100%;border-collapse:collapse'>{_build_table_rows(day_rows)}</table>
      <p style='margin-top:32px;color:#9CA3AF;font-size:12px'>QuickPOS · Rapport automatique</p>
    </div>
    """


def _send_via_smtp_sync(smtp: dict, to: List[str], subject: str, html: str) -> dict:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.utils import formataddr

    host = smtp.get("host", "")
    port = int(smtp.get("port", 587))
    username = smtp.get("username", "")
    password = smtp.get("password", "")
    from_email = smtp.get("from_email") or username
    from_name = smtp.get("from_name", "QuickPOS")
    use_tls = bool(smtp.get("use_tls", True))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(html, "html", "utf-8"))

    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        server = smtplib.SMTP(host, port, timeout=15)
        if use_tls:
            server.starttls()
    try:
        if username and password:
            server.login(username, password)
        server.sendmail(from_email, to, msg.as_string())
    finally:
        server.quit()
    return {"status": "sent", "transport": "smtp", "to": to}


async def _send_via_smtp(smtp: dict, to: List[str], subject: str, html: str) -> dict:
    try:
        return await asyncio.to_thread(
            _send_via_smtp_sync, smtp, to, subject, html
        )
    except Exception as exc:
        logger.exception("SMTP error")
        return {"status": "error", "transport": "smtp", "error": str(exc)}


def _normalize_recipients(to) -> List[str]:
    if to is None:
        return []
    if isinstance(to, str):
        return [to] if to.strip() else []
    return [str(x).strip() for x in to if str(x).strip()]


async def _maybe_send_email(to, subject: str, html: str) -> dict:
    recipients = _normalize_recipients(to)
    if not recipients:
        return {"status": "skipped", "reason": "Aucun destinataire fourni"}

    doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    smtp = (doc or {}).get("smtp") or {}
    if smtp.get("enabled") and smtp.get("host"):
        return await _send_via_smtp(smtp, recipients, subject, html)

    if RESEND_API_KEY:
        params = {"from": SENDER_EMAIL, "to": recipients, "subject": subject, "html": html}
        try:
            result = await asyncio.to_thread(resend.Emails.send, params)
            return {"status": "sent", "transport": "resend", "email_id": result.get("id"), "to": recipients}
        except Exception as exc:
            logger.exception("Resend error")
            return {"status": "error", "transport": "resend", "error": str(exc)}

    return {"status": "skipped", "reason": "Aucun transport email configuré"}


async def _resolve_recipients(explicit: Optional[str]) -> List[str]:
    """Pick recipient list: explicit single override, else settings.report_recipients, else REPORT_EMAIL env."""
    if explicit:
        return [explicit]
    doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    rec = (doc or {}).get("report_recipients") or []
    if rec:
        return list(rec)
    if REPORT_EMAIL:
        return [REPORT_EMAIL]
    return []


@api_router.post("/reports/daily/send")
async def send_daily(payload: SendReportRequest):
    d = date.fromisoformat(payload.target_date) if payload.target_date else datetime.now(timezone.utc).date()
    start, end = day_bounds(d)
    data = await _aggregate_range(start, end)
    data["date"] = d.isoformat()
    currency = await _get_currency()
    html = _build_daily_html(data, currency)
    recipients = await _resolve_recipients(payload.recipient_email)
    result = await _maybe_send_email(
        recipients, f"QuickPOS · Clôture {d.isoformat()}", html
    )
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
    currency = await _get_currency()
    html = _build_monthly_html(data, currency)
    recipients = await _resolve_recipients(payload.recipient_email)
    result = await _maybe_send_email(
        recipients, f"QuickPOS · Rapport mensuel {payload.month:02d}/{payload.year}", html
    )
    return {"report": data, "email": result}


@api_router.get("/closures")
async def list_closures(limit: int = 30):
    cursor = db.closures.find({}, {"_id": 0}).sort("date", -1).limit(limit)
    return await cursor.to_list(limit)


@api_router.get("/reports")
async def list_reports(report_type: Optional[str] = None, limit: int = 30):
    q: dict = {}
    if report_type:
        q["type"] = report_type
    cursor = db.reports.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(limit)


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    currency = (doc or {}).get("currency") or {
        "code": "EUR",
        "symbol": "€",
        "decimals": 2,
        "position": "after",
    }
    smtp_doc = (doc or {}).get("smtp") or {}
    smtp_out = {
        "host": smtp_doc.get("host", ""),
        "port": smtp_doc.get("port", 587),
        "username": smtp_doc.get("username", ""),
        "password": "********" if smtp_doc.get("password") else "",
        "from_email": smtp_doc.get("from_email", ""),
        "from_name": smtp_doc.get("from_name", "QuickPOS"),
        "use_tls": smtp_doc.get("use_tls", True),
        "enabled": bool(smtp_doc.get("enabled")),
    }
    print_doc = (doc or {}).get("print") or {}
    print_out = {
        "auto_print_z": print_doc.get("auto_print_z", True),
        "auto_print_receipt": print_doc.get("auto_print_receipt", True),
        "open_drawer_on_cash": print_doc.get("open_drawer_on_cash", True),
        "paper_width_mm": print_doc.get("paper_width_mm", 80),
        "shop_name": print_doc.get("shop_name", "QuickPOS"),
        "footer_line": print_doc.get("footer_line", "Merci de votre visite"),
    }
    return {
        "report_email": REPORT_EMAIL,
        "sender_email": SENDER_EMAIL,
        "email_configured": bool(RESEND_API_KEY) or smtp_out["enabled"],
        "resend_configured": bool(RESEND_API_KEY),
        "smtp": smtp_out,
        "currency": currency,
        "report_recipients": (doc or {}).get("report_recipients") or [],
        "print": print_out,
        "loyalty": (doc or {}).get("loyalty") or {
            "enabled": False,
            "points_per_currency": 1.0,
            "points_redemption_rate": 100.0,
        },
    }


class CurrencyConfig(BaseModel):
    code: str = Field(max_length=8)
    symbol: str = Field(max_length=8)
    decimals: int = Field(ge=0, le=4)
    position: Literal["before", "after"] = "after"


class SMTPConfigIn(BaseModel):
    host: str = ""
    port: int = Field(default=587, ge=1, le=65535)
    username: str = ""
    password: str = ""  # if "********" -> keep existing
    from_email: str = ""
    from_name: str = "QuickPOS"
    use_tls: bool = True
    enabled: bool = False


class SettingsUpdate(BaseModel):
    currency: Optional[CurrencyConfig] = None
    smtp: Optional[SMTPConfigIn] = None
    report_recipients: Optional[List[EmailStr]] = None
    print: Optional[dict] = None
    loyalty: Optional[dict] = None


@api_router.put("/settings")
async def update_settings(payload: SettingsUpdate):
    update: dict = {}
    if payload.currency:
        update["currency"] = payload.currency.model_dump()
    if payload.smtp is not None:
        smtp_data = payload.smtp.model_dump()
        if smtp_data["password"] == "********":
            existing = await db.settings.find_one({"_id": "config"}, {"_id": 0, "smtp": 1})
            smtp_data["password"] = (existing or {}).get("smtp", {}).get("password", "")
        update["smtp"] = smtp_data
    if payload.report_recipients is not None:
        # dedupe while preserving order
        seen = set()
        cleaned = []
        for e in payload.report_recipients:
            v = str(e).strip().lower()
            if v and v not in seen:
                seen.add(v)
                cleaned.append(v)
        update["report_recipients"] = cleaned
    if payload.print is not None:
        update["print"] = {
            "auto_print_z": bool(payload.print.get("auto_print_z", True)),
            "auto_print_receipt": bool(payload.print.get("auto_print_receipt", True)),
            "open_drawer_on_cash": bool(payload.print.get("open_drawer_on_cash", True)),
            "paper_width_mm": int(payload.print.get("paper_width_mm", 80)),
            "shop_name": str(payload.print.get("shop_name", "QuickPOS"))[:40],
            "footer_line": str(payload.print.get("footer_line", ""))[:80],
        }
    if payload.loyalty is not None:
        update["loyalty"] = {
            "enabled": bool(payload.loyalty.get("enabled", False)),
            "points_per_currency": float(payload.loyalty.get("points_per_currency", 1.0)),
            "points_redemption_rate": float(payload.loyalty.get("points_redemption_rate", 100.0)),
        }
    if not update:
        raise HTTPException(status_code=400, detail="Aucune modification fournie")
    await db.settings.update_one(
        {"_id": "config"}, {"$set": update}, upsert=True
    )
    return await get_settings()


class SMTPTestRequest(BaseModel):
    to: EmailStr


@api_router.post("/settings/smtp/test")
async def smtp_test(payload: SMTPTestRequest):
    doc = await db.settings.find_one({"_id": "config"}, {"_id": 0})
    smtp = (doc or {}).get("smtp") or {}
    if not smtp.get("host"):
        raise HTTPException(status_code=400, detail="SMTP non configuré")
    html = """
    <div style='font-family:Arial,sans-serif;max-width:480px;margin:auto'>
      <h2 style='color:#002FA7'>QuickPOS · Test SMTP</h2>
      <p>Si vous recevez ce message, votre configuration SMTP est <strong>opérationnelle</strong>.</p>
      <p style='color:#9CA3AF;font-size:12px;margin-top:24px'>Envoyé depuis la configuration QuickPOS.</p>
    </div>
    """
    result = await _send_via_smtp(
        smtp, [str(payload.to)], "QuickPOS · Test SMTP", html
    )
    return result


@api_router.get("/")
async def root():
    return {"app": "QuickPOS", "status": "ok"}


# --- NF525 + Loyalty extensions -----------------------------------------
from nf525_loyalty import apply_loyalty_on_sale, append_journal  # noqa: E402
import nf525_loyalty as _ext  # noqa: E402

_ext.db = db
_ext.api_router = api_router
_ext.register_routes()


# --- Suppliers ----------------------------------------------------------
class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class SupplierIn(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


@api_router.get("/suppliers")
async def list_suppliers():
    return await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(2000)


@api_router.post("/suppliers")
async def create_supplier(payload: SupplierIn):
    s = Supplier(**payload.model_dump())
    await db.suppliers.insert_one(s.model_dump())
    return s


@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, payload: SupplierIn):
    res = await db.suppliers.update_one({"id": supplier_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})


@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str):
    res = await db.suppliers.delete_one({"id": supplier_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    # detach from products
    await db.products.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    return {"ok": True}


# --- Barcode lookup -----------------------------------------------------
@api_router.get("/products/by-barcode/{code}")
async def get_product_by_barcode(code: str):
    code = (code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code vide")
    doc = await db.products.find_one(
        {"$or": [{"barcode": code}, {"sku": code}]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Aucun produit pour ce code")
    return doc


# --- Stock movements ----------------------------------------------------
MovementType = Literal["in", "out", "adjust"]


class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    product_id: str
    product_name: str
    type: MovementType
    quantity: int
    reason: Optional[str] = None
    supplier_id: Optional[str] = None
    unit_cost: Optional[float] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    stock_before: int
    stock_after: int
    created_at: str = Field(default_factory=now_iso)


class StockMovementIn(BaseModel):
    product_id: str
    type: MovementType
    quantity: int = Field(ge=1)
    reason: Optional[str] = None
    supplier_id: Optional[str] = None
    unit_cost: Optional[float] = None


class StockAdjustIn(BaseModel):
    product_id: str
    new_stock: int = Field(ge=0)
    reason: Optional[str] = None


@api_router.get("/stock/movements")
async def list_stock_movements(product_id: Optional[str] = None, limit: int = 200):
    q: dict = {}
    if product_id:
        q["product_id"] = product_id
    cur = db.stock_movements.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cur.to_list(limit)


@api_router.post("/stock/movements")
async def create_stock_movement(payload: StockMovementIn, user: Optional[dict] = Depends(current_user)):
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    before = int(product.get("stock", 0))
    delta = payload.quantity if payload.type == "in" else -payload.quantity
    after = max(0, before + delta)
    await db.products.update_one({"id": payload.product_id}, {"$set": {"stock": after}})
    mvt = StockMovement(
        product_id=product["id"],
        product_name=product["name"],
        type=payload.type,
        quantity=payload.quantity,
        reason=payload.reason,
        supplier_id=payload.supplier_id,
        unit_cost=payload.unit_cost,
        user_id=(user or {}).get("id"),
        user_name=(user or {}).get("name"),
        stock_before=before,
        stock_after=after,
    )
    await db.stock_movements.insert_one(mvt.model_dump())
    await append_journal("STOCK", mvt.id, {
        "product": product["name"],
        "type": payload.type,
        "qty": payload.quantity,
        "before": before,
        "after": after,
    })
    return mvt


@api_router.post("/stock/adjust")
async def adjust_stock(payload: StockAdjustIn, user: Optional[dict] = Depends(current_user)):
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    before = int(product.get("stock", 0))
    after = payload.new_stock
    await db.products.update_one({"id": payload.product_id}, {"$set": {"stock": after}})
    mvt = StockMovement(
        product_id=product["id"],
        product_name=product["name"],
        type="adjust",
        quantity=abs(after - before),
        reason=payload.reason or "Ajustement d'inventaire",
        user_id=(user or {}).get("id"),
        user_name=(user or {}).get("name"),
        stock_before=before,
        stock_after=after,
    )
    await db.stock_movements.insert_one(mvt.model_dump())
    await append_journal("STOCK", mvt.id, {
        "product": product["name"],
        "type": "adjust",
        "before": before,
        "after": after,
    })
    return mvt


@api_router.get("/stock/low")
async def low_stock_products():
    """Returns products where track_stock=True and stock <= low_stock_threshold."""
    items = await db.products.find(
        {"track_stock": True}, {"_id": 0}
    ).to_list(2000)
    out = []
    for p in items:
        thr = int(p.get("low_stock_threshold") or 0)
        st = int(p.get("stock") or 0)
        if thr > 0 and st <= thr:
            out.append(p)
    return out


# --- Backup ZIP ---------------------------------------------------------
@api_router.get("/backup/export")
async def export_backup():
    """Returns a ZIP containing JSON dumps of all collections."""
    import io
    import json
    import zipfile
    from fastapi.responses import StreamingResponse

    collections = [
        "users", "categories", "products", "zones", "tables",
        "orders", "sales", "cash_sessions", "customers", "suppliers",
        "stock_movements", "reports", "closures", "settings", "nf525_journal",
        "counters",
    ]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        meta = {
            "generated_at": now_iso(),
            "app": "QuickPOS",
            "version": 1,
            "collections": collections,
        }
        zf.writestr("manifest.json", json.dumps(meta, indent=2, ensure_ascii=False))
        for col in collections:
            try:
                docs = await db[col].find({}).to_list(100000)
                for d in docs:
                    d.pop("_id", None)
                zf.writestr(f"{col}.json", json.dumps(docs, indent=2, ensure_ascii=False, default=str))
            except Exception as exc:
                logger.warning("backup %s failed: %s", col, exc)
                zf.writestr(f"{col}.error.txt", str(exc))
    buffer.seek(0)
    filename = f"quickpos-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


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
