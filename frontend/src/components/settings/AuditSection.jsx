import { useEffect, useMemo, useState } from "react";
import {
  ScrollText,
  Receipt,
  RotateCcw,
  Ban,
  Lock,
  FileText,
  Settings as SettingsIcon,
  LogIn,
  User,
  Boxes,
  ShieldCheck,
  Search,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatDateTime } from "@/lib/api";

const TYPE_META = {
  TICKET: { label: "Vente", icon: Receipt, color: "#10B981" },
  REFUND: { label: "Avoir", icon: RotateCcw, color: "#FF2A2A" },
  CANCEL: { label: "Annulation", icon: Ban, color: "#F97316" },
  Z: { label: "Clôture Z", icon: Lock, color: "#0A0A0A" },
  X: { label: "Bande de contrôle X", icon: FileText, color: "#0EA5E9" },
  PARAM: { label: "Paramètre", icon: SettingsIcon, color: "#EC4899" },
  LOGIN: { label: "Connexion", icon: LogIn, color: "#A855F7" },
  USER: { label: "Utilisateur", icon: User, color: "#A855F7" },
  STOCK: { label: "Stock", icon: Boxes, color: "#F97316" },
};

const TYPES = ["", ...Object.keys(TYPE_META)];

export default function AuditSection() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (typeFilter) params.type = typeFilter;
      const r = await api.get("/journal", { params });
      setEntries(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [typeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const payload = JSON.stringify(e.payload || {}).toLowerCase();
      return (
        (e.type || "").toLowerCase().includes(q) ||
        (e.ref || "").toLowerCase().includes(q) ||
        payload.includes(q)
      );
    });
  }, [entries, search]);

  const stats = useMemo(() => {
    const counts = {};
    for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1;
    return counts;
  }, [entries]);

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await api.post("/journal/verify");
      setVerification(r.data);
      if (r.data.valid) toast.success(`Journal NF525 valide (${r.data.count} entrées)`);
      else toast.error(`Journal corrompu — ${r.data.reason || "intégrité KO"}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Vérification impossible");
    } finally {
      setVerifying(false);
    }
  };

  const exportCSV = () => {
    const rows = [["seq", "year", "type", "ref", "created_at", "user", "payload"]];
    for (const e of filtered) {
      rows.push([
        e.seq,
        e.year,
        e.type,
        e.ref || "",
        e.created_at,
        e.payload?.by || e.payload?.user_name || "",
        JSON.stringify(e.payload || {}).replace(/"/g, '""'),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warya-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exporté");
  };

  return (
    <section className="space-y-5" data-testid="audit-section">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Audit & Traçabilité</h2>
              <p className="text-xs text-slate-500">
                Journal NF525 immuable. Toutes les actions sensibles sont
                cryptographiquement chaînées (hash + previous_hash).
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              data-testid="audit-export"
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#FAFAFA] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              data-testid="audit-verify"
              onClick={verify}
              disabled={verifying}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {verifying ? "Vérification…" : "Vérifier l'intégrité"}
            </button>
          </div>
        </div>
        {verification && (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              verification.valid
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-[#FF2A2A] bg-red-50 text-red-900"
            }`}
          >
            <strong>
              {verification.valid ? "✓ Chaîne valide" : "✗ Chaîne corrompue"}
            </strong>{" "}
            — {verification.count} entrée(s) vérifiée(s)
            {verification.reason && ` · ${verification.reason}`}
          </div>
        )}
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(TYPE_META).map((t) => {
          const M = TYPE_META[t];
          const Icon = M.icon;
          const count = stats[t] || 0;
          return (
            <button
              key={t}
              data-testid={`audit-filter-${t}`}
              onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                typeFilter === t
                  ? "text-white"
                  : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#FAFAFA]"
              }`}
              style={typeFilter === t ? { backgroundColor: M.color, borderColor: M.color } : {}}
            >
              <Icon className="h-3.5 w-3.5" />
              {M.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                typeFilter === t ? "bg-white/30" : "bg-slate-100 text-slate-600"
              }`}>{count}</span>
            </button>
          );
        })}
        {typeFilter && (
          <button
            onClick={() => setTypeFilter("")}
            className="rounded-full bg-[#0A0A0A] text-white px-3 py-1.5 text-xs font-semibold"
          >
            × Effacer filtre
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          data-testid="audit-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans la charge utile…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">Aucune entrée.</p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] max-h-[60vh] overflow-y-auto" data-testid="audit-entries">
            {filtered.map((e) => {
              const M = TYPE_META[e.type] || { label: e.type, icon: ScrollText, color: "#4B5563" };
              const Icon = M.icon;
              const who = e.payload?.by || e.payload?.user_name || e.payload?.refunded_by || "—";
              return (
                <li key={`${e.year}-${e.seq}`} className="px-4 py-3 flex items-start gap-3" data-testid={`audit-entry-${e.seq}`}>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: M.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{M.label}</span>
                      <code className="font-mono text-[10px] text-slate-400">#{e.seq}</code>
                      {e.ref && (
                        <code className="font-mono text-[10px] text-slate-500 truncate">
                          {String(e.ref).slice(0, 16)}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.created_at)} · par <strong className="text-[#0A0A0A]">{who}</strong>
                    </p>
                    {e.payload && Object.keys(e.payload).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[10px] uppercase tracking-wider font-bold text-slate-400 cursor-pointer hover:text-[#002FA7]">
                          Détails ({Object.keys(e.payload).length})
                        </summary>
                        <pre className="mt-1 rounded bg-[#FAFAFA] p-2 text-[10px] font-mono text-slate-700 overflow-x-auto max-w-full">
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <code className="font-mono text-[10px] text-slate-300 hidden md:block" title={`hash ${e.hash || ''}`}>
                    {(e.hash || "").slice(0, 8)}…
                  </code>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
