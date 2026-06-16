import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

const empty = { name: "", price: "", category_id: "", stock: 0, track_stock: true };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [showCat, setShowCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", color: "#002FA7" });

  const load = async () => {
    const [c, p] = await Promise.all([
      api.get("/categories"),
      api.get("/products"),
    ]);
    setCategories(c.data);
    setProducts(p.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, category_id: categories[0]?.id || "" });
    setShowProductModal(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: p.price,
      category_id: p.category_id,
      stock: p.stock,
      track_stock: p.track_stock,
    });
    setShowProductModal(true);
  };

  const save = async () => {
    if (!form.name || !form.category_id) {
      toast.error("Nom et catégorie requis");
      return;
    }
    const payload = {
      ...form,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
    };
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success("Produit modifié");
      } else {
        await api.post("/products", payload);
        toast.success("Produit créé");
      }
      setEditing(null);
      setForm(empty);
      setShowProductModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Supprimer "${p.name}" ?`)) return;
    await api.delete(`/products/${p.id}`);
    toast.success("Supprimé");
    load();
  };

  const createCategory = async () => {
    if (!catForm.name) return;
    try {
      await api.post("/categories", catForm);
      toast.success("Catégorie créée");
      setCatForm({ name: "", color: "#002FA7" });
      setShowCat(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Catégorie supprimée");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Catalogue
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Produits</h1>
        </div>
        <div className="flex gap-3">
          <button
            data-testid="open-new-category"
            onClick={() => setShowCat(true)}
            className="rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95"
          >
            + Catégorie
          </button>
          <button
            data-testid="open-new-product"
            onClick={openNew}
            className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Nouveau produit
          </button>
        </div>
      </header>

      {/* Categories chips */}
      <section className="mb-6 rounded-md border border-[#E5E7EB] bg-white p-4">
        <p className="mb-3 text-sm uppercase tracking-wider font-semibold text-slate-500">
          Catégories ({categories.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="group flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.name}
              <button
                data-testid={`del-cat-${c.id}`}
                onClick={() => deleteCategory(c.id)}
                className="opacity-30 hover:opacity-100 hover:text-[#FF2A2A]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#E5E7EB] bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
            <tr>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500">Nom</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500">Catégorie</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500 text-right">Prix</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500 text-right">Stock</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody data-testid="products-table">
            {products.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              return (
                <tr key={p.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="p-4 font-semibold">{p.name}</td>
                  <td className="p-4">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: (cat?.color || "#002FA7") + "20", color: cat?.color || "#002FA7" }}
                    >
                      {cat?.name || "—"}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-semibold">{formatCurrency(p.price)}</td>
                  <td className="p-4 text-right font-mono">
                    {p.track_stock ? p.stock : "∞"}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        data-testid={`edit-product-${p.id}`}
                        onClick={() => openEdit(p)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        data-testid={`delete-product-${p.id}`}
                        onClick={() => remove(p)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] text-[#FF2A2A] hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Aucun produit. Créez-en un !
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Edit/create product modal */}
      {showProductModal && (
        <ProductModal
          editing={editing}
          form={form}
          setForm={setForm}
          categories={categories}
          onClose={() => {
            setEditing(null);
            setForm(empty);
            setShowProductModal(false);
          }}
          onSave={save}
        />
      )}

      {showCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="category-modal">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold">Nouvelle catégorie</h3>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom</span>
              <input
                data-testid="cat-name"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#002FA7]"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Couleur</span>
              <input
                type="color"
                value={catForm.color}
                onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                className="mt-1 h-12 w-full rounded-md border border-[#E5E7EB]"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCat(false)}
                className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA]"
              >
                Annuler
              </button>
              <button
                data-testid="cat-save"
                onClick={createCategory}
                className="rounded-md bg-[#002FA7] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277]"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductModal({ editing, form, setForm, categories, onClose, onSave }) {
  const { settings } = useSettings();
  const sym = settings?.currency?.symbol || "";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="product-modal">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <header className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {editing ? "Modifier le produit" : "Nouveau produit"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Nom</span>
            <input
              data-testid="product-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 outline-none focus:border-[#002FA7]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Prix {sym && `(${sym})`}</span>
              <input
                data-testid="product-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 font-mono outline-none focus:border-[#002FA7]"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">TVA (%)</span>
              <select
                data-testid="product-tva"
                value={form.tva_rate ?? 20}
                onChange={(e) => setForm({ ...form, tva_rate: parseFloat(e.target.value) })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-mono outline-none focus:border-[#002FA7]"
              >
                <option value={20}>20% (standard)</option>
                <option value={10}>10% (restauration)</option>
                <option value={5.5}>5,5% (alimentaire)</option>
                <option value={2.1}>2,1% (presse)</option>
                <option value={0}>0% (exonéré)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Stock</span>
              <input
                data-testid="product-stock"
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 font-mono outline-none focus:border-[#002FA7]"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Catégorie</span>
            <select
              data-testid="product-category"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 outline-none focus:border-[#002FA7]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="product-track-stock"
              checked={form.track_stock}
              onChange={(e) => setForm({ ...form, track_stock: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Suivre le stock</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA]"
          >
            Annuler
          </button>
          <button
            data-testid="product-save"
            onClick={onSave}
            className="rounded-md bg-[#002FA7] px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277]"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
