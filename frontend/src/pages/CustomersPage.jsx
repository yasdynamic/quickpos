import { useEffect, useState } from "react";
import { Plus, Search, Trash2, Pencil, X, Star, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency, formatDateTime } from "@/lib/api";

const empty = { name: "", phone: "", email: "" };

export default function CustomersPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const res = await api.get("/customers", { params: search ? { search } : {} });
    setList(res.data);
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [search]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Nom requis");
      return;
    }
    try {
      if (editing) await api.put(`/customers/${editing.id}`, form);
      else await api.post("/customers", form);
      toast.success("Client enregistré");
      setShowForm(false);
      setEditing(null);
      setForm(empty);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Supprimer ${c.name} ?`)) return;
    await api.delete(`/customers/${c.id}`);
    toast.success("Supprimé");
    load();
  };

  return (
    <div className="p-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Fidélisation
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Clients ({list.length})</h1>
        </div>
        <button
          data-testid="add-customer"
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nouveau client
        </button>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          data-testid="customer-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, email…"
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      <section className="rounded-md border border-[#E5E7EB] bg-white">
        {list.length === 0 ? (
          <p className="p-8 text-center text-slate-400">Aucun client</p>
        ) : (
          <ul data-testid="customers-list">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-4 border-b border-[#E5E7EB] px-5 py-4 last:border-0"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#002FA7] text-white text-lg font-bold">
                  {c.name?.[0]?.toUpperCase() || "?"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-slate-500">
                    {c.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="flex items-center gap-1 text-sm font-bold text-[#F97316]">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {c.loyalty_points || 0} pts
                  </span>
                  <span className="text-xs text-slate-500">
                    {c.visits || 0} visite(s) · {formatCurrency(c.total_spent || 0)}
                  </span>
                  {c.last_visit_at && (
                    <span className="text-[10px] text-slate-400">
                      Dernière : {formatDateTime(c.last_visit_at)}
                    </span>
                  )}
                </div>
                <button
                  data-testid={`edit-customer-${c.id}`}
                  onClick={() => openEdit(c)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  data-testid={`delete-customer-${c.id}`}
                  onClick={() => remove(c)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] text-[#FF2A2A] hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="customer-form-modal">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <header className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold">{editing ? "Modifier" : "Nouveau client"}</h3>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom</span>
                <input data-testid="customer-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Téléphone</span>
                <input data-testid="customer-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]" />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Email</span>
                <input data-testid="customer-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]" />
              </label>
            </div>
            <button data-testid="customer-save" onClick={save} className="mt-5 h-12 w-full rounded-md bg-[#002FA7] text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277]">
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
