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
  const [showOpen, setShowOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reopening, setReopening] = useState(false);

  const load = async () => {
    try {
      const [s, h, o] = await Promise.all([
        api.get("/cash-sessions/current"),
        api.get("/cash-sessions", { params: { limit: 10 } }),
        api.get("/orders", { params: { status: "open" } }),
      ]);
      setSession(s.data || null);
      setHistory(h.data || []);
      setOpenOrders(o.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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
          subtitle="État Z · Envoi automatique par email"
          color="#0A0A0A"
          icon={Lock}
          disabled={!session}
          onClick={() => requireSession(() => navigate("/session?view=z"))}
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

function HubAction({ testid, title, subtitle, color, icon: Icon, onClick, disabled, badge }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start gap-4 rounded-lg border bg-white p-6 text-left transition-transform ${
        disabled
          ? "opacity-40 cursor-not-allowed border-[#E5E7EB]"
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
        <p className="mt-1 text-sm text-[#4B5563]">{subtitle}</p>
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
