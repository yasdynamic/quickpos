import { useEffect, useState } from "react";
import { X, Banknote } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, getQuickAmounts, formatAmountInput } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function OpenSessionModal({ open, onClose, onOpened }) {
  const { user } = useAuth();
  const quickAmounts = getQuickAmounts();
  const defaultOpening = formatAmountInput(quickAmounts[1] || 100);
  const [opening, setOpening] = useState(defaultOpening);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setOpening(defaultOpening);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setLoading(true);
    try {
      const res = await api.post("/cash-sessions/open", {
        server_id: user?.id,
        opening_cash: parseFloat(opening) || 0,
      });
      toast.success("Session ouverte");
      onOpened?.(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="open-session-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
                Début de service
              </p>
              <h2 className="text-xl font-bold">Ouvrir la caisse</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-6">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
              Fond de caisse initial
            </p>
            <input
              data-testid="opening-cash"
              inputMode="decimal"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              className="w-full rounded-md border border-[#E5E7EB] px-4 py-4 text-3xl font-bold font-mono outline-none focus:border-[#002FA7]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {quickAmounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setOpening(formatAmountInput(a))}
                  className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95"
                >
                  {formatCurrency(a)}
                </button>
              ))}
            </div>
          </div>

          <button
            data-testid="open-session-confirm"
            disabled={loading}
            onClick={submit}
            className="h-14 w-full rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-50"
          >
            {loading ? "Ouverture…" : "Ouvrir la session"}
          </button>
        </div>
      </div>
    </div>
  );
}
