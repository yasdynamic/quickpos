import { useEffect, useState } from "react";
import { Truck, Plus, Trash2, Pencil, X, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const EMPTY = { name: "", contact_name: "", phone: "", email: "", address: "", notes: "" };

export default function SuppliersPage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await api.get("/suppliers");
    setItems(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing("new");
    setForm(EMPTY);
  };

  const openEdit = (s) => {
    setEditing(s.id);
    setForm({
      name: s.name || "",
      contact_name: s.contact_name || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      notes: s.notes || "",
    });
  };

  const close = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await api.post("/suppliers", form);
        toast.success("Fournisseur créé");
      } else {
        await api.put(`/suppliers/${editing}`, form);
        toast.success("Fournisseur mis à jour");
      }
      close();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Supprimer ${s.name} ?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success("Fournisseur supprimé");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-8" data-testid="suppliers-page">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Achats
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Fournisseurs</h1>
        </div>
        <button
          data-testid="new-supplier-btn"
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nouveau
        </button>
      </header>

      {items.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-12 text-center">
          <Truck className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-lg font-semibold">Aucun fournisseur</p>
          <p className="mt-1 text-sm text-slate-500">
            Ajoutez vos fournisseurs pour rattacher des produits et tracer vos
            entrées de stock.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFAFA]">
              <tr className="border-b border-[#E5E7EB]">
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Nom</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Contact</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Téléphone</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  data-testid={`supplier-row-${s.id}`}
                  className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#FAFAFA]"
                >
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3">{s.contact_name || "—"}</td>
                  <td className="px-4 py-3 font-mono">{s.phone || "—"}</td>
                  <td className="px-4 py-3">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        data-testid={`supplier-edit-${s.id}`}
                        onClick={() => openEdit(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-white"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        data-testid={`supplier-delete-${s.id}`}
                        onClick={() => remove(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#FF2A2A] hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="supplier-modal">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <h2 className="text-xl font-bold">
                {editing === "new" ? "Nouveau fournisseur" : "Modifier le fournisseur"}
              </h2>
              <button
                onClick={close}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-3 p-6">
              <Field label="Nom *" testid="supplier-name" value={form.name}
                onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Contact" testid="supplier-contact" value={form.contact_name}
                onChange={(v) => setForm({ ...form, contact_name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone" testid="supplier-phone" value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="Email" testid="supplier-email" type="email" value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })} />
              </div>
              <Field label="Adresse" testid="supplier-address" value={form.address}
                onChange={(v) => setForm({ ...form, address: v })} />
              <Field label="Notes" testid="supplier-notes" value={form.notes} multiline
                onChange={(v) => setForm({ ...form, notes: v })} />
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#E5E7EB] px-6 py-4">
              <button
                onClick={close}
                className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA]"
              >
                Annuler
              </button>
              <button
                data-testid="supplier-save"
                disabled={saving}
                onClick={save}
                className="flex items-center gap-2 rounded-md bg-[#002FA7] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, testid, type = "text", multiline = false }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          data-testid={testid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
        />
      ) : (
        <input
          data-testid={testid}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
        />
      )}
    </label>
  );
}
