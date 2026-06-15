import { useEffect, useState } from "react";
import { Mail, Send, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, todayISO } from "@/lib/api";

export default function ReportsPage() {
  const [settings, setSettings] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [email, setEmail] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [closures, setClosures] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [preview, setPreview] = useState(null);

  const loadSettings = async () => {
    const res = await api.get("/settings");
    setSettings(res.data);
    if (res.data.report_email) setEmail(res.data.report_email);
  };
  const loadClosures = async () => {
    const res = await api.get("/closures");
    setClosures(res.data);
  };

  useEffect(() => {
    loadSettings();
    loadClosures();
  }, []);

  const previewDaily = async () => {
    const res = await api.get("/reports/daily", { params: { target_date: date } });
    setPreview({ type: "daily", data: res.data });
  };

  const sendDaily = async () => {
    if (!email && settings?.email_configured) {
      toast.error("Veuillez saisir un email de destination");
      return;
    }
    setLoadingDaily(true);
    try {
      const res = await api.post("/reports/daily/send", {
        recipient_email: email || undefined,
        target_date: date,
      });
      if (res.data.email?.status === "sent") {
        toast.success(`Rapport envoyé à ${res.data.email.to}`);
      } else if (res.data.email?.status === "skipped") {
        toast.warning("Email simulé (RESEND_API_KEY non configurée). Rapport enregistré.");
      }
      setPreview({ type: "daily", data: res.data.report });
      loadClosures();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setLoadingDaily(false);
    }
  };

  const sendMonthly = async () => {
    setLoadingMonthly(true);
    try {
      const res = await api.post("/reports/monthly/send", {
        recipient_email: email || undefined,
        year: Number(year),
        month: Number(month),
      });
      if (res.data.email?.status === "sent") {
        toast.success(`Rapport mensuel envoyé à ${res.data.email.to}`);
      } else if (res.data.email?.status === "skipped") {
        toast.warning("Email simulé (RESEND_API_KEY non configurée).");
      }
      setPreview({ type: "monthly", data: res.data.report });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setLoadingMonthly(false);
    }
  };

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
          Communication
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Rapports & Clôtures</h1>
      </header>

      {settings && !settings.email_configured && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">RESEND_API_KEY non configurée</p>
            <p className="text-sm text-amber-800 mt-1">
              Les rapports sont calculés et stockés, mais l'envoi par email est désactivé.
              Ajoutez votre clé Resend dans <code>/app/backend/.env</code> puis redémarrez le backend.
            </p>
          </div>
        </div>
      )}
      {settings?.email_configured && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-emerald-900 font-medium">
            Envoi email activé via Resend ({settings.sender_email})
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Daily */}
        <section className="rounded-md border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-xl font-bold mb-4">Clôture journalière</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Date
              </span>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-[#E5E7EB] px-3 py-2.5">
                <Calendar className="h-4 w-4 text-slate-500" />
                <input
                  data-testid="report-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 bg-transparent outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Email destinataire
              </span>
              <input
                data-testid="report-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patron@example.com"
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              data-testid="preview-daily-btn"
              onClick={previewDaily}
              className="flex-1 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95"
            >
              Aperçu
            </button>
            <button
              data-testid="send-daily-btn"
              onClick={sendDaily}
              disabled={loadingDaily}
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#002FA7] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loadingDaily ? "Envoi…" : "Clôturer & envoyer"}
            </button>
          </div>
        </section>

        {/* Monthly */}
        <section className="rounded-md border border-[#E5E7EB] bg-white p-6">
          <h2 className="text-xl font-bold mb-4">État mensuel</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Année
              </span>
              <input
                data-testid="report-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7] font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                Mois
              </span>
              <select
                data-testid="report-month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 outline-none focus:border-[#002FA7]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            data-testid="send-monthly-btn"
            onClick={sendMonthly}
            disabled={loadingMonthly}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[#0A0A0A] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-black active:scale-95 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {loadingMonthly ? "Envoi…" : "Générer & envoyer"}
          </button>
        </section>
      </div>

      {/* Preview */}
      {preview && (
        <section className="mb-6 rounded-md border border-[#E5E7EB] bg-white p-6" data-testid="report-preview">
          <h3 className="mb-4 text-xs uppercase tracking-wider font-semibold text-slate-500">
            Aperçu du rapport {preview.type === "daily" ? "journalier" : "mensuel"}
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Box label="CA" value={formatCurrency(preview.data.total_revenue)} accent />
            <Box label="Ventes" value={preview.data.num_sales} />
            <Box label="Panier moyen" value={formatCurrency(preview.data.avg_ticket)} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
                Par moyen de paiement
              </p>
              <ul className="space-y-1 text-sm">
                {Object.entries(preview.data.by_payment || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between border-b border-[#F4F6FB] py-1.5">
                    <span>{k === "cash" ? "Espèces" : k === "card" ? "Carte" : "Mobile Money"}</span>
                    <span className="font-mono font-semibold">{formatCurrency(v)}</span>
                  </li>
                ))}
                {(!preview.data.by_payment || Object.keys(preview.data.by_payment).length === 0) && (
                  <li className="text-slate-400 text-sm">Aucune vente.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
                Top produits
              </p>
              <ul className="space-y-1 text-sm">
                {(preview.data.top_products || []).slice(0, 5).map((p, i) => (
                  <li key={i} className="flex justify-between border-b border-[#F4F6FB] py-1.5">
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="font-mono">{p.qty} · {formatCurrency(p.revenue)}</span>
                  </li>
                ))}
                {(!preview.data.top_products || preview.data.top_products.length === 0) && (
                  <li className="text-slate-400 text-sm">—</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Closures history */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6">
        <h2 className="text-sm uppercase tracking-wider font-semibold text-slate-500 mb-4">
          Clôtures récentes
        </h2>
        {closures.length === 0 ? (
          <p className="text-slate-400 text-sm">Aucune clôture enregistrée.</p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]" data-testid="closures-list">
            {closures.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold">{c.date}</p>
                  <p className="text-xs text-slate-500">
                    {c.email_status?.status === "sent"
                      ? `Envoyé à ${c.email_status.to}`
                      : c.email_status?.status === "skipped"
                      ? "Email non configuré (simulé)"
                      : "—"}
                  </p>
                </div>
                <span className="font-bold font-mono text-[#002FA7]">
                  {formatCurrency(c.data?.total_revenue || 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
