import { useEffect, useRef, useState } from "react";
import {
  Store,
  Image as ImageIcon,
  Upload,
  Save,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Hash,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/context/SettingsContext";

// Downsize an uploaded image to a thermal-printer-friendly width.
// Returns a black/white data URL.
async function processLogo(file, maxWidth = 384) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const w = Math.min(maxWidth, img.naturalWidth);
  const ratio = w / img.naturalWidth;
  const h = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  // Convert to black/white using a simple threshold (Floyd-Steinberg would be
  // nicer, but keeps logos crisp enough on most prints).
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < 160 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function ShopSection() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState({
    shop_name: "",
    shop_address: "",
    shop_phone: "",
    shop_email: "",
    shop_tax_number: "",
    shop_website: "",
    footer_line: "",
    logo_data_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm((f) => ({ ...f, ...(settings.print || {}) }));
  }, [settings.print]);

  const onFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir une image");
      return;
    }
    setBusy(true);
    try {
      const url = await processLogo(file, 384);
      if (url.length > 150_000) {
        toast.error("Logo trop lourd (>150 Ko) — choisissez une image plus simple");
        return;
      }
      setForm((f) => ({ ...f, logo_data_url: url }));
      toast.success("Logo prêt à imprimer (noir & blanc, 80mm)");
    } catch {
      toast.error("Impossible de traiter l'image");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await save({ print: { ...settings.print, ...form } });
      toast.success("Paramètres du point de vente enregistrés");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-6" data-testid="shop-section">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Identité du point de vente</h2>
            <p className="text-xs text-slate-500">
              Ces informations apparaissent en en-tête de chaque ticket imprimé.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field
            icon={Store}
            label="Nom du commerce *"
            testid="shop-name"
            value={form.shop_name}
            onChange={(v) => setForm({ ...form, shop_name: v })}
            placeholder="ex. Boutique Diarra"
          />
          <Field
            icon={Hash}
            label="N° fiscal / NIF / TVA"
            testid="shop-tax-number"
            value={form.shop_tax_number}
            onChange={(v) => setForm({ ...form, shop_tax_number: v })}
            placeholder="ex. NIF 12345678"
          />
          <Field
            icon={MapPin}
            label="Adresse"
            testid="shop-address"
            value={form.shop_address}
            onChange={(v) => setForm({ ...form, shop_address: v })}
            placeholder="Rue, ville, pays"
            multiline
          />
          <div className="grid grid-cols-1 gap-4">
            <Field
              icon={Phone}
              label="Téléphone"
              testid="shop-phone"
              value={form.shop_phone}
              onChange={(v) => setForm({ ...form, shop_phone: v })}
              placeholder="ex. +221 77 000 0000"
            />
            <Field
              icon={Mail}
              label="Email"
              testid="shop-email"
              value={form.shop_email}
              onChange={(v) => setForm({ ...form, shop_email: v })}
              placeholder="contact@…"
              type="email"
            />
            <Field
              icon={Globe}
              label="Site web (optionnel)"
              testid="shop-website"
              value={form.shop_website}
              onChange={(v) => setForm({ ...form, shop_website: v })}
              placeholder="www.example.com"
            />
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Message de pied de ticket
          </span>
          <input
            data-testid="shop-footer"
            value={form.footer_line || ""}
            onChange={(e) => setForm({ ...form, footer_line: e.target.value })}
            placeholder="ex. Merci de votre visite — TVA incluse"
            maxLength={120}
            className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
          />
        </label>
      </div>

      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0EA5E9] text-white">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Logo sur ticket</h2>
            <p className="text-xs text-slate-500">
              Le logo est automatiquement converti en noir & blanc et
              redimensionné pour l&apos;imprimante 80mm.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 items-start">
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              data-testid="logo-file-input"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <button
              data-testid="upload-logo-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {busy ? "Traitement…" : form.logo_data_url ? "Changer le logo" : "Importer un logo"}
            </button>
            {form.logo_data_url && (
              <button
                data-testid="remove-logo-btn"
                onClick={() => setForm({ ...form, logo_data_url: "" })}
                className="flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#FF2A2A] hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Retirer le logo
              </button>
            )}
            <p className="text-xs text-slate-500">
              Recommandé : PNG ou JPG, fond clair, largeur 200-400 px. La
              conversion s&apos;adapte automatiquement.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-4">
            <p className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-500">
              Aperçu ticket
            </p>
            {form.logo_data_url ? (
              <img
                data-testid="logo-preview"
                src={form.logo_data_url}
                alt="Logo"
                className="max-w-full max-h-32 object-contain bg-white"
              />
            ) : (
              <div className="flex h-24 w-full items-center justify-center text-xs text-slate-400">
                Aucun logo
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          data-testid="shop-save"
          disabled={saving}
          onClick={submit}
          className="flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </section>
  );
}

function Field({ icon: Icon, label, value, onChange, testid, type = "text", placeholder, multiline = false }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      {multiline ? (
        <textarea
          data-testid={testid}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
        />
      ) : (
        <input
          data-testid={testid}
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#002FA7]"
        />
      )}
    </label>
  );
}
