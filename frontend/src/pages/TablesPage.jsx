import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Lock, Unlock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, formatDateTime } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OpenSessionModal from "@/components/OpenSessionModal";

export default function TablesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeZone, setActiveZone] = useState("all");
  const [session, setSession] = useState(null);
  const [showOpenSession, setShowOpenSession] = useState(false);

  const load = async () => {
    const [z, t, s] = await Promise.all([
      api.get("/zones"),
      api.get("/tables"),
      api.get("/cash-sessions/current"),
    ]);
    setZones(z.data);
    setTables(t.data);
    setSession(s.data || null);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const filtered =
    activeZone === "all" ? tables : tables.filter((t) => t.zone_id === activeZone);

  const openTable = async (table) => {
    if (!session) {
      toast.error("Ouvrez d'abord une session de caisse");
      setShowOpenSession(true);
      return;
    }
    try {
      // Either open existing order or create new
      const res = await api.post("/orders", {
        table_id: table.id,
        server_id: user?.id,
        covers: table.covers || 1,
      });
      navigate(`/commande/${res.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Service
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Plan de salle</h1>
        </div>
        <SessionBadge
          session={session}
          onOpen={() => setShowOpenSession(true)}
          onClose={() => navigate("/session")}
        />
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          data-testid="zone-all"
          onClick={() => setActiveZone("all")}
          className={`rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
            activeZone === "all"
              ? "bg-[#0A0A0A] text-white"
              : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
          }`}
        >
          Toutes
        </button>
        {zones.map((z) => (
          <button
            key={z.id}
            data-testid={`zone-${z.id}`}
            onClick={() => setActiveZone(z.id)}
            className={`rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
              activeZone === z.id
                ? "text-white"
                : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
            }`}
            style={activeZone === z.id ? { backgroundColor: z.color } : {}}
          >
            {z.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="tables-grid">
        {filtered.map((t) => {
          const zone = zones.find((z) => z.id === t.zone_id);
          const occupied = t.status === "occupied";
          return (
            <button
              key={t.id}
              data-testid={`table-${t.name}`}
              onClick={() => openTable(t)}
              className={`group relative flex flex-col rounded-md border p-5 text-left transition-all hover:shadow-md active:scale-[0.97] ${
                occupied
                  ? "border-[#002FA7] bg-[#002FA7] text-white"
                  : "border-[#E5E7EB] bg-white text-[#0A0A0A]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="h-2 w-10 rounded-full"
                  style={{ backgroundColor: occupied ? "#fff" : zone?.color }}
                />
                <span className={`text-xs uppercase tracking-wider font-bold ${occupied ? "text-white/80" : "text-slate-500"}`}>
                  {zone?.name}
                </span>
              </div>
              <span className="text-3xl font-bold tracking-tight">{t.name}</span>
              <span className={`mt-1 text-xs uppercase tracking-wider ${occupied ? "text-white/70" : "text-slate-500"}`}>
                {t.capacity} couverts max
              </span>
              {occupied && (
                <div className="mt-4 space-y-1">
                  <p className="text-2xl font-bold font-mono">
                    {formatCurrency(t.order_total)}
                  </p>
                  <p className="text-xs text-white/80">
                    {t.server_name || "—"} · {formatDateTime(t.order_opened_at)}
                  </p>
                </div>
              )}
              {!occupied && (
                <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Libre
                </p>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-slate-400">Aucune table dans cette zone.</p>
        )}
      </div>

      <OpenSessionModal
        open={showOpenSession}
        onClose={() => setShowOpenSession(false)}
        onOpened={(s) => {
          setSession(s);
          setShowOpenSession(false);
        }}
      />
    </div>
  );
}

function SessionBadge({ session, onOpen, onClose }) {
  if (!session) {
    return (
      <button
        data-testid="open-session-cta"
        onClick={onOpen}
        className="flex items-center gap-2 rounded-md bg-[#FF2A2A] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-red-700 active:scale-95"
      >
        <AlertCircle className="h-4 w-4" />
        Ouvrir une session
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3" data-testid="session-badge-open">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm">
        <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">
          Session ouverte
        </p>
        <p className="font-bold text-emerald-900">
          Fond : {formatCurrency(session.opening_cash)}
        </p>
      </div>
      <button
        data-testid="goto-session"
        onClick={onClose}
        className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95"
      >
        <Lock className="h-4 w-4" />
        Clôturer Z
      </button>
    </div>
  );
}
