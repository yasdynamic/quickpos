import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Trash2, Pencil, X, Save, MapPin, Palette } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const COLORS = ["#002FA7", "#10B981", "#F97316", "#EC4899", "#0EA5E9", "#A855F7", "#FF2A2A", "#0A0A0A"];

export default function TablePlanPage() {
  const [zones, setZones] = useState([]);
  const [tables, setTables] = useState([]);
  const [activeZone, setActiveZone] = useState("all");
  const [zoneModal, setZoneModal] = useState(null);
  const [tableModal, setTableModal] = useState(null);

  const load = async () => {
    const [z, t] = await Promise.all([api.get("/zones"), api.get("/tables")]);
    setZones(z.data || []);
    setTables(t.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTables = useMemo(
    () =>
      activeZone === "all"
        ? tables
        : tables.filter((t) => t.zone_id === activeZone),
    [activeZone, tables],
  );

  const totalCapacity = useMemo(
    () => filteredTables.reduce((s, t) => s + (t.capacity || 0), 0),
    [filteredTables],
  );

  return (
    <div className="p-8" data-testid="tableplan-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">Configuration</p>
          <h1 className="text-4xl font-bold tracking-tight">Plan de salle</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organisez vos zones (terrasse, salle, bar…), créez vos tables et
            définissez le nombre de couverts par table.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="add-zone-btn"
            onClick={() => setZoneModal({ name: "", color: COLORS[0] })}
            className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Zone
          </button>
          <button
            data-testid="add-table-btn"
            disabled={zones.length === 0}
            onClick={() => setTableModal({
              name: "",
              zone_id: zones[0]?.id || "",
              capacity: 2,
              x: 0, y: 0,
            })}
            className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Table
          </button>
        </div>
      </header>

      {zones.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-12 text-center">
          <MapPin className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-lg font-semibold">Aucune zone configurée</p>
          <p className="mt-1 text-sm text-slate-500">
            Commencez par créer une zone (ex. « Salle », « Terrasse »), puis
            ajoutez des tables.
          </p>
        </div>
      ) : (
        <>
          {/* Zone tabs */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              data-testid="zone-tab-all"
              onClick={() => setActiveZone("all")}
              className={`rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                activeZone === "all"
                  ? "bg-[#0A0A0A] text-white"
                  : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
              }`}
            >
              Toutes ({tables.length})
            </button>
            {zones.map((z) => {
              const count = tables.filter((t) => t.zone_id === z.id).length;
              return (
                <div key={z.id} className="flex items-center gap-1">
                  <button
                    data-testid={`zone-tab-${z.id}`}
                    onClick={() => setActiveZone(z.id)}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                      activeZone === z.id ? "text-white" : "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB]"
                    }`}
                    style={activeZone === z.id ? { backgroundColor: z.color } : {}}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: z.color }}
                    />
                    {z.name} <span className="opacity-70">({count})</span>
                  </button>
                  <button
                    data-testid={`zone-edit-${z.id}`}
                    onClick={() => setZoneModal(z)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAFAFA]"
                    title="Modifier la zone"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Zones" value={zones.length} color="#002FA7" />
            <Stat label="Tables" value={filteredTables.length} color="#10B981" />
            <Stat label="Couverts" value={totalCapacity} color="#F97316" />
            <Stat
              label="Moyenne couv./table"
              value={filteredTables.length ? (totalCapacity / filteredTables.length).toFixed(1) : "—"}
              color="#EC4899"
            />
          </div>

          {/* Tables grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredTables.map((t) => {
              const zone = zones.find((z) => z.id === t.zone_id);
              return (
                <div
                  key={t.id}
                  data-testid={`tableplan-card-${t.id}`}
                  className="group relative rounded-md border-2 bg-white p-4 transition-all hover:shadow-md"
                  style={{ borderColor: zone?.color || "#E5E7EB" }}
                >
                  <button
                    data-testid={`tableplan-edit-${t.id}`}
                    onClick={() => setTableModal(t)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    {zone?.name || "—"}
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{t.name}</p>
                  <div className="mt-3 flex items-center gap-1 text-sm">
                    <Users className="h-4 w-4 text-[#4B5563]" />
                    <span className="font-mono font-bold">{t.capacity}</span>
                    <span className="text-slate-500 text-xs">couverts</span>
                  </div>
                </div>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="col-span-full rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-8 text-center text-slate-400">
                Aucune table dans cette zone.
              </div>
            )}
          </div>
        </>
      )}

      {zoneModal && (
        <ZoneModal
          zone={zoneModal}
          onClose={() => setZoneModal(null)}
          onSaved={() => { setZoneModal(null); load(); }}
        />
      )}
      {tableModal && (
        <TableModal
          table={tableModal}
          zones={zones}
          onClose={() => setTableModal(null)}
          onSaved={() => { setTableModal(null); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}

function ZoneModal({ zone, onClose, onSaved }) {
  const [name, setName] = useState(zone.name || "");
  const [color, setColor] = useState(zone.color || COLORS[0]);
  const [saving, setSaving] = useState(false);
  const isNew = !zone.id;

  const save = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    setSaving(true);
    try {
      if (isNew) await api.post("/zones", { name: name.trim(), color });
      else await api.put(`/zones/${zone.id}`, { name: name.trim(), color });
      toast.success(isNew ? "Zone créée" : "Zone mise à jour");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Supprimer la zone « ${zone.name} » ? Toutes les tables associées seront détachées.`)) return;
    try {
      await api.delete(`/zones/${zone.id}`);
      toast.success("Zone supprimée");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="zone-modal">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md text-white" style={{ backgroundColor: color }}>
              <MapPin className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold">{isNew ? "Nouvelle zone" : "Modifier la zone"}</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-6">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom *</span>
            <input
              data-testid="zone-name-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Salle, Terrasse, Bar"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#002FA7]"
              onKeyDown={(e) => { if (e.key === "Enter" && !saving) save(); }}
            />
          </label>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1 mb-2">
              <Palette className="h-3 w-3" /> Couleur
            </p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  data-testid={`zone-color-${c}`}
                  onClick={() => setColor(c)}
                  className={`h-10 w-10 rounded-md border-2 transition-transform active:scale-90 ${
                    color === c ? "ring-2 ring-offset-2 ring-[#0A0A0A] scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA]">
          {!isNew && (
            <button
              data-testid="zone-delete"
              onClick={remove}
              className="flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#FF2A2A] hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold hover:bg-white">
              Annuler
            </button>
            <button
              data-testid="zone-save"
              disabled={saving}
              onClick={save}
              className="flex items-center gap-2 rounded-md bg-[#002FA7] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "…" : "Enregistrer"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TableModal({ table, zones, onClose, onSaved }) {
  const [name, setName] = useState(table.name || "");
  const [zoneId, setZoneId] = useState(table.zone_id || (zones[0]?.id || ""));
  const [capacity, setCapacity] = useState(table.capacity ?? 2);
  const [saving, setSaving] = useState(false);
  const isNew = !table.id;

  const save = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    if (!zoneId) {
      toast.error("Zone requise");
      return;
    }
    const cap = Math.max(1, parseInt(capacity, 10) || 1);
    setSaving(true);
    try {
      const payload = { name: name.trim(), zone_id: zoneId, capacity: cap, x: table.x || 0, y: table.y || 0 };
      if (isNew) await api.post("/tables", payload);
      else await api.put(`/tables/${table.id}`, payload);
      toast.success(isNew ? "Table créée" : "Table mise à jour");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Supprimer la table « ${table.name} » ?`)) return;
    try {
      await api.delete(`/tables/${table.id}`);
      toast.success("Table supprimée");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="table-modal">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold">{isNew ? "Nouvelle table" : "Modifier la table"}</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-6">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom / numéro *</span>
            <input
              data-testid="table-name-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. T1, Comptoir 2, Terrasse-A"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#002FA7]"
              onKeyDown={(e) => { if (e.key === "Enter" && !saving) save(); }}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Zone</span>
            <select
              data-testid="table-zone-select"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
              Nombre de couverts
            </p>
            <div className="flex items-center gap-3">
              <button
                data-testid="table-capacity-dec"
                onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-xl font-bold hover:bg-[#FAFAFA] active:scale-90"
              >
                −
              </button>
              <input
                data-testid="table-capacity-input"
                inputMode="numeric"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 h-12 rounded-md border border-[#E5E7EB] bg-white text-center text-3xl font-bold font-mono text-[#002FA7] outline-none focus:border-[#002FA7]"
              />
              <button
                data-testid="table-capacity-inc"
                onClick={() => setCapacity((c) => (parseInt(c, 10) || 0) + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-xl font-bold hover:bg-[#FAFAFA] active:scale-90"
              >
                +
              </button>
            </div>
            <div className="mt-3 flex gap-1">
              {[1, 2, 4, 6, 8, 10, 12].map((n) => (
                <button
                  key={n}
                  data-testid={`table-capacity-preset-${n}`}
                  onClick={() => setCapacity(n)}
                  className={`flex-1 rounded-md border py-2 text-sm font-bold ${
                    capacity == n
                      ? "border-[#002FA7] bg-[#F4F6FB] text-[#002FA7]"
                      : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#FAFAFA]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA]">
          {!isNew && (
            <button
              data-testid="table-delete"
              onClick={remove}
              className="flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#FF2A2A] hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold">
              Annuler
            </button>
            <button
              data-testid="table-save"
              disabled={saving}
              onClick={save}
              className="flex items-center gap-2 rounded-md bg-[#002FA7] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "…" : "Enregistrer"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
