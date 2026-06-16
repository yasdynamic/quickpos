import { useEffect, useMemo, useState } from "react";
import { ChefHat, Plus, Trash2, Pencil, X, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency } from "@/lib/api";

const EMPTY = { name: "", price: 0, tva_rate: 18, category_id: "", items: [], active: true };

export default function MenusPage() {
  const [menus, setMenus] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const [m, p, c] = await Promise.all([
      api.get("/menus"),
      api.get("/products"),
      api.get("/categories"),
    ]);
    setMenus(m.data || []);
    setProducts(p.data || []);
    setCategories(c.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (menu) => {
    if (!window.confirm(`Supprimer ${menu.name} ?`)) return;
    await api.delete(`/menus/${menu.id}`);
    toast.success("Menu supprimé");
    load();
  };

  const toggleActive = async (menu) => {
    await api.put(`/menus/${menu.id}`, { ...menu, active: !menu.active });
    load();
  };

  return (
    <div className="p-8" data-testid="menus-page">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">Catalogue</p>
          <h1 className="text-4xl font-bold tracking-tight">Menus / Formules</h1>
          <p className="mt-1 text-sm text-slate-500">
            Composez des combos à prix fixe (ex. Burger + Frites + Boisson).
            Le stock des composants est automatiquement décrémenté à la vente.
          </p>
        </div>
        <button
          data-testid="new-menu-btn"
          onClick={() => setEditing(EMPTY)}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nouveau menu
        </button>
      </header>

      {menus.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-12 text-center">
          <ChefHat className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-lg font-semibold">Aucun menu configuré</p>
          <p className="mt-1 text-sm text-slate-500">
            Créez un menu pour proposer un combo à prix avantageux.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {menus.map((m) => (
            <div
              key={m.id}
              data-testid={`menu-card-${m.id}`}
              className={`rounded-lg border-2 bg-white p-5 ${m.active ? "border-[#002FA7]" : "border-[#E5E7EB] opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold tracking-tight truncate">{m.name}</h3>
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mt-0.5">
                    {(m.items || []).length} produit{(m.items || []).length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-bold font-mono text-[#002FA7]">
                    {formatCurrency(m.price)}
                  </span>
                  {m.savings > 0 && (
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      Économie {formatCurrency(m.savings)}
                    </span>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {(m.components || []).map((c, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate">
                      {c.quantity}× {c.name}
                    </span>
                    <span className="font-mono text-slate-400 line-through">{formatCurrency(c.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-2">
                <button
                  data-testid={`menu-edit-${m.id}`}
                  onClick={() => setEditing(m)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-[#E5E7EB] px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#FAFAFA]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </button>
                <button
                  onClick={() => toggleActive(m)}
                  className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                    m.active
                      ? "border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#FAFAFA]"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {m.active ? "Actif" : "Inactif"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="rounded-md border border-red-300 bg-white p-2 text-[#FF2A2A] hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MenuModal
          menu={editing}
          products={products}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function MenuModal({ menu, products, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: menu.name || "",
    price: menu.price || 0,
    category_id: menu.category_id || "",
    tva_rate: menu.tva_rate || 18,
    items: menu.items ? menu.items.map((i) => ({ ...i })) : [],
    active: menu.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const isNew = !menu.id;

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const catalogTotal = useMemo(
    () => form.items.reduce((s, it) => s + (productById[it.product_id]?.price || 0) * (it.quantity || 1), 0),
    [form.items, productById],
  );
  const savings = catalogTotal - (parseFloat(form.price) || 0);

  const addItem = (pid) => {
    if (!pid) return;
    const exists = form.items.find((i) => i.product_id === pid);
    if (exists) {
      setForm({ ...form, items: form.items.map((i) => i.product_id === pid ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      setForm({ ...form, items: [...form.items, { product_id: pid, quantity: 1 }] });
    }
  };
  const removeItem = (pid) => setForm({ ...form, items: form.items.filter((i) => i.product_id !== pid) });
  const setQty = (pid, q) => setForm({ ...form, items: form.items.map((i) => i.product_id === pid ? { ...i, quantity: Math.max(1, q) } : i) });

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    if (form.items.length === 0) { toast.error("Ajoutez au moins un produit"); return; }
    if (!form.price || form.price <= 0) { toast.error("Prix invalide"); return; }
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price), tva_rate: parseFloat(form.tva_rate) || 18 };
      if (isNew) await api.post("/menus", payload);
      else await api.put(`/menus/${menu.id}`, payload);
      toast.success(isNew ? "Menu créé" : "Menu mis à jour");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="menu-modal">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <ChefHat className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold">{isNew ? "Nouveau menu" : "Modifier le menu"}</h2>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block md:col-span-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom du menu *</span>
              <input
                data-testid="menu-name"
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex. Menu Burger Découverte"
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 outline-none focus:border-[#002FA7]"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Prix de vente *</span>
              <input
                data-testid="menu-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono outline-none focus:border-[#002FA7]"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">TVA (%)</span>
              <input
                data-testid="menu-tva"
                inputMode="decimal"
                value={form.tva_rate}
                onChange={(e) => setForm({ ...form, tva_rate: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono outline-none focus:border-[#002FA7]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Catégorie</span>
              <select
                data-testid="menu-category"
                value={form.category_id || ""}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
              >
                <option value="">— Aucune —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="border-t border-[#E5E7EB] pt-4">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">Composition</p>
            <select
              data-testid="menu-add-product"
              defaultValue=""
              onChange={(e) => { addItem(e.target.value); e.target.value = ""; }}
              className="w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
            >
              <option value="" disabled>+ Ajouter un produit…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
              ))}
            </select>
            {form.items.length > 0 && (
              <ul className="mt-3 rounded-md border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
                {form.items.map((it) => {
                  const p = productById[it.product_id];
                  if (!p) return null;
                  return (
                    <li key={it.product_id} data-testid={`menu-item-${it.product_id}`} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(p.price)} l'unité</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(it.product_id, it.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB]">−</button>
                        <span className="w-8 text-center font-mono font-bold">{it.quantity}</span>
                        <button onClick={() => setQty(it.product_id, it.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB]">+</button>
                      </div>
                      <button onClick={() => removeItem(it.product_id)} className="rounded-md border border-red-300 p-1.5 text-[#FF2A2A] hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-md bg-[#FAFAFA] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Prix catalogue cumulé</p>
              <p className="text-lg font-mono font-bold line-through text-slate-400">{formatCurrency(catalogTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1 justify-end">
                <Tag className="h-3 w-3" /> Économie client
              </p>
              <p className={`text-2xl font-bold font-mono ${savings >= 0 ? "text-emerald-600" : "text-[#FF2A2A]"}`}>
                {savings >= 0 ? "−" : "+"}{formatCurrency(Math.abs(savings))}
              </p>
            </div>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA]">
          <button onClick={onClose} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold">
            Annuler
          </button>
          <button
            data-testid="menu-save"
            disabled={saving}
            onClick={submit}
            className="flex items-center gap-2 rounded-md bg-[#002FA7] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "…" : "Enregistrer"}
          </button>
        </footer>
      </div>
    </div>
  );
}
