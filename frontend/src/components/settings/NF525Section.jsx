import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, Star, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatDateTime } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

export default function NF525Section() {
  const { settings, save } = useSettings();
  const [summary, setSummary] = useState(null);
  const [verify, setVerify] = useState(null);
  const [entries, setEntries] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [loyalty, setLoyalty] = useState(settings.loyalty);
  const [savingLoyalty, setSavingLoyalty] = useState(false);

  const load = async () => {
    const [s, j] = await Promise.all([
      api.get("/journal/summary"),
      api.get("/journal?limit=20"),
    ]);
    setSummary(s.data);
    setEntries(j.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const runVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.post("/journal/verify");
      setVerify(res.data);
      if (res.data.valid) toast.success("Chaîne du journal intègre");
      else toast.error(res.data.error || "Chaîne altérée");
    } finally {
      setVerifying(false);
    }
  };

  const saveLoyalty = async () => {
    setSavingLoyalty(true);
    try {
      await save({ loyalty });
      toast.success("Fidélité enregistrée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSavingLoyalty(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* NF525 */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#10B981] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Conformité
            </p>
            <h2 className="text-xl font-bold">Journal NF525</h2>
          </div>
        </div>

        <p className="mb-4 text-sm text-[#4B5563]">
          Chaque vente, annulation et clôture est enregistrée dans un journal immuable, signée SHA-256
          et chaînée à la précédente. Aucune modification possible — toute altération est détectable.
        </p>

        {summary && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Box label="Année fiscale" value={summary.year} />
            <Box label="Entrées" value={summary.count} accent />
            <Box label="Dernier seq." value={`#${summary.last_seq || 0}`} />
          </div>
        )}

        {summary?.last_hash && (
          <div className="mb-4 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] p-3">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Empreinte de fin de chaîne
            </p>
            <p className="mt-1 font-mono text-xs break-all" data-testid="journal-last-hash">
              {summary.last_hash}
            </p>
            {summary.last_signed_at && (
              <p className="mt-1 text-xs text-slate-500">
                Signée le {formatDateTime(summary.last_signed_at)}
              </p>
            )}
          </div>
        )}

        <button
          data-testid="verify-journal-btn"
          onClick={runVerify}
          disabled={verifying}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#10B981] px-5 text-sm font-bold uppercase tracking-wider text-white hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${verifying ? "animate-spin" : ""}`} />
          Vérifier l&apos;intégrité
        </button>

        {verify && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-md p-3 text-sm ${
              verify.valid ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
            }`}
            data-testid="verify-result"
          >
            {verify.valid ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {verify.valid ? "Chaîne intègre" : "Anomalie détectée"}
              </p>
              <p>
                {verify.valid
                  ? `${verify.count} entrée(s) vérifiée(s) jusqu'au seq #${verify.last_seq}`
                  : verify.error}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
            20 dernières entrées
          </p>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune entrée</p>
          ) : (
            <ul className="space-y-1 text-xs font-mono" data-testid="journal-entries">
              {entries.map((e) => (
                <li key={e.id} className="flex gap-2 py-1 border-b border-[#F4F6FB] last:border-0">
                  <span className="text-slate-500 w-12">#{e.seq}</span>
                  <span className="font-bold w-16">{e.type}</span>
                  <span className="text-slate-600 w-32 truncate">{e.signed_at?.slice(11, 19)}</span>
                  <span className="text-slate-400 truncate flex-1">{e.hash_current.slice(0, 24)}…</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Loyalty */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F97316] text-white">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Fidélisation
            </p>
            <h2 className="text-xl font-bold">Programme de fidélité</h2>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-md border-2 border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            data-testid="loyalty-enabled"
            checked={!!loyalty.enabled}
            onChange={(e) => setLoyalty({ ...loyalty, enabled: e.target.checked })}
            className="h-5 w-5"
          />
          <span className="font-semibold">Activer le programme de fidélité</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Points gagnés par {settings?.currency?.symbol} dépensé
            </span>
            <input
              data-testid="loyalty-rate"
              type="number"
              step="0.1"
              value={loyalty.points_per_currency}
              onChange={(e) => setLoyalty({ ...loyalty, points_per_currency: parseFloat(e.target.value) || 0 })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]"
            />
            <p className="text-xs text-slate-500 mt-1">Ex: 1.0 = 1 point par {settings?.currency?.symbol}</p>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Points pour 1 {settings?.currency?.symbol} de remise
            </span>
            <input
              data-testid="loyalty-redemption"
              type="number"
              step="1"
              value={loyalty.points_redemption_rate}
              onChange={(e) => setLoyalty({ ...loyalty, points_redemption_rate: parseFloat(e.target.value) || 100 })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]"
            />
            <p className="text-xs text-slate-500 mt-1">Ex: 100 = 100 points donnent 1 {settings?.currency?.symbol}</p>
          </label>
        </div>

        <button
          data-testid="save-loyalty"
          onClick={saveLoyalty}
          disabled={savingLoyalty}
          className="mt-5 h-12 w-full rounded-md bg-[#F97316] text-sm font-bold uppercase tracking-wider text-white hover:bg-orange-600 active:scale-95 disabled:opacity-50"
        >
          {savingLoyalty ? "Enregistrement…" : "Enregistrer fidélité"}
        </button>
      </section>
    </div>
  );
}

function Box({ label, value, accent }) {
  return (
    <div className={`rounded-md border p-4 ${accent ? "border-[#10B981] bg-emerald-50" : "border-[#E5E7EB] bg-[#FAFAFA]"}`}>
      <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}
