import { useEffect, useMemo, useState } from "react";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Pencil,
  X,
  Save,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, formatDateTime } from "@/lib/api";

const MVT_LABEL = { in: "Entrée", out: "Sortie", adjust: "Ajustement" };
const MVT_COLOR = { in: "#10B981", out: "#FF2A2A", adjust: "#F97316" };

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [search, setSearch] = useState("");
  const [filterLow, setFilterLow] = useState(false);
  const [actionFor, setActionFor] = useState(null); // {product, type}
  const [history, setHistory] = useState(null); // product to show history

  const load = async () => {
    const [p, s, m, low] = await Promise.all([
      api.get("/products"),
      api.get("/suppliers"),
      api.get("/stock/movements", { params: { limit: 50 } }),
      api.get("/stock/low"),
    ]);
    setProducts(p.data || []);
    setSuppliers(s.data || []);
    setMovements(m.data || []);
    setLowStock(low.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (filterLow) {
      const ids = new Set(lowStock.map((p) => p.id));
      list = list.filter((p) => ids.has(p.id));
    }
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.barcode || "").toLowerCase().includes(s) ||
          (p.sku || "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [products, search, filterLow, lowStock]);

  const lowIds = useMemo(() => new Set(lowStock.map((p) => p.id)), [lowStock]);

  return (
    <div className="p-8" data-testid="stock-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Inventaire
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Stock</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            data-testid="stock-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
          />
          <button
            data-testid="filter-low-stock"
            onClick={() => setFilterLow((v) => !v)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-wider ${
              filterLow
                ? "border-[#F97316] bg-orange-50 text-[#F97316]"
                : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#FAFAFA]"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Stock bas ({lowStock.length})
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
          <header className="border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Produits ({filtered.length})
            </h2>
          </header>
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 z-10 border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500">Produit</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500">Code</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Stock</th>
                  <th className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = lowIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      data-testid={`stock-row-${p.id}`}
                      className={`border-b border-[#E5E7EB] last:border-0 ${low ? "bg-orange-50/50" : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-semibold">{p.name}</span>
                        {low && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#F97316] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            <AlertTriangle className="h-3 w-3" />
                            Bas
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                        {p.barcode || p.sku || "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-right">
                        {p.track_stock ? p.stock : "∞"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            data-testid={`stock-in-${p.id}`}
                            onClick={() => setActionFor({ product: p, type: "in" })}
                            className="flex h-8 items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"
                            title="Entrée"
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                            Entrée
                          </button>
                          <button
                            data-testid={`stock-out-${p.id}`}
                            onClick={() => setActionFor({ product: p, type: "out" })}
                            className="flex h-8 items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 text-xs font-bold uppercase tracking-wider text-[#FF2A2A] hover:bg-red-100"
                            title="Sortie"
                          >
                            <ArrowUpFromLine className="h-3.5 w-3.5" />
                            Sortie
                          </button>
                          <button
                            data-testid={`stock-adjust-${p.id}`}
                            onClick={() => setActionFor({ product: p, type: "adjust" })}
                            className="flex h-8 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 text-xs font-bold uppercase tracking-wider text-[#4B5563] hover:bg-[#FAFAFA]"
                            title="Ajuster (inventaire)"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            data-testid={`stock-history-${p.id}`}
                            onClick={() => setHistory(p)}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#FAFAFA]"
                            title="Historique"
                          >
                            <HistoryIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      Aucun produit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
          <header className="border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-2">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Derniers mouvements
            </h2>
          </header>
          <ul className="max-h-[70vh] overflow-y-auto divide-y divide-[#E5E7EB]" data-testid="movements-list">
            {movements.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-400">Aucun mouvement.</li>
            ) : (
              movements.map((m) => (
                <li key={m.id} className="px-4 py-2.5 flex items-center gap-3" data-testid={`mvt-${m.id}`}>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: MVT_COLOR[m.type] }}
                  >
                    {m.type === "in" ? (
                      <ArrowDownToLine className="h-4 w-4" />
                    ) : m.type === "out" ? (
                      <ArrowUpFromLine className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {MVT_LABEL[m.type]} · {m.user_name || "—"} ·{" "}
                      {formatDateTime(m.created_at)}
                    </p>
                  </div>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: MVT_COLOR[m.type] }}
                  >
                    {m.type === "out" ? "−" : m.type === "in" ? "+" : "="}
                    {m.quantity}
                  </span>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>

      {actionFor && (
        <MovementModal
          product={actionFor.product}
          type={actionFor.type}
          suppliers={suppliers}
          onClose={() => setActionFor(null)}
          onDone={() => {
            setActionFor(null);
            load();
          }}
        />
      )}

      {history && (
        <HistoryModal
          product={history}
          onClose={() => setHistory(null)}
        />
      )}
    </div>
  );
}

function MovementModal({ product, type, suppliers, onClose, onDone }) {
  const [qty, setQty] = useState(type === "adjust" ? String(product.stock || 0) : "1");
  const [reason, setReason] = useState("");
  const [supplierId, setSupplierId] = useState(product.supplier_id || "");
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);

  const labels = {
    in: { title: "Entrée de stock", verb: "Ajouter", color: "#10B981" },
    out: { title: "Sortie de stock", verb: "Retirer", color: "#FF2A2A" },
    adjust: { title: "Ajustement d'inventaire", verb: "Définir", color: "#F97316" },
  };
  const L = labels[type];

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 0) {
      toast.error("Quantité invalide");
      return;
    }
    setSaving(true);
    try {
      if (type === "adjust") {
        await api.post("/stock/adjust", {
          product_id: product.id,
          new_stock: n,
          reason: reason || undefined,
        });
      } else {
        if (n < 1) {
          toast.error("Quantité ≥ 1");
          setSaving(false);
          return;
        }
        await api.post("/stock/movements", {
          product_id: product.id,
          type,
          quantity: n,
          reason: reason || undefined,
          supplier_id: type === "in" ? (supplierId || undefined) : undefined,
          unit_cost: type === "in" && unitCost ? parseFloat(unitCost) : undefined,
        });
      }
      toast.success("Mouvement enregistré");
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="movement-modal">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md text-white" style={{ backgroundColor: L.color }}>
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">{L.title}</p>
              <h2 className="text-lg font-bold">{product.name}</h2>
              <p className="text-xs text-slate-500">Stock actuel : <span className="font-mono font-bold">{product.stock}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-6">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              {type === "adjust" ? "Nouveau stock" : `Quantité à ${L.verb.toLowerCase()}`}
            </span>
            <input
              data-testid="movement-qty"
              autoFocus
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 text-2xl font-bold font-mono outline-none focus:border-[#002FA7]"
            />
          </label>
          {type === "in" && (
            <>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Fournisseur (optionnel)</span>
                <select
                  data-testid="movement-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Coût unitaire (optionnel)</span>
                <input
                  data-testid="movement-unit-cost"
                  inputMode="decimal"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono outline-none focus:border-[#002FA7]"
                />
                {unitCost && qty && (
                  <p className="mt-1 text-xs text-slate-500">
                    Coût total : {formatCurrency((parseFloat(unitCost) || 0) * (parseInt(qty, 10) || 0))}
                  </p>
                )}
              </label>
            </>
          )}
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Motif</span>
            <input
              data-testid="movement-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === "in" ? "ex. Livraison fournisseur" :
                type === "out" ? "ex. Casse, perte, offert" :
                "ex. Inventaire annuel"
              }
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#E5E7EB] px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA]">
            Annuler
          </button>
          <button
            data-testid="movement-confirm"
            disabled={saving}
            onClick={submit}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: L.color }}
          >
            <Save className="h-4 w-4" />
            {saving ? "Enregistrement…" : L.verb}
          </button>
        </footer>
      </div>
    </div>
  );
}

function HistoryModal({ product, onClose }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api
      .get("/stock/movements", { params: { product_id: product.id, limit: 100 } })
      .then((r) => setItems(r.data || []));
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="history-modal">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Historique des mouvements</p>
            <h2 className="text-lg font-bold">{product.name}</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto">
          {items === null ? (
            <p className="p-8 text-center text-sm text-slate-400">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">Aucun mouvement enregistré.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAFAFA] sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Qté</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Avant → Après</th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Motif</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b border-[#E5E7EB] last:border-0">
                    <td className="px-4 py-2">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                        style={{ backgroundColor: MVT_COLOR[m.type] }}>
                        {MVT_LABEL[m.type]}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono font-bold" style={{ color: MVT_COLOR[m.type] }}>
                      {m.type === "out" ? "−" : m.type === "in" ? "+" : "="}{m.quantity}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{m.stock_before} → {m.stock_after}</td>
                    <td className="px-4 py-2 text-xs">{m.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
