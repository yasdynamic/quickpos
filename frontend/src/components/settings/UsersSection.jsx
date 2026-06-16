import { useEffect, useState } from "react";
import { Pencil, Plus, Shield, Trash2, UserCircle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const ROLES = [
  { value: "admin", label: "Administrateur" },
  { value: "manager", label: "Gérant" },
  { value: "server", label: "Serveur" },
];

const COLORS = ["#0A0A0A", "#002FA7", "#0EA5E9", "#10B981", "#F97316", "#EC4899", "#A855F7", "#F59E0B"];

const empty = { name: "", pin: "", role: "server", color: "#002FA7" };

export default function UsersSection() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const res = await api.get("/users");
    setUsers(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, pin: "", role: u.role, color: u.color || "#002FA7" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Nom requis");
      return;
    }
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role, color: form.color };
        if (form.pin) payload.pin = form.pin;
        await api.put(`/users/${editing.id}`, payload);
        toast.success("Utilisateur modifié");
      } else {
        if (!form.pin || form.pin.length < 4) {
          toast.error("PIN requis (4-6 chiffres)");
          return;
        }
        await api.post("/users", form);
        toast.success("Utilisateur créé");
      }
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Supprimer ${u.name} ?`)) return;
    await api.delete(`/users/${u.id}`);
    toast.success("Supprimé");
    load();
  };

  return (
    <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Équipe
            </p>
            <h2 className="text-xl font-bold">Utilisateurs ({users.length})</h2>
          </div>
        </div>
        <button
          data-testid="add-user-btn"
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </button>
      </div>

      <ul className="space-y-2" data-testid="users-list">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-3 rounded-md border border-[#E5E7EB] px-4 py-3"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-md text-white font-bold"
              style={{ backgroundColor: u.color || "#002FA7" }}
            >
              {u.name?.[0]?.toUpperCase() || "?"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{u.name}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                {u.role === "admin" && <Shield className="h-3 w-3" />}
                {ROLES.find((r) => r.value === u.role)?.label || u.role}
              </p>
            </div>
            <button
              data-testid={`edit-user-${u.id}`}
              onClick={() => openEdit(u)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              data-testid={`delete-user-${u.id}`}
              onClick={() => remove(u)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] text-[#FF2A2A] hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="user-form-modal">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <header className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold">
                {editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </h3>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  Nom
                </span>
                <input
                  data-testid="user-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  Code PIN {editing && <span className="text-slate-400 normal-case tracking-normal">(laisser vide pour ne pas changer)</span>}
                </span>
                <input
                  data-testid="user-pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono text-lg tracking-widest outline-none focus:border-[#002FA7]"
                  placeholder="••••"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  Rôle
                </span>
                <select
                  data-testid="user-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 outline-none focus:border-[#002FA7]"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
                  Couleur
                </p>
                <div className="flex flex-wrap gap-2" data-testid="color-picker">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-10 w-10 rounded-md border-2 transition-transform active:scale-90 ${
                        form.color === c ? "border-[#0A0A0A] scale-110" : "border-white"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA]"
              >
                Annuler
              </button>
              <button
                data-testid="user-save"
                onClick={save}
                className="rounded-md bg-[#002FA7] px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277]"
              >
                {editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
