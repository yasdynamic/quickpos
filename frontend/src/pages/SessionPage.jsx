import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, AlertTriangle, CheckCircle2, Banknote, FileText } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, formatDateTime } from "@/lib/api";
import OpenSessionModal from "@/components/OpenSessionModal";

const PAYMENT_LABEL = { cash: "Espèces", card: "Carte", mobile: "Mobile Money" };

export default function SessionPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [xData, setXData] = useState(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showOpen, setShowOpen] = useState(false);
  const [closing, setClosing] = useState("");
  const [email, setEmail] = useState("");
  const [loadingClose, setLoadingClose] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    const [s, h, settingsRes] = await Promise.all([
      api.get("/cash-sessions/current"),
      api.get("/cash-sessions"),
      api.get("/settings"),
    ]);
    setSession(s.data || null);
    setHistory(h.data || []);
    setSettings(settingsRes.data);
    if (settingsRes.data.report_email) setEmail(settingsRes.data.report_email);
    if (s.data) {
      const x = await api.get("/reports/x");
      setXData(x.data);
    } else {
      setXData(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const closeSession = async () => {
    if (!closing || isNaN(parseFloat(closing))) {
      toast.error("Saisissez le montant compté");
      return;
    }
    setLoadingClose(true);
    try {
      const res = await api.post(`/cash-sessions/${session.id}/close`, {
        closing_cash_declared: parseFloat(closing),
        recipient_email: email || undefined,
      });
      setResult(res.data);
      if (res.data.email?.status === "sent") {
        toast.success(`Rapport Z envoyé à ${res.data.email.to}`);
      } else if (res.data.email?.status === "skipped") {
        toast.warning("Session fermée. Email simulé (clé Resend manquante).");
      }
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setLoadingClose(false);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Caisse
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Session de caisse</h1>
        </div>
        {!session && (
          <button
            data-testid="open-session-page-btn"
            onClick={() => setShowOpen(true)}
            className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
          >
            <Banknote className="h-4 w-4" />
            Ouvrir une session
          </button>
        )}
      </header>

      {settings && !settings.email_configured && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">RESEND_API_KEY non configurée</p>
            <p className="text-amber-800 mt-1">
              Le rapport Z sera enregistré, mais l&apos;envoi par email sera simulé.
            </p>
          </div>
        </div>
      )}

      {!session ? (
        <div className="rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-12 text-center">
          <Banknote className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-lg font-semibold">Aucune session ouverte</p>
          <p className="mt-1 text-sm text-slate-500">
            Ouvrez une session pour commencer à enregistrer les ventes.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* X Report */}
          <section className="rounded-md border border-[#E5E7EB] bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0EA5E9] text-white font-bold">
                  X
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    État intermédiaire
                  </p>
                  <h2 className="text-xl font-bold">
                    Session ouverte depuis {formatDateTime(session.opened_at)}
                  </h2>
                </div>
              </div>
              <button
                data-testid="refresh-x"
                onClick={load}
                className="rounded-md border border-[#E5E7EB] px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#FAFAFA]"
              >
                Actualiser
              </button>
            </div>
            {xData && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Stat label="CA" value={formatCurrency(xData.total_revenue)} accent />
                  <Stat label="Ventes" value={xData.num_sales} />
                  <Stat label="Fond initial" value={formatCurrency(session.opening_cash)} />
                  <Stat
                    label="Espèces attendues"
                    value={formatCurrency(xData.expected_cash)}
                  />
                </div>
                {Object.keys(xData.by_payment || {}).length > 0 && (
                  <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                    <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
                      Par moyen de paiement
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {Object.entries(xData.by_payment).map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span>{PAYMENT_LABEL[k] || k}</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(v)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Z Close */}
          {!result && (
            <section className="rounded-md border-2 border-[#0A0A0A] bg-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0A0A0A] text-white font-bold">
                  Z
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Clôture définitive
                  </p>
                  <h2 className="text-xl font-bold">Effectuer la clôture Z</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Espèces comptées en caisse
                  </span>
                  <input
                    data-testid="closing-cash"
                    inputMode="decimal"
                    value={closing}
                    onChange={(e) => setClosing(e.target.value)}
                    placeholder={xData ? xData.expected_cash.toFixed(2) : "0.00"}
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 text-2xl font-bold font-mono outline-none focus:border-[#002FA7]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Email destinataire
                  </span>
                  <input
                    data-testid="close-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patron@example.com"
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#002FA7]"
                  />
                </label>
              </div>
              <button
                data-testid="close-session-confirm"
                disabled={loadingClose}
                onClick={closeSession}
                className="mt-5 flex h-16 w-full items-center justify-center gap-3 rounded-md bg-[#0A0A0A] text-lg font-bold uppercase tracking-wider text-white hover:bg-black active:scale-[0.98] disabled:opacity-50"
              >
                <Lock className="h-5 w-5" />
                {loadingClose ? "Clôture…" : "Clôturer la session & envoyer Z"}
              </button>
            </section>
          )}

          {result && (
            <section
              className="rounded-md border border-emerald-200 bg-emerald-50 p-6"
              data-testid="close-result"
            >
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-emerald-900">
                    Session fermée — Rapport Z généré
                  </h2>
                  <p className="text-sm text-emerald-800 mt-1">
                    {result.email?.status === "sent"
                      ? `Email envoyé à ${result.email.to}`
                      : "Email simulé (clé Resend manquante)."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="CA" value={formatCurrency(result.report.total_revenue)} accent />
                <Stat label="Espèces attendues" value={formatCurrency(result.report.expected_cash)} />
                <Stat label="Espèces comptées" value={formatCurrency(result.report.closing_cash_declared)} />
                <Stat
                  label="Écart"
                  value={formatCurrency(result.report.cash_difference)}
                  diff={result.report.cash_difference}
                />
              </div>
              <button
                onClick={() => navigate("/")}
                className="mt-5 rounded-md border border-emerald-300 bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-emerald-900 hover:bg-emerald-50"
              >
                Retour au plan de salle
              </button>
            </section>
          )}
        </div>
      )}

      <section className="mt-8 rounded-md border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-500">
            Historique des sessions
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="text-slate-400 text-sm">Aucune session enregistrée.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="py-2 text-xs uppercase tracking-wider text-slate-500">Ouverture</th>
                <th className="py-2 text-xs uppercase tracking-wider text-slate-500">Fermeture</th>
                <th className="py-2 text-xs uppercase tracking-wider text-slate-500">Fond</th>
                <th className="py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Comptées</th>
                <th className="py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Écart</th>
                <th className="py-2 text-xs uppercase tracking-wider text-slate-500 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="py-2.5">{formatDateTime(s.opened_at)}</td>
                  <td className="py-2.5">{s.closed_at ? formatDateTime(s.closed_at) : "—"}</td>
                  <td className="py-2.5 font-mono">{formatCurrency(s.opening_cash)}</td>
                  <td className="py-2.5 font-mono text-right">
                    {s.closing_cash_declared != null ? formatCurrency(s.closing_cash_declared) : "—"}
                  </td>
                  <td
                    className={`py-2.5 font-mono font-bold text-right ${
                      s.cash_difference > 0
                        ? "text-emerald-600"
                        : s.cash_difference < 0
                        ? "text-[#FF2A2A]"
                        : ""
                    }`}
                  >
                    {s.cash_difference != null ? formatCurrency(s.cash_difference) : "—"}
                  </td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                        s.status === "open"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.status === "open" ? "Ouverte" : "Fermée"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <OpenSessionModal
        open={showOpen}
        onClose={() => setShowOpen(false)}
        onOpened={() => {
          setShowOpen(false);
          load();
        }}
      />
    </div>
  );
}

function Stat({ label, value, accent, diff }) {
  let cls = "border-[#E5E7EB] bg-[#FAFAFA]";
  if (accent) cls = "border-[#002FA7] bg-[#002FA7] text-white";
  else if (diff != null && diff < 0) cls = "border-[#FF2A2A] bg-red-50 text-[#FF2A2A]";
  else if (diff != null && diff > 0) cls = "border-emerald-300 bg-emerald-50 text-emerald-900";
  return (
    <div className={`rounded-md border p-4 ${cls}`}>
      <p
        className={`text-xs uppercase tracking-[0.1em] font-semibold ${
          accent ? "text-white/70" : ""
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-bold font-mono">{value}</p>
    </div>
  );
}
