import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, formatCurrency } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const empty = {
  name: "",
  price: "",
  category_id: "",
  stock: 0,
  track_stock: true,
  barcode: "",
  sku: "",
  supplier_id: "",
  cost_price: "",
  low_stock_threshold: 0,
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [showCat, setShowCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", color: "#002FA7" });
  const [importPreview, setImportPreview] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const [c, p, s] = await Promise.all([
      api.get("/categories"),
      api.get("/products"),
      api.get("/suppliers"),
    ]);
    setCategories(c.data);
    setProducts(p.data);
    setSuppliers(s.data);
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
      barcode: p.barcode || "",
      sku: p.sku || "",
      supplier_id: p.supplier_id || "",
      cost_price: p.cost_price ?? "",
      low_stock_threshold: p.low_stock_threshold ?? 0,
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
      low_stock_threshold: parseInt(form.low_stock_threshold) || 0,
      cost_price: form.cost_price === "" ? null : parseFloat(form.cost_price) || 0,
      barcode: form.barcode?.trim() || null,
      sku: form.sku?.trim() || null,
      supplier_id: form.supplier_id || null,
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

  const downloadXlsx = async () => {
    try {
      const res = await fetch(`${API_URL}/api/exports/products.xlsx`);
      if (!res.ok) throw new Error("Erreur export");
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename=([^;]+)/i);
      const fname = (m && m[1].trim()) || "produits.xlsx";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exporté : ${fname}`);
    } catch (err) {
      toast.error(err?.message || "Erreur export");
    }
  };

  const uploadXlsx = async (file, commit = false) => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = `/imports/products?dry_run=${commit ? "false" : "true"}`;
      const res = await api.post(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (commit) {
        toast.success(
          `Import OK : ${res.data.summary.created} créés, ${res.data.summary.updated} mis à jour`,
        );
        setImportPreview(null);
        setImportFile(null);
        load();
      } else {
        setImportPreview(res.data);
        setImportFile(file);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur import");
    } finally {
      setImporting(false);
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
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            data-testid="import-file-input"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadXlsx(f, false);
              e.target.value = "";
            }}
          />
          <button
            data-testid="export-xlsx"
            onClick={downloadXlsx}
            className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            data-testid="import-xlsx"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Importer
          </button>
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
          suppliers={suppliers}
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

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="import-preview-modal">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Import Excel — Aperçu</p>
                <h2 className="text-xl font-bold">{importFile?.name}</h2>
              </div>
              <button
                onClick={() => { setImportPreview(null); setImportFile(null); }}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">À créer</p>
                  <p className="text-2xl font-bold font-mono text-emerald-700">{importPreview.summary.created}</p>
                </div>
                <div className="rounded-md border border-[#0EA5E9] bg-sky-50 p-3">
                  <p className="text-xs uppercase tracking-wider font-semibold text-[#0EA5E9]">À mettre à jour</p>
                  <p className="text-2xl font-bold font-mono text-[#0EA5E9]">{importPreview.summary.updated}</p>
                </div>
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wider font-semibold text-amber-700">Erreurs / ignorés</p>
                  <p className="text-2xl font-bold font-mono text-amber-700">
                    {importPreview.summary.skipped + importPreview.summary.errors}
                  </p>
                </div>
              </div>
              {(importPreview.errors || []).length > 0 && (
                <details className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <summary className="cursor-pointer text-sm font-bold text-amber-900">
                    {importPreview.errors.length} erreur(s)
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-amber-800">
                    {importPreview.errors.map((e, i) => (
                      <li key={i}>Ligne {e.row} : {e.msg}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="max-h-64 overflow-y-auto rounded-md border border-[#E5E7EB]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5">#</th>
                      <th className="px-3 py-1.5">Action</th>
                      <th className="px-3 py-1.5">Nom</th>
                      <th className="px-3 py-1.5 text-right">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(importPreview.preview || []).map((p, i) => (
                      <tr key={i} className="border-t border-[#E5E7EB]">
                        <td className="px-3 py-1.5 font-mono">{p.row}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                            p.action === "create" ? "bg-emerald-600" : "bg-[#0EA5E9]"
                          }`}>
                            {p.action === "create" ? "Créer" : "MAJ"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{p.name}</td>
                        <td className="px-3 py-1.5 font-mono text-right">{formatCurrency(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <footer className="flex justify-end gap-2 border-t border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA]">
              <button
                onClick={() => { setImportPreview(null); setImportFile(null); }}
                className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA]"
              >
                Annuler
              </button>
              <button
                data-testid="import-confirm"
                disabled={importing}
                onClick={() => importFile && uploadXlsx(importFile, true)}
                className="rounded-md bg-[#002FA7] px-5 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] disabled:opacity-50"
              >
                {importing ? "Import…" : "Confirmer l'import"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductModal({ editing, form, setForm, categories, suppliers, onClose, onSave }) {
  const { settings } = useSettings();
  const sym = settings?.currency?.symbol || "";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="product-modal">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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

          <div className="border-t border-[#E5E7EB] pt-4">
            <p className="mb-3 text-xs uppercase tracking-[0.1em] font-bold text-slate-500">
              Code-barres & approvisionnement
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Code-barres (EAN)</span>
                <input
                  data-testid="product-barcode"
                  value={form.barcode || ""}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="3017620422003"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono text-sm outline-none focus:border-[#002FA7]"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Référence (SKU)</span>
                <input
                  data-testid="product-sku"
                  value={form.sku || ""}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="REF-001"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono text-sm outline-none focus:border-[#002FA7]"
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Coût d'achat</span>
                <input
                  data-testid="product-cost"
                  inputMode="decimal"
                  value={form.cost_price ?? ""}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono text-sm outline-none focus:border-[#002FA7]"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Seuil stock bas</span>
                <input
                  data-testid="product-low-threshold"
                  inputMode="numeric"
                  value={form.low_stock_threshold ?? 0}
                  onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                  placeholder="0"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 font-mono text-sm outline-none focus:border-[#002FA7]"
                />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Fournisseur</span>
              <select
                data-testid="product-supplier"
                value={form.supplier_id || ""}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
              >
                <option value="">— Aucun —</option>
                {(suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
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
