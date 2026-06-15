import { useEffect, useState } from "react";
import { Lock, Mail, X, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, todayISO } from "@/lib/api";

const PAYMENT_LABEL = { cash: "Espèces", card: "Carte", mobile: "Mobile Money" };

export default function CloseDayModal({ open, onClose, onClosed }) {
  const [settings, setSettings] = useState(null);
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const load = async () => {
    const [s, r] = await Promise.all([
      api.get("/settings"),
      api.get("/reports/daily", { params: { target_date: todayISO() } }),
    ]);
    setSettings(s.data);
    setData(r.data);
    if (s.data.report_email) setEmail(s.data.report_email);
  };

  useEffect(() => {
    if (!open) {
      setDone(null);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (settings?.email_configured && !email) {
      toast.error("Veuillez saisir une adresse email destinataire");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/reports/daily/send", {
        recipient_email: email || undefined,
        target_date: todayISO(),
      });
      setDone(res.data.email);
      if (res.data.email?.status === "sent") {
        toast.success(`Clôture envoyée à ${res.data.email.to}`);
      } else if (res.data.email?.status === "skipped") {
        toast.warning("Clôture enregistrée. Email simulé (clé Resend manquante).");
      }
      onClosed?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la clôture");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="close-day-modal"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
                Fin de service
              </p>
              <h2 className="text-xl font-bold">Clôturer la journée</h2>
            </div>
          </div>
          <button
            data-testid="close-day-cancel"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-6 p-6">
          {!data ? (
            <p className="text-slate-400">Chargement du récapitulatif…</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Box label="Chiffre du jour" value={formatCurrency(data.total_revenue)} accent />
                <Box label="Ventes" value={data.num_sales} />
                <Box label="Panier moyen" value={formatCurrency(data.avg_ticket)} />
              </div>

              {Object.keys(data.by_payment || {}).length > 0 && (
                <div className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                  <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Par moyen de paiement
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {Object.entries(data.by_payment).map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{PAYMENT_LABEL[k] || k}</span>
                        <span className="font-mono font-semibold">{formatCurrency(v)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!done && (
                <>
                  {settings && !settings.email_configured ? (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-amber-900">
                        <strong>RESEND_API_KEY non configurée.</strong> La clôture sera enregistrée mais l&apos;email sera simulé.
                      </p>
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                      Envoyer le rapport à
                    </span>
                    <input
                      data-testid="close-day-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patron@example.com"
                      className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#002FA7]"
                    />
                  </label>
                </>
              )}

              {done && (
                <div
                  className={`flex items-start gap-3 rounded-md border p-4 ${
                    done.status === "sent"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-300 bg-amber-50"
                  }`}
                  data-testid="close-day-result"
                >
                  {done.status === "sent" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div className="text-sm">
                    {done.status === "sent" ? (
                      <p className="font-semibold text-emerald-900">
                        Email envoyé à {done.to}
                      </p>
                    ) : (
                      <p className="font-semibold text-amber-900">
                        Clôture enregistrée. Email simulé (clé Resend manquante).
                      </p>
                    )}
                    <p className="text-slate-600 mt-1">
                      Vous pouvez retrouver l&apos;historique des clôtures dans l&apos;onglet Rapports.
                    </p>
                  </div>
                </div>
              )}

              {!done ? (
                <button
                  data-testid="close-day-confirm"
                  disabled={loading || !data}
                  onClick={submit}
                  className="flex h-16 w-full items-center justify-center gap-3 rounded-md bg-[#002FA7] text-lg font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                  {loading ? "Clôture en cours…" : "Clôturer & envoyer"}
                </button>
              ) : (
                <button
                  data-testid="close-day-done"
                  onClick={onClose}
                  className="h-14 w-full rounded-md border border-[#E5E7EB] bg-white text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95"
                >
                  Fermer
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Box({ label, value, accent }) {
  return (
    <div
      className={`rounded-md border p-4 ${
        accent ? "border-[#002FA7] bg-[#002FA7] text-white" : "border-[#E5E7EB] bg-[#FAFAFA]"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-[0.1em] font-semibold ${
          accent ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}
