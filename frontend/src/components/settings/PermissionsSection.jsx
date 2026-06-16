import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Save, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

const ROLE_META = {
  admin: { label: "Admin", color: "#002FA7" },
  manager: { label: "Manager", color: "#0EA5E9" },
  server: { label: "Serveur", color: "#10B981" },
};

export default function PermissionsSection() {
  const { settings, save } = useSettings();
  const [catalog, setCatalog] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [matrix, setMatrix] = useState({}); // {role: Set(keys)}
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get("/permissions/catalog").then((r) => {
      setCatalog(r.data.catalog || []);
      setDefaults(r.data.defaults || {});
    });
    api.get("/users").then((r) => setUsers(r.data || []));
  }, []);

  useEffect(() => {
    const rp = settings?.role_permissions || {};
    const m = {};
    for (const role of Object.keys(ROLE_META)) {
      m[role] = new Set(rp[role] || []);
    }
    setMatrix(m);
  }, [settings]);

  const allKeys = useMemo(
    () => catalog.flatMap((s) => s.items.map((it) => it.key)),
    [catalog],
  );

  const toggle = (role, key) => {
    setMatrix((m) => {
      const next = { ...m, [role]: new Set(m[role]) };
      if (next[role].has(key)) next[role].delete(key);
      else next[role].add(key);
      return next;
    });
  };

  const setAllInSection = (role, section, value) => {
    setMatrix((m) => {
      const next = { ...m, [role]: new Set(m[role]) };
      for (const it of section.items) {
        if (value) next[role].add(it.key);
        else next[role].delete(it.key);
      }
      return next;
    });
  };

  const resetDefaults = () => {
    if (!window.confirm("Restaurer les permissions par défaut pour tous les profils ?")) return;
    const m = {};
    for (const role of Object.keys(ROLE_META)) {
      m[role] = new Set(defaults[role] || []);
    }
    setMatrix(m);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const role of Object.keys(matrix)) {
        payload[role] = Array.from(matrix[role]).sort();
      }
      await save({ role_permissions: payload });
      toast.success("Permissions mises à jour");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const usersByRole = useMemo(() => {
    const m = { admin: 0, manager: 0, server: 0 };
    for (const u of users) m[u.role] = (m[u.role] || 0) + 1;
    return m;
  }, [users]);

  if (catalog.length === 0) return <p className="p-6 text-slate-400">Chargement…</p>;

  return (
    <section className="space-y-6" data-testid="permissions-section">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Profils & Permissions</h2>
              <p className="text-xs text-slate-500">
                Définissez ce que chaque profil peut faire. Les utilisateurs
                héritent automatiquement des permissions de leur profil.
              </p>
            </div>
          </div>
          <button
            data-testid="reset-permissions"
            onClick={resetDefaults}
            className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#FAFAFA]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurer par défaut
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#FAFAFA] sticky top-0 z-10">
            <tr className="border-b border-[#E5E7EB]">
              <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-bold text-slate-500 w-[55%]">
                Permission
              </th>
              {Object.entries(ROLE_META).map(([role, meta]) => (
                <th key={role} className="px-3 py-3 text-center w-[15%]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className="rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {matrix[role]?.size || 0} / {allKeys.length} ·{" "}
                      {usersByRole[role] || 0} util.
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.map((sec) => (
              <SectionRows
                key={sec.section}
                section={sec}
                matrix={matrix}
                toggle={toggle}
                setAllInSection={setAllInSection}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          data-testid="save-permissions"
          disabled={saving}
          onClick={submit}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Enregistrer les permissions"}
        </button>
      </div>
    </section>
  );
}

function SectionRows({ section, matrix, toggle, setAllInSection }) {
  return (
    <>
      <tr className="bg-[#F4F6FB] border-b border-[#E5E7EB]">
        <td className="px-4 py-2 text-xs uppercase tracking-[0.1em] font-bold text-[#002FA7]">
          {section.section}
        </td>
        {Object.keys(ROLE_META).map((role) => {
          const total = section.items.length;
          const have = section.items.filter((it) => matrix[role]?.has(it.key)).length;
          const all = have === total;
          const none = have === 0;
          return (
            <td key={role} className="px-3 py-2 text-center">
              <button
                data-testid={`section-toggle-${section.section}-${role}`}
                onClick={() => setAllInSection(role, section, !all)}
                className={`text-[10px] uppercase tracking-wider font-bold rounded px-2 py-0.5 ${
                  all
                    ? "bg-emerald-100 text-emerald-700"
                    : none
                    ? "bg-slate-100 text-slate-500"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {all ? "Tout" : none ? "Aucun" : `${have}/${total}`}
              </button>
            </td>
          );
        })}
      </tr>
      {section.items.map((it) => (
        <tr key={it.key} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#FAFAFA]">
          <td className="px-4 py-2.5">
            <span className="text-sm">{it.label}</span>
            <code className="ml-2 text-[10px] text-slate-400 font-mono">{it.key}</code>
          </td>
          {Object.keys(ROLE_META).map((role) => {
            const on = matrix[role]?.has(it.key);
            return (
              <td key={role} className="px-3 py-2.5 text-center">
                <button
                  data-testid={`perm-${role}-${it.key}`}
                  onClick={() => toggle(role, it.key)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border-2 transition-colors ${
                    on
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-[#E5E7EB] bg-white text-slate-300 hover:border-[#002FA7]"
                  }`}
                  aria-label={`Toggle ${it.key} for ${role}`}
                >
                  {on ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-3.5 w-3.5" />}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
