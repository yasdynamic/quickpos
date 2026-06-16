import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChefHat, Minus, Percent, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { usePrinter } from "@/context/PrinterContext";
import CheckoutModal from "@/components/CheckoutModal";
import ReceiptModal from "@/components/ReceiptModal";
import ModifierModal from "@/components/ModifierModal";

export default function OrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const printer = usePrinter();
  const [order, setOrder] = useState(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: "percent", value: "", reason: "" });
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [modProduct, setModProduct] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const load = async () => {
    const [o, c, p] = await Promise.all([
      api.get(`/orders/${orderId}`),
      api.get("/categories"),
      api.get("/products"),
    ]);
    setOrder(o.data);
    setCategories(c.data);
    setProducts(p.data);
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const filtered = useMemo(() => {
    if (activeCat === "all") return products;
    return products.filter((p) => p.category_id === activeCat);
  }, [products, activeCat]);

  const addProduct = async (product) => {
    if (product.modifiers && product.modifiers.length > 0) {
      setModProduct(product);
      return;
    }
    await api.post(`/orders/${orderId}/items`, {
      product_id: product.id,
      quantity: 1,
    });
    load();
  };

  const addWithModifiers = async (selected, note) => {
    await api.post(`/orders/${orderId}/items`, {
      product_id: modProduct.id,
      quantity: 1,
      modifiers: selected,
      note,
    });
    setModProduct(null);
    load();
  };

  const updateItem = async (item, delta) => {
    if (item.sent) {
      toast.error("Article déjà envoyé en cuisine");
      return;
    }
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await api.delete(`/orders/${orderId}/items/${item.id}`);
    } else {
      await api.put(`/orders/${orderId}/items/${item.id}`, {
        quantity: newQty,
      });
    }
    load();
  };

  const deleteItem = async (item) => {
    if (item.sent) {
      toast.error("Article déjà envoyé en cuisine");
      return;
    }
    await api.delete(`/orders/${orderId}/items/${item.id}`);
    load();
  };

  const sendToKitchen = async () => {
    try {
      const res = await api.post(`/orders/${orderId}/send`);
      toast.success(`${res.data.sent_count} article(s) envoyé(s) en cuisine`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const cancelOrder = async () => {
    if (!window.confirm("Annuler cette commande ?")) return;
    await api.post(`/orders/${orderId}/cancel`);
    toast.success("Commande annulée");
    navigate("/tables");
  };

  const canDiscount = ["admin", "manager"].includes(user?.role);

  const applyDiscount = async () => {
    try {
      await api.post(`/orders/${orderId}/discount`, {
        type: discountForm.type,
        value: parseFloat(discountForm.value) || 0,
        reason: discountForm.reason || undefined,
      });
      toast.success(discountForm.value ? "Remise appliquée" : "Remise retirée");
      setShowDiscount(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const pay = async ({ payment_method, amount_received }) => {
    try {
      const res = await api.post(`/orders/${orderId}/pay`, {
        payment_method,
        amount_received,
      });
      const sale = res.data.sale;
      setLastSale(sale);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      toast.success(`Ticket #${sale.ticket_number} encaissé`);

      // Auto-print receipt
      if (printer.connected && settings?.print?.auto_print_receipt !== false) {
        await printer.printReceipt(sale);
      }
      // Open drawer on cash
      if (
        printer.connected &&
        payment_method === "cash" &&
        settings?.print?.open_drawer_on_cash !== false
      ) {
        await printer.openDrawer();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  if (!order) return <div className="p-8 text-slate-400">Chargement…</div>;

  const total = order.total || 0;
  const unsentCount = (order.items || []).filter((i) => !i.sent).length;

  return (
    <div className="flex h-full">
      <section className="flex flex-1 flex-col border-r border-[#E5E7EB]">
        <header className="flex items-center gap-4 border-b border-[#E5E7EB] bg-white px-6 py-4">
          <button
            data-testid="order-back"
            onClick={() => {
              if (receiptOpen) return;
              navigate("/tables");
            }}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
              {order.table_name ? `Table ${order.table_name}` : "Vente directe"} ·{" "}
              {order.covers || 1} couvert(s)
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Commande #{(order.id || "").slice(0, 6)}
            </h1>
          </div>
          {order.server_name && (
            <span className="rounded-full bg-[#F4F6FB] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              {order.server_name}
            </span>
          )}
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-[#E5E7EB] bg-white px-6 py-3">
          <button
            onClick={() => setActiveCat("all")}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
              activeCat === "all"
                ? "bg-[#0A0A0A] text-white"
                : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeCat === c.id ? "text-white" : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
              }`}
              style={activeCat === c.id ? { backgroundColor: c.color || "#002FA7" } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              const hasMod = p.modifiers && p.modifiers.length > 0;
              return (
                <button
                  key={p.id}
                  data-testid={`order-product-${p.id}`}
                  onClick={() => addProduct(p)}
                  className="group relative flex flex-col rounded-md border border-[#E5E7EB] bg-white p-4 text-left transition-all hover:shadow-md active:scale-[0.97]"
                >
                  <div
                    className="mb-3 h-2 w-10 rounded-full"
                    style={{ backgroundColor: cat?.color || "#002FA7" }}
                  />
                  <span className="text-base font-semibold leading-tight">
                    {p.name}
                  </span>
                  {hasMod && (
                    <span className="mt-1 inline-block text-[10px] uppercase tracking-wider font-bold text-[#002FA7]">
                      Options
                    </span>
                  )}
                  <span className="mt-3 text-xl font-bold text-[#002FA7]">
                    {formatCurrency(p.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="flex w-[400px] xl:w-[460px] shrink-0 flex-col bg-white">
        <header className="border-b border-[#E5E7EB] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Addition
          </p>
          <h2 className="text-xl font-bold">{order.items?.length || 0} ligne(s)</h2>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {(!order.items || order.items.length === 0) && (
            <p className="text-center text-slate-400 py-12">Commande vide</p>
          )}
          <ul className="space-y-2" data-testid="order-items">
            {(order.items || []).map((l) => {
              const unit =
                l.base_price + (l.modifiers || []).reduce((a, m) => a + m.price_delta, 0);
              return (
                <li
                  key={l.id}
                  className={`rounded-md border px-3 py-2.5 ${
                    l.sent
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-sm">{l.name}</p>
                        {l.sent && (
                          <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                            Envoyé
                          </span>
                        )}
                      </div>
                      {l.modifiers && l.modifiers.length > 0 && (
                        <p className="text-xs text-slate-500 italic mt-0.5">
                          {l.modifiers.map((m) => m.name).join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        {formatCurrency(unit)} × {l.quantity}
                      </p>
                    </div>
                    {!l.sent && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateItem(l, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center font-mono font-semibold">
                          {l.quantity}
                        </span>
                        <button
                          onClick={() => updateItem(l, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(l)}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-[#FF2A2A] hover:bg-red-50 active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {l.sent && (
                      <span className="font-mono font-bold text-sm">
                        {formatCurrency(unit * l.quantity)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] p-6 space-y-3">
          {order.discount && order.discount.value > 0 && (
            <div className="flex items-center justify-between rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-sm" data-testid="order-discount">
              <div>
                <p className="font-semibold text-orange-900">
                  Remise {order.discount.type === "percent" ? `${order.discount.value}%` : formatCurrency(order.discount.value)}
                </p>
                {order.discount.reason && <p className="text-xs text-orange-700">{order.discount.reason}</p>}
              </div>
              {canDiscount && (
                <button
                  data-testid="remove-discount"
                  onClick={async () => { await api.post(`/orders/${orderId}/discount`, { value: 0 }); load(); toast.info("Remise retirée"); }}
                  className="text-xs font-bold uppercase tracking-wider text-orange-700 hover:underline"
                >
                  Retirer
                </button>
              )}
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm uppercase tracking-wider font-semibold text-slate-500">
              Total
            </span>
            <span className="text-4xl font-bold text-[#002FA7]" data-testid="order-total">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              data-testid="send-kitchen-btn"
              disabled={unsentCount === 0}
              onClick={sendToKitchen}
              className="flex h-14 items-center justify-center gap-2 rounded-md border-2 border-[#F97316] bg-white text-sm font-bold uppercase tracking-wider text-[#F97316] hover:bg-orange-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChefHat className="h-4 w-4" />
              Cuisine ({unsentCount})
            </button>
            {canDiscount && (
              <button
                data-testid="open-discount-btn"
                onClick={() => setShowDiscount(true)}
                className="flex h-14 items-center justify-center gap-2 rounded-md border-2 border-[#10B981] bg-white text-sm font-bold uppercase tracking-wider text-[#10B981] hover:bg-emerald-50 active:scale-95"
              >
                <Percent className="h-4 w-4" />
                Remise
              </button>
            )}
            <button
              data-testid="cancel-order-btn"
              onClick={cancelOrder}
              className="flex h-14 items-center justify-center gap-2 rounded-md border border-[#E5E7EB] bg-white text-sm font-semibold uppercase tracking-wider text-[#FF2A2A] hover:bg-red-50 active:scale-95"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
          </div>
          <button
            data-testid="pay-order-btn"
            disabled={!order.items || order.items.length === 0}
            onClick={() => setCheckoutOpen(true)}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-md bg-[#002FA7] text-lg font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
            Encaisser
          </button>
        </div>
      </aside>

      <ModifierModal
        product={modProduct}
        onClose={() => setModProduct(null)}
        onConfirm={addWithModifiers}
      />
      {showDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="discount-modal">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <header className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold">Appliquer une remise</h3>
              <button onClick={() => setShowDiscount(false)} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  data-testid="discount-type-percent"
                  onClick={() => setDiscountForm({ ...discountForm, type: "percent" })}
                  className={`rounded-md border-2 px-4 py-3 text-sm font-bold uppercase tracking-wider ${
                    discountForm.type === "percent" ? "border-[#10B981] bg-[#10B981] text-white" : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  Pourcentage
                </button>
                <button
                  data-testid="discount-type-fixed"
                  onClick={() => setDiscountForm({ ...discountForm, type: "fixed" })}
                  className={`rounded-md border-2 px-4 py-3 text-sm font-bold uppercase tracking-wider ${
                    discountForm.type === "fixed" ? "border-[#10B981] bg-[#10B981] text-white" : "border-[#E5E7EB] bg-white"
                  }`}
                >
                  Montant fixe
                </button>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  Valeur {discountForm.type === "percent" ? "(%)" : `(${settings?.currency?.symbol || ""})`}
                </span>
                <input
                  data-testid="discount-value"
                  inputMode="decimal"
                  value={discountForm.value}
                  onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 text-2xl font-bold font-mono outline-none focus:border-[#10B981]"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  Motif (optionnel)
                </span>
                <input
                  data-testid="discount-reason"
                  value={discountForm.reason}
                  onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                  placeholder="ex: Anniversaire, fidélité…"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#10B981]"
                />
              </label>
              <button
                data-testid="apply-discount"
                onClick={applyDiscount}
                className="h-12 w-full rounded-md bg-[#10B981] text-sm font-bold uppercase tracking-wider text-white hover:bg-emerald-600"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        total={total}
        onConfirm={pay}
      />
      <ReceiptModal
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          navigate("/tables");
        }}
        sale={lastSale}
      />
    </div>
  );
}
