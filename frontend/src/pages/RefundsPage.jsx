import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search, AlertTriangle, ArrowLeft, X, Save } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, formatDateTime } from "@/lib/api";

const PAYMENT_LABEL = { cash: "Espèces", card: "Carte", mobile: "Mobile Money" };

export default function RefundsPage() {
  const [sales, setSales] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // a sale

  const load = async () => {
    const [s, r] = await Promise.all([
      api.get("/sales", { params: { limit: 100 } }),
      api.get("/refunds", { params: { limit: 50 } }),
    ]);
    setSales((s.data || []).filter((x) => !x.refund_id));
    setRefunds(r.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        String(s.ticket_number).includes(q) ||
        (s.table_name || "").toLowerCase().includes(q) ||
        (s.cashier_name || "").toLowerCase().includes(q),
    );
  }, [sales, search]);

  return (
    <div className="p-8" data-testid="refunds-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Service après-vente
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Retours & Avoirs</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            data-testid="refund-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° ticket, table, caissier…"
            className="bg-transparent outline-none text-sm"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
          <header className="border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-2">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Ventes récentes ({filtered.length})
            </h2>
          </header>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-[#E5E7EB]">
            {filtered.map((s) => (
              <button
                key={s.id}
                data-testid={`refund-sale-${s.id}`}
                onClick={() => setSelected(s)}
                className="w-full text-left px-4 py-3 hover:bg-[#FAFAFA] flex items-center gap-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white font-bold">
                  #{s.ticket_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {s.table_name ? `Table ${s.table_name}` : "Vente directe"} ·{" "}
                    {PAYMENT_LABEL[s.payment_method] || s.payment_method}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.cashier_name || "—"} · {formatDateTime(s.created_at)} ·{" "}
                    {(s.items || []).length} article(s)
                  </p>
                </div>
                <span className="font-mono font-bold text-[#002FA7]">
                  {formatCurrency(s.total || 0)}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-400">
                Aucune vente.
              </p>
            )}
          </div>
        </section>

        <aside className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
          <header className="border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-2">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Avoirs récents
            </h2>
          </header>
          <ul className="max-h-[70vh] overflow-y-auto divide-y divide-[#E5E7EB]" data-testid="refunds-list">
            {refunds.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-400">Aucun avoir.</li>
            ) : (
              refunds.map((r) => (
                <li key={r.id} className="px-4 py-3 flex items-center gap-3" data-testid={`refund-${r.id}`}>
                  <RotateCcw className="h-4 w-4 text-[#FF2A2A] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      Ticket #{r.original_ticket_number || "?"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.refunded_by || "—"} · {formatDateTime(r.created_at)}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-[#FF2A2A]">
                    −{formatCurrency(r.total || 0)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>

      {selected && (
        <RefundModal
          sale={selected}
          existingRefunds={refunds.filter((r) => r.sale_id === selected.id)}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RefundModal({ sale, existingRefunds, onClose, onDone }) {
  const [picks, setPicks] = useState({}); // line.id -> qty to refund
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState(sale.payment_method || "cash");
  const [saving, setSaving] = useState(false);

  // Compute remaining qty per line (key by product_id or name)
  const already = useMemo(() => {
    const map = {};
    for (const r of existingRefunds || []) {
      for (const it of r.items || []) {
        const k = it.product_id || it.name;
        map[k] = (map[k] || 0) + (it.quantity || 0);
      }
    }
    return map;
  }, [existingRefunds]);

  const lines = (sale.items || []).map((it, idx) => {
    const key = it.product_id || it.name;
    const refundedQty = already[key] || 0;
    const max = it.quantity - refundedQty;
    return { ...it, _key: `${idx}-${key}`, _max: max, _already: refundedQty };
  });

  const totalRefund = useMemo(() => {
    let t = 0;
    for (const l of lines) {
      const q = picks[l._key] || 0;
      t += q * l.price;
    }
    return Math.round(t * 100) / 100;
  }, [picks, lines]);

  const submit = async () => {
    const items = lines
      .filter((l) => (picks[l._key] || 0) > 0)
      .map((l) => ({
        product_id: l.product_id || null,
        name: l.name,
        price: l.price,
        quantity: picks[l._key],
      }));
    if (items.length === 0) {
      toast.error("Sélectionnez au moins une ligne à rembourser");
      return;
    }
    setSaving(true);
    try {
      await api.post("/refunds", {
        sale_id: sale.id,
        items,
        reason: reason || undefined,
        payment_method: method,
      });
      toast.success(`Avoir de ${formatCurrency(totalRefund)} créé`);
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="refund-modal">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <button
              onClick={onClose}
              className="text-xs uppercase tracking-wider font-semibold text-slate-500 hover:text-[#0A0A0A] flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Retour
            </button>
            <h2 className="text-xl font-bold mt-1">
              Avoir sur ticket #{sale.ticket_number}
            </h2>
            <p className="text-xs text-slate-500">
              {sale.cashier_name || "—"} · {formatDateTime(sale.created_at)} · Total
              vente {formatCurrency(sale.total)}
            </p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-6 space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-900">
              L'avoir crée une vente négative cryptographiquement chaînée (NF525)
              et réintègre les quantités au stock.
            </p>
          </div>
          <ul className="rounded-md border border-[#E5E7EB] divide-y divide-[#E5E7EB]" data-testid="refund-lines">
            {lines.map((l) => {
              const v = picks[l._key] || 0;
              const setV = (next) =>
                setPicks((p) => ({
                  ...p,
                  [l._key]: Math.max(0, Math.min(l._max, next)),
                }));
              return (
                <li key={l._key} className={`px-4 py-3 flex items-center gap-3 ${l._max === 0 ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{l.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(l.price)} · vendu × {l.quantity}
                      {l._already > 0 && (
                        <span className="text-[#F97316]"> · déjà remboursé × {l._already}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      data-testid={`refund-dec-${l._key}`}
                      disabled={l._max === 0}
                      onClick={() => setV(v - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-mono font-bold">
                      {v}
                    </span>
                    <button
                      data-testid={`refund-inc-${l._key}`}
                      disabled={v >= l._max}
                      onClick={() => setV(v + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] disabled:opacity-30"
                    >
                      +
                    </button>
                    <button
                      data-testid={`refund-max-${l._key}`}
                      disabled={l._max === 0}
                      onClick={() => setV(l._max)}
                      className="ml-1 rounded-md border border-[#E5E7EB] px-2 py-1 text-[10px] font-bold uppercase hover:bg-[#FAFAFA] disabled:opacity-30"
                    >
                      Max {l._max}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Mode de remboursement</span>
              <select
                data-testid="refund-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
              >
                <option value="cash">Espèces</option>
                <option value="card">Carte</option>
                <option value="mobile">Mobile Money</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Motif</span>
              <input
                data-testid="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ex. Produit défectueux"
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
              />
            </label>
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA]">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Total à rembourser</p>
            <p className="text-2xl font-bold font-mono text-[#FF2A2A]" data-testid="refund-total">
              −{formatCurrency(totalRefund)}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold hover:bg-white">
              Annuler
            </button>
            <button
              data-testid="refund-confirm"
              disabled={saving || totalRefund === 0}
              onClick={submit}
              className="flex items-center gap-2 rounded-md bg-[#FF2A2A] px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Création…" : "Créer l'avoir"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
