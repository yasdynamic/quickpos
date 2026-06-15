import { useEffect, useState } from "react";
import { Banknote, CreditCard, Smartphone, X } from "lucide-react";
import { formatCurrency } from "@/lib/api";

const METHODS = [
  { value: "cash", label: "Espèces", icon: Banknote },
  { value: "card", label: "Carte", icon: CreditCard },
  { value: "mobile", label: "Mobile Money", icon: Smartphone },
];

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

export default function CheckoutModal({ open, onClose, total, onConfirm }) {
  const [method, setMethod] = useState("cash");
  const [received, setReceived] = useState("");

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setReceived(total.toFixed(2));
    }
  }, [open, total]);

  if (!open) return null;

  const receivedNum = parseFloat(received) || 0;
  const change = method === "cash" ? Math.max(0, receivedNum - total) : 0;
  const isValid =
    method !== "cash" || (receivedNum >= total && !Number.isNaN(receivedNum));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="checkout-modal"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
              Encaissement
            </p>
            <h2 className="text-2xl font-bold">
              {formatCurrency(total)}
            </h2>
          </div>
          <button
            data-testid="checkout-close"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-6 p-6">
          <div>
            <p className="mb-2 text-sm uppercase tracking-wider font-semibold text-slate-500">
              Moyen de paiement
            </p>
            <div className="grid grid-cols-3 gap-3">
              {METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    data-testid={`payment-${m.value}`}
                    onClick={() => setMethod(m.value)}
                    className={`flex flex-col items-center gap-2 rounded-md border px-4 py-5 transition-all active:scale-95 ${
                      active
                        ? "border-[#002FA7] bg-[#002FA7] text-white"
                        : "border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <m.icon className="h-7 w-7" />
                    <span className="text-sm font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {method === "cash" && (
            <div>
              <p className="mb-2 text-sm uppercase tracking-wider font-semibold text-slate-500">
                Montant reçu
              </p>
              <input
                data-testid="cash-received"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                className="w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-4 text-3xl font-bold font-mono text-[#0A0A0A] outline-none focus:border-[#002FA7] focus:ring-2 focus:ring-[#002FA7]/20"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    data-testid={`quick-${a}`}
                    onClick={() => setReceived(a.toFixed(2))}
                    className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95"
                  >
                    {a} €
                  </button>
                ))}
                <button
                  data-testid="quick-exact"
                  onClick={() => setReceived(total.toFixed(2))}
                  className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95"
                >
                  Compte juste
                </button>
              </div>
              <div className="mt-4 flex items-baseline justify-between rounded-md bg-[#FAFAFA] px-4 py-3">
                <span className="text-sm uppercase tracking-wider font-semibold text-slate-500">
                  Monnaie à rendre
                </span>
                <span
                  className="text-2xl font-bold font-mono text-[#10B981]"
                  data-testid="change-due"
                >
                  {formatCurrency(change)}
                </span>
              </div>
            </div>
          )}

          <button
            data-testid="checkout-confirm"
            disabled={!isValid}
            onClick={() =>
              onConfirm({
                payment_method: method,
                amount_received: method === "cash" ? receivedNum : null,
              })
            }
            className="h-16 w-full rounded-md bg-[#10B981] text-lg font-bold uppercase tracking-wider text-white hover:bg-emerald-600 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Valider le paiement
          </button>
        </div>
      </div>
    </div>
  );
}
