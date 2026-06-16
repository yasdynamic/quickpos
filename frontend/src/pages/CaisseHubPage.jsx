import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Clock,
  FileText,
  Lock,
  Banknote,
  Unlock,
  RotateCcw,
  AlertTriangle,
  TrendingUp,
  Receipt,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, formatDateTime } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OpenSessionModal from "@/components/OpenSessionModal";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function CaisseHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [showOpen, setShowOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reopening, setReopening] = useState(false);

  const load = async () => {
    try {
      const [s, h, o, d] = await Promise.all([
        api.get("/cash-sessions/current"),
        api.get("/cash-sessions", { params: { limit: 10 } }),
        api.get("/orders", { params: { status: "open" } }),
        api.get("/dashboard"),
      ]);
      setSession(s.data || null);
      setHistory(h.data || []);
      setOpenOrders(o.data || []);
      setDashboard(d.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(id);
  }, []);

  // A closed session of the SAME calendar day → eligible to reopen
  const reopenableSession = useMemo(() => {
    if (session) return null;
    const today = todayISO();
    return (
      history.find(
        (s) =>
          s.status === "closed" &&
          (s.closed_at || "").slice(0, 10) === today
      ) || null
    );
  }, [history, session]);

  const reopenDay = async () => {
    if (!reopenableSession) return;
    setReopening(true);
    try {
      await api.post(`/cash-sessions/${reopenableSession.id}/reopen`);
      toast.success("Journée réouverte");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur de réouverture");
    } finally {
      setReopening(false);
    }
  };

  const requireSession = (next) => {
    if (!session) {
      toast.warning("Ouvrez d'abord la caisse");
      setShowOpen(true);
      return;
    }
    next();
  };

  const goClose = () => {
    if (!session) {
      toast.warning("Ouvrez d'abord la caisse");
      setShowOpen(true);
      return;
    }
    if (openOrders.length > 0) {
      toast.warning(
        `Clôture impossible : ${openOrders.length} vente(s) en attente. Encaissez ou annulez avant.`,
      );
      navigate("/tables");
      return;
    }
    navigate("/session?view=z");
  };

  const pendingTotal = openOrders.reduce((s, o) => s + (o.total || 0), 0);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500 text-sm">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto" data-testid="caisse-hub">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Caisse
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Bonjour {user?.name?.split(" ")[0] || ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {session
              ? `Session ouverte depuis ${formatDateTime(session.opened_at)}`
              : "Aucune session de caisse ouverte"}
          </p>
        </div>
        <SessionStatusCard
          session={session}
          reopenableSession={reopenableSession}
          onOpen={() => setShowOpen(true)}
          onReopen={reopenDay}
          reopening={reopening}
        />
      </header>

      {!session && !reopenableSession && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">
              Ouvrez la caisse pour commencer
            </p>
            <p className="text-amber-800 mt-1">
              Aucune vente ne peut être enregistrée tant que la caisse n&apos;est
              pas ouverte. Vous pourrez ensuite encaisser, suivre la bande de
              contrôle, et clôturer la journée.
            </p>
          </div>
        </div>
      )}

      {dashboard && <LiveDashboard data={dashboard} />}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <HubAction
          testid="hub-direct-sale"
          title="Vente directe"
          subtitle="Encaissement rapide au comptoir"
          color="#002FA7"
          icon={Zap}
          disabled={!session}
          onClick={() => requireSession(() => navigate("/vente-rapide"))}
        />
        <HubAction
          testid="hub-pending-sales"
          title="Ventes en attente"
          subtitle={
            openOrders.length === 0
              ? "Aucune table ouverte"
              : `${openOrders.length} commande${openOrders.length > 1 ? "s" : ""} · ${formatCurrency(pendingTotal)}`
          }
          color="#F97316"
          icon={Clock}
          disabled={!session}
          onClick={() => requireSession(() => navigate("/tables"))}
          badge={openOrders.length > 0 ? openOrders.length : null}
        />
        <HubAction
          testid="hub-control-tape"
          title="Bande de contrôle"
          subtitle="État X · Aperçu intermédiaire"
          color="#0EA5E9"
          icon={FileText}
          disabled={!session}
          onClick={() => requireSession(() => navigate("/session?view=x"))}
        />
        <HubAction
          testid="hub-close-day"
          title="Clôture de la journée"
          subtitle={
            openOrders.length > 0
              ? `Bloqué · ${openOrders.length} vente(s) en attente`
              : "État Z · Envoi automatique par email"
          }
          color="#0A0A0A"
          icon={Lock}
          disabled={!session}
          warning={!!session && openOrders.length > 0}
          onClick={goClose}
        />
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">
            Dernières sessions
          </h2>
          <div className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAFAFA]">
                <tr className="border-b border-[#E5E7EB]">
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
                    Ouverture
                  </th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
                    Fermeture
                  </th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
                    Serveur
                  </th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">
                    Écart
                  </th>
                  <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-center">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 6).map((s) => (
                  <tr key={s.id} className="border-b border-[#E5E7EB] last:border-0">
                    <td className="px-4 py-2.5">{formatDateTime(s.opened_at)}</td>
                    <td className="px-4 py-2.5">
                      {s.closed_at ? formatDateTime(s.closed_at) : "—"}
                    </td>
                    <td className="px-4 py-2.5">{s.server_name || "—"}</td>
                    <td
                      className={`px-4 py-2.5 font-mono font-bold text-right ${
                        s.cash_difference > 0
                          ? "text-emerald-600"
                          : s.cash_difference < 0
                          ? "text-[#FF2A2A]"
                          : ""
                      }`}
                    >
                      {s.cash_difference != null
                        ? formatCurrency(s.cash_difference)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
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
          </div>
        </section>
      )}

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

