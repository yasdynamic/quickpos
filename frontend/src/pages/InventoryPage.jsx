import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Play, Save, Lock, ArrowLeft, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { api, formatDateTime } from "@/lib/api";

export default function InventoryPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [sessions, setSessions] = useState([]);
  const [starting, setStarting] = useState(false);

  const load = async () => {
    const r = await api.get("/inventory/sessions");
    setSessions(r.data || []);
  };

  useEffect(() => {
    if (!params.sessionId) load();
  }, [params.sessionId]);

  const startNew = async () => {
    setStarting(true);
    try {
      const r = await api.post("/inventory/sessions", {});
      toast.success("Inventaire démarré");
      navigate(`/inventaire/${r.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setStarting(false);
    }
  };

  if (params.sessionId) {
    return <InventoryEditor sessionId={params.sessionId} onBack={() => navigate("/inventaire")} />;
  }

  return (
    <div className="p-8" data-testid="inventory-list-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">Stock</p>
          <h1 className="text-4xl font-bold tracking-tight">Inventaire</h1>
        </div>
        <button
          data-testid="new-inventory-btn"
          disabled={starting}
          onClick={startNew}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {starting ? "Démarrage…" : "Démarrer un inventaire"}
        </button>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-lg font-semibold">Aucun inventaire</p>
          <p className="mt-1 text-sm text-slate-500">
            Démarrez un inventaire pour figer les stocks attendus et saisir les
            quantités réellement comptées. Les ajustements sont appliqués à la
            clôture.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFAFA]">
              <tr className="border-b border-[#E5E7EB]">
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Démarré par</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Lignes</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-center">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} data-testid={`inv-session-${s.id}`} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-4 py-2.5">{formatDateTime(s.started_at)}</td>
                  <td className="px-4 py-2.5">{s.started_by || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{(s.counts || []).length}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                        s.status === "open"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.status === "open" ? "En cours" : "Clôturé"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => navigate(`/inventaire/${s.id}`)}
                      className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-[#FAFAFA]"
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InventoryEditor({ sessionId, onBack }) {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = async () => {
    const [s, p] = await Promise.all([
      api.get(`/inventory/sessions/${sessionId}`),
      api.get("/products"),
    ]);
    setSession(s.data);
    setProducts(p.data || []);
    const m = {};
    for (const c of s.data.counts || []) {
      if (c.counted != null) m[c.product_id] = String(c.counted);
    }
    setCounts(m);
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    if (!session) return [];
    const list = session.counts || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const p = productById[c.product_id];
      return p && p.name.toLowerCase().includes(q);
    });
  }, [session, search, productById]);

  const stats = useMemo(() => {
    if (!session) return { counted: 0, total: 0, withVariance: 0, variance: 0 };
    const list = session.counts || [];
    let counted = 0,
      withVariance = 0,
      variance = 0;
    for (const c of list) {
      const v = counts[c.product_id];
      if (v !== undefined && v !== "") {
        counted += 1;
        const diff = parseInt(v, 10) - c.expected;
        if (diff !== 0) {
          withVariance += 1;
          variance += diff;
        }
      }
    }
    return { counted, total: list.length, withVariance, variance };
  }, [session, counts]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        counts: (session.counts || []).map((c) => ({
          product_id: c.product_id,
          expected: c.expected,
          counted:
            counts[c.product_id] !== undefined && counts[c.product_id] !== ""
              ? parseInt(counts[c.product_id], 10)
              : null,
        })),
      };
      await api.put(`/inventory/sessions/${sessionId}`, payload);
      toast.success("Comptage sauvegardé");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (!window.confirm(`Clôturer l'inventaire ?\n\n${stats.withVariance} ajustement(s) seront appliqués au stock.`)) return;
    await save();
    setClosing(true);
    try {
      const r = await api.post(`/inventory/sessions/${sessionId}/close`);
      toast.success(`Inventaire clôturé. ${r.data.adjustments_applied || 0} ajustement(s) appliqués.`);
      onBack();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setClosing(false);
    }
  };

  if (!session) return <div className="p-8 text-slate-400">Chargement…</div>;
  const isClosed = session.status === "closed";

  return (
    <div className="p-8" data-testid="inventory-editor">
      <header className="mb-6">
        <button
          onClick={onBack}
          className="text-xs uppercase tracking-wider font-semibold text-slate-500 hover:text-[#0A0A0A] flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Tous les inventaires
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
              Session {session.id.slice(0, 8)}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Inventaire du {formatDateTime(session.started_at)}
            </h1>
            <p className="text-xs text-slate-500">
              Démarré par {session.started_by || "—"}
              {isClosed && ` · Clôturé le ${formatDateTime(session.closed_at)}`}
            </p>
          </div>
          <div className="flex gap-2">
            {!isClosed && (
              <>
                <button
                  data-testid="inv-save"
                  disabled={saving}
                  onClick={save}
                  className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA]"
                >
                  <Save className="h-4 w-4" />
                  Sauvegarder
                </button>
                <button
                  data-testid="inv-close"
                  disabled={closing}
                  onClick={close}
                  className="flex items-center gap-2 rounded-md bg-[#0A0A0A] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-black disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  {closing ? "Clôture…" : "Clôturer & appliquer"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Lignes comptées" value={`${stats.counted} / ${stats.total}`} color="#002FA7" />
        <Stat label="Lignes restantes" value={stats.total - stats.counted} color="#0EA5E9" />
        <Stat label="Écarts détectés" value={stats.withVariance} color="#F97316" />
        <Stat label="Écart total" value={stats.variance > 0 ? `+${stats.variance}` : stats.variance} color={stats.variance === 0 ? "#10B981" : stats.variance < 0 ? "#FF2A2A" : "#10B981"} />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          data-testid="inv-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAFAFA] sticky top-0">
            <tr className="border-b border-[#E5E7EB]">
              <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Produit</th>
              <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Stock attendu</th>
              <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Stock compté</th>
              <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Écart</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const p = productById[c.product_id];
              if (!p) return null;
              const v = counts[c.product_id] ?? "";
              const diff =
                v === "" ? null : parseInt(v, 10) - c.expected;
              return (
                <tr
                  key={c.product_id}
                  data-testid={`inv-row-${c.product_id}`}
                  className={`border-b border-[#E5E7EB] last:border-0 ${diff && diff !== 0 ? "bg-orange-50/50" : ""}`}
                >
                  <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5 font-mono text-right">{c.expected}</td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      data-testid={`inv-count-${c.product_id}`}
                      disabled={isClosed}
                      inputMode="numeric"
                      value={v}
                      onChange={(e) =>
                        setCounts({
                          ...counts,
                          [c.product_id]: e.target.value.replace(/[^0-9]/g, ""),
                        })
                      }
                      placeholder="–"
                      className="w-24 rounded-md border border-[#E5E7EB] px-2 py-1 font-mono text-right outline-none focus:border-[#002FA7] disabled:bg-slate-50"
                    />
                  </td>
                  <td
                    className={`px-4 py-2.5 font-mono font-bold text-right ${
                      diff === null ? "text-slate-300" :
                      diff === 0 ? "text-emerald-600" :
                      diff > 0 ? "text-emerald-600" : "text-[#FF2A2A]"
                    }`}
                  >
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isClosed && stats.withVariance > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-amber-900">
            <strong>{stats.withVariance} produit(s)</strong> avec écart. À la
            clôture, des mouvements de stock « ajustement » seront créés et le
            stock sera mis à jour.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}
