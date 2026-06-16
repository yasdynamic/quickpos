import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, Receipt as ReceiptIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency } from "@/lib/api";
import CheckoutModal from "@/components/CheckoutModal";
import ReceiptModal from "@/components/ReceiptModal";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { usePrinter } from "@/context/PrinterContext";

export default function POSPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const printer = usePrinter();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const load = async () => {
    const [c, p] = await Promise.all([
      api.get("/categories"),
      api.get("/products"),
    ]);
    setCategories(c.data);
    setProducts(p.data);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat !== "all") list = list.filter((p) => p.category_id === activeCat);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s));
    }
    return list;
  }, [products, activeCat, search]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, l) => acc + l.price * l.quantity, 0);
    const count = cart.reduce((acc, l) => acc + l.quantity, 0);
    return { subtotal: Number(subtotal.toFixed(2)), count };
  }, [cart]);

  const addToCart = (product) => {
    if (product.track_stock && product.stock <= 0) {
      toast.error(`${product.name} en rupture`);
      return;
    }
    setCart((c) => {
      const exists = c.find((l) => l.product_id === product.id);
      if (exists) {
        return c.map((l) =>
          l.product_id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...c,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateQty = (id, delta) => {
    setCart((c) =>
      c
        .map((l) =>
          l.product_id === id ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (id) =>
    setCart((c) => c.filter((l) => l.product_id !== id));

  const clearCart = () => setCart([]);

  const onCheckout = async ({ payment_method, amount_received }) => {
    try {
      const res = await api.post("/sales", {
        items: cart,
        payment_method,
        amount_received,
        cashier_id: user?.id,
        cashier_name: user?.name,
      });
      setLastSale(res.data);
      setCart([]);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      toast.success(`Ticket #${res.data.ticket_number} encaissé`);

      // Auto-print receipt + drawer on cash
      if (printer.connected && settings?.print?.auto_print_receipt !== false) {
        await printer.printReceipt(res.data);
      }
      if (
        printer.connected &&
        payment_method === "cash" &&
        settings?.print?.open_drawer_on_cash !== false
      ) {
        await printer.openDrawer();
      }
      // refresh stock view
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur d'encaissement");
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: products */}
      <section className="flex flex-1 flex-col border-r border-[#E5E7EB]">
        <header className="flex items-center gap-4 border-b border-[#E5E7EB] bg-white px-6 py-4">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              data-testid="pos-search"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-[#E5E7EB] bg-white px-6 py-3">
          <button
            data-testid="cat-all"
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
              data-testid={`cat-${c.id}`}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeCat === c.id
                  ? "text-white"
                  : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
              }`}
              style={
                activeCat === c.id ? { backgroundColor: c.color || "#002FA7" } : {}
              }
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              Aucun produit
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id);
                const out = p.track_stock && p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    data-testid={`product-${p.id}`}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className={`group relative flex flex-col rounded-md border border-[#E5E7EB] bg-white p-4 text-left transition-all hover:shadow-md active:scale-[0.97] ${
                      out ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                  >
                    <div
                      className="mb-3 h-2 w-10 rounded-full"
                      style={{ backgroundColor: cat?.color || "#002FA7" }}
                    />
                    <span className="text-base font-semibold text-[#0A0A0A] leading-tight">
                      {p.name}
                    </span>
                    <span className="mt-2 text-xs uppercase tracking-wider text-slate-500">
                      Stock : {p.track_stock ? p.stock : "∞"}
                    </span>
                    <span className="mt-3 text-xl font-bold text-[#002FA7]">
                      {formatCurrency(p.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Right: cart */}
      <aside
        className="flex w-[360px] xl:w-[420px] shrink-0 flex-col bg-white"
        data-testid="cart-panel"
      >
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
              Ticket en cours
            </p>
            <h2 className="text-xl font-bold">{totals.count} article(s)</h2>
          </div>
          {cart.length > 0 && (
            <button
              data-testid="cart-clear"
              onClick={clearCart}
              className="rounded-md border border-[#E5E7EB] p-2 text-[#4B5563] hover:bg-[#FAFAFA] active:scale-95 transition-transform"
              title="Vider"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <ReceiptIcon className="h-12 w-12 opacity-50" />
              <p className="text-sm">Panier vide</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="cart-items">
              {cart.map((l) => (
                <li
                  key={l.product_id}
                  className="flex items-center gap-3 rounded-md border border-[#E5E7EB] bg-white px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-sm">{l.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(l.price)} × {l.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      data-testid={`cart-dec-${l.product_id}`}
                      onClick={() => updateQty(l.product_id, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95 transition-transform"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-7 text-center font-mono font-semibold">
                      {l.quantity}
                    </span>
                    <button
                      data-testid={`cart-inc-${l.product_id}`}
                      onClick={() => updateQty(l.product_id, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95 transition-transform"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      data-testid={`cart-remove-${l.product_id}`}
                      onClick={() => removeLine(l.product_id)}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[#FF2A2A] hover:bg-red-50 active:scale-95 transition-transform"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-sm uppercase tracking-wider font-semibold text-slate-500">
              Total
            </span>
            <span
              className="text-4xl font-bold text-[#002FA7]"
              data-testid="cart-total"
            >
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
          <button
            data-testid="checkout-btn"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
            className="h-16 w-full rounded-md bg-[#002FA7] text-lg font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Encaisser
          </button>
        </div>
      </aside>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        total={totals.subtotal}
        onConfirm={onCheckout}
      />
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        sale={lastSale}
      />
    </div>
  );
}