function SessionStatusCard({ session, reopenableSession, onOpen, onReopen, reopening }) {
  if (session) {
    return (
      <div
        className="flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-5 py-3"
        data-testid="hub-session-open"
      >
        <Unlock className="h-5 w-5 text-emerald-700" />
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">
            Caisse ouverte
          </p>
          <p className="text-sm font-bold text-emerald-900">
            Fond {formatCurrency(session.opening_cash || 0)} ·{" "}
            {session.server_name || "—"}
          </p>
        </div>
      </div>
    );
  }
  if (reopenableSession) {
    return (
      <button
        data-testid="hub-reopen-day-btn"
        onClick={onReopen}
        disabled={reopening}
        className="flex items-center gap-3 rounded-md border border-[#F97316] bg-[#F97316] px-5 py-3 text-white hover:bg-[#EA6B0E] active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        <RotateCcw className="h-5 w-5" />
        <div className="text-left">
          <p className="text-xs uppercase tracking-wider font-semibold opacity-80">
            Journée clôturée
          </p>
          <p className="text-sm font-bold">
            {reopening ? "Réouverture…" : "Rouvrir la journée"}
          </p>
        </div>
      </button>
    );
  }
  return (
    <button
      data-testid="hub-open-session-btn"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-md bg-[#002FA7] px-5 py-3 text-white hover:bg-[#002277] active:scale-[0.98] transition-transform"
    >
      <Banknote className="h-5 w-5" />
      <div className="text-left">
        <p className="text-xs uppercase tracking-wider font-semibold opacity-80">
          Démarrer
        </p>
        <p className="text-sm font-bold">Ouvrir la caisse</p>
      </div>
    </button>
  );
}

function HubAction({ testid, title, subtitle, color, icon: Icon, onClick, disabled, badge, warning }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start gap-4 rounded-lg border bg-white p-6 text-left transition-transform ${
        disabled
          ? "opacity-40 cursor-not-allowed border-[#E5E7EB]"
          : warning
          ? "border-amber-400 ring-2 ring-amber-100 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
          : "border-[#E5E7EB] hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      }`}
      style={{ minHeight: 180 }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-md text-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight">{title}</p>
        <p className={`mt-1 text-sm ${warning ? "text-amber-700 font-semibold" : "text-[#4B5563]"}`}>{subtitle}</p>
      </div>
      {badge != null && (
        <span
          className="absolute right-4 top-4 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#F97316] px-2 text-xs font-bold text-white"
          data-testid={`${testid}-badge`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}


function LiveDashboard({ data }) {
  const top = (data.top_products || []).slice(0, 3);
  return (
    <section
      data-testid="hub-live-dashboard"
      className="mb-6 rounded-lg border border-[#E5E7EB] bg-white overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-gradient-to-r from-[#002FA7] to-[#0048D8] px-5 py-3">
        <div className="flex items-center gap-2 text-white">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs uppercase tracking-[0.15em] font-bold">
            Performances en direct · {(data.date || "").split("-").reverse().join("/")}
          </span>
        </div>
        <span
          data-testid="hub-live-pulse"
          className="flex items-center gap-2 text-xs text-white/80"
          title="Mise à jour automatique toutes les 30 s"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#E5E7EB]">
        <StatCell
          testid="stat-revenue"
          label="Chiffre d'affaires"
          value={formatCurrency(data.total_revenue || 0)}
          icon={TrendingUp}
          color="#002FA7"
        />
        <StatCell
          testid="stat-sales"
          label="Ventes"
          value={data.num_sales || 0}
          icon={Receipt}
          color="#10B981"
        />
        <StatCell
          testid="stat-avg-ticket"
          label="Panier moyen"
          value={formatCurrency(data.avg_ticket || 0)}
          icon={ShoppingBag}
          color="#F97316"
        />
        <StatCell
          testid="stat-top-product"
          label="Top produit"
          value={top[0]?.name || "—"}
          subvalue={top[0] ? `${top[0].qty} · ${formatCurrency(top[0].revenue)}` : null}
          icon={Trophy}
          color="#EC4899"
        />
      </div>
      {top.length > 0 && (
        <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] px-5 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-2">
            Top 3 du jour
          </p>
          <ol className="space-y-1.5" data-testid="hub-top-products">
            {top.map((p, i) => (
              <li
                key={p.name + i}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: ["#EC4899", "#F97316", "#0EA5E9"][i] }}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{p.name}</span>
                </span>
                <span className="font-mono text-xs text-slate-600 shrink-0">
                  {p.qty} · {formatCurrency(p.revenue)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function StatCell({ testid, label, value, subvalue, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4" data-testid={testid}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500">
          {label}
        </p>
        <p className="text-lg font-bold font-mono truncate" title={String(value)}>
          {value}
        </p>
        {subvalue && (
          <p className="text-[11px] text-slate-500 truncate">{subvalue}</p>
        )}
      </div>
    </div>
  );
}
