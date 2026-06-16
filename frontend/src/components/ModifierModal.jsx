import { useState } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/lib/api";

export default function ModifierModal({ product, onClose, onConfirm }) {
  const [selected, setSelected] = useState({});
  const [note, setNote] = useState("");

  if (!product) return null;

  const toggle = (groupIdx, option, multi) => {
    setSelected((prev) => {
      const key = `g${groupIdx}`;
      const current = prev[key] || [];
      const exists = current.find((o) => o.name === option.name);
      if (multi) {
        return {
          ...prev,
          [key]: exists
            ? current.filter((o) => o.name !== option.name)
            : [...current, option],
        };
      }
      return { ...prev, [key]: [option] };
    });
  };

  const allRequiredMet = (product.modifiers || []).every((g, i) =>
    !g.required || (selected[`g${i}`] && selected[`g${i}`].length > 0)
  );

  const flatSelected = Object.values(selected).flat();
  const extra = flatSelected.reduce((a, m) => a + m.price_delta, 0);
  const total = product.price + extra;

  const handleConfirm = () => {
    onConfirm(flatSelected, note || null);
    setSelected({});
    setNote("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="modifier-modal"
    >
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 sticky top-0 bg-white">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
              Options
            </p>
            <h2 className="text-xl font-bold">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {(product.modifiers || []).map((group, gi) => (
            <div key={gi}>
              <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
                {group.name}
                {group.required && (
                  <span className="rounded bg-[#FF2A2A] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Requis
                  </span>
                )}
                {group.multi && (
                  <span className="text-slate-400 normal-case tracking-normal">
                    (sélection multiple)
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map((opt, oi) => {
                  const active = (selected[`g${gi}`] || []).find(
                    (o) => o.name === opt.name
                  );
                  return (
                    <button
                      key={oi}
                      data-testid={`mod-${gi}-${oi}`}
                      onClick={() => toggle(gi, opt, group.multi)}
                      className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm font-semibold transition-all active:scale-95 ${
                        active
                          ? "border-[#002FA7] bg-[#002FA7] text-white"
                          : "border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <span>{opt.name}</span>
                      {opt.price_delta > 0 && (
                        <span className="font-mono text-xs">
                          +{formatCurrency(opt.price_delta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Note (facultatif)
            </span>
            <input
              data-testid="modifier-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex: sans oignons"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
          </label>

          <div className="flex items-baseline justify-between rounded-md bg-[#FAFAFA] px-4 py-3">
            <span className="text-sm uppercase tracking-wider font-semibold text-slate-500">
              Sous-total
            </span>
            <span className="text-2xl font-bold font-mono text-[#002FA7]">
              {formatCurrency(total)}
            </span>
          </div>

          <button
            data-testid="modifier-confirm"
            disabled={!allRequiredMet}
            onClick={handleConfirm}
            className="h-14 w-full rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ajouter à la commande
          </button>
        </div>
      </div>
    </div>
  );
}
