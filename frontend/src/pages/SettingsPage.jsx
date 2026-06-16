import { useState } from "react";
import { Settings as SettingsIcon, Check, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { PRESETS, formatCurrency } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

export default function SettingsPage() {
  const { settings, save } = useSettings();
  const [draft, setDraft] = useState(settings.currency);
  const [saving, setSaving] = useState(false);

  const isPreset = (p) =>
    p.code === draft.code &&
    p.symbol === draft.symbol &&
    p.decimals === draft.decimals &&
    p.position === draft.position;

  const submit = async () => {
    setSaving(true);
    try {
      await save({ currency: draft });
      toast.success("Devise mise à jour");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
          Configuration
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Paramètres</h1>
      </header>

      <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Devise
            </p>
            <h2 className="text-xl font-bold">Configuration monétaire</h2>
          </div>
        </div>

        <div className="mb-6 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] p-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Aperçu
          </p>
          <p className="mt-1 text-3xl font-bold font-mono text-[#002FA7]" data-testid="currency-preview">
            {formatPreview(1234.5, draft)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            Code {draft.code} · {draft.decimals} décimale(s) · symbole {draft.position === "before" ? "avant" : "après"}
          </p>
        </div>

        <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
          Devises prédéfinies
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {PRESETS.map((p) => {
            const active = isPreset(p);
            return (
              <button
                key={p.code}
                data-testid={`currency-preset-${p.code}`}
                onClick={() => setDraft({ ...p })}
                className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-left transition-all active:scale-95 ${
                  active
                    ? "border-[#002FA7] bg-[#002FA7] text-white"
                    : "border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm">{p.label}</p>
                  <p className={`text-xs font-mono mt-0.5 ${active ? "text-white/80" : "text-slate-500"}`}>
                    {p.code} · {p.symbol}
                  </p>
                </div>
                {active && <Check className="h-4 w-4 shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
          Personnalisation
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <Field label="Code (ISO)" testid="currency-code">
            <input
              data-testid="currency-code"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono uppercase outline-none focus:border-[#002FA7]"
            />
          </Field>
          <Field label="Symbole">
            <input
              data-testid="currency-symbol"
              value={draft.symbol}
              onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
              className="w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
          </Field>
          <Field label="Décimales">
            <input
              data-testid="currency-decimals"
              type="number"
              min={0}
              max={4}
              value={draft.decimals}
              onChange={(e) => setDraft({ ...draft, decimals: Math.max(0, Math.min(4, Number(e.target.value) || 0)) })}
              className="w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]"
            />
          </Field>
          <Field label="Position du symbole">
            <select
              data-testid="currency-position"
              value={draft.position}
              onChange={(e) => setDraft({ ...draft, position: e.target.value })}
              className="w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 outline-none focus:border-[#002FA7]"
            >
              <option value="after">Après le montant (ex: 1 234,50 €)</option>
              <option value="before">Avant le montant (ex: $ 1,234.50)</option>
            </select>
          </Field>
        </div>

        <button
          data-testid="save-currency"
          onClick={submit}
          disabled={saving}
          className="h-14 w-full rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer la devise"}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          La nouvelle devise s&apos;applique immédiatement à toute l&apos;application (caisse, rapports, emails).
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// Local preview formatter (does not depend on live currency)
function formatPreview(value, c) {
  const v = Number(value || 0);
  const fixed = v.toFixed(c.decimals);
  const [intPart, decPart] = fixed.split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const num = c.decimals > 0 ? `${withSep},${decPart}` : withSep;
  return c.position === "before" ? `${c.symbol} ${num}` : `${num} ${c.symbol}`;
}

// Re-export to silence unused-import warning for formatCurrency import (we use formatPreview locally)
void formatCurrency;
