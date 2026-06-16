import { useEffect, useState } from "react";
import { Printer, Check } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/context/SettingsContext";

export default function PrintSection() {
  const { settings, save } = useSettings();
  const [form, setForm] = useState(settings.print);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings.print);
  }, [settings.print]);

  const submit = async () => {
    setSaving(true);
    try {
      await save({ print: form });
      toast.success("Préférences d'impression enregistrées");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
          <Printer className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Tickets
          </p>
          <h2 className="text-xl font-bold">Impression thermique</h2>
        </div>
      </div>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-bold">⚙️ Configuration de l&apos;imprimante</p>
        <p className="mt-1">
          QuickPOS utilise le dialogue d&apos;impression de votre navigateur. Pour
          envoyer automatiquement à votre imprimante thermique 80 mm :
        </p>
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          <li>Installez les pilotes de votre imprimante thermique (ex: Epson TM-T20, Star TSP143)</li>
          <li>Dans les paramètres du navigateur, désactivez l&apos;aperçu d&apos;impression (Chrome: <code>chrome://settings/printing</code> ou flag <code>kiosk-printing</code>)</li>
          <li>Sélectionnez l&apos;imprimante thermique comme imprimante par défaut</li>
          <li>Le format <strong>80 mm</strong> ci-dessous correspond au papier standard</li>
        </ol>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 rounded-md border-2 border-[#E5E7EB] bg-[#FAFAFA] px-4 py-4 cursor-pointer">
          <input
            type="checkbox"
            data-testid="auto-print-z"
            checked={form.auto_print_z}
            onChange={(e) => setForm({ ...form, auto_print_z: e.target.checked })}
            className="h-5 w-5"
          />
          <div className="flex-1">
            <p className="font-semibold">Imprimer automatiquement à la clôture Z</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Le journal complet des ventes du service est imprimé dès la confirmation de la clôture.
            </p>
          </div>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Largeur papier
            </span>
            <select
              data-testid="paper-width"
              value={form.paper_width_mm}
              onChange={(e) => setForm({ ...form, paper_width_mm: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 outline-none focus:border-[#002FA7]"
            >
              <option value={58}>58 mm</option>
              <option value={80}>80 mm (standard)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Nom du commerce
            </span>
            <input
              data-testid="shop-name"
              value={form.shop_name || ""}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              placeholder="Le Bistrot du Coin"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Pied de ticket
          </span>
          <input
            data-testid="footer-line"
            value={form.footer_line || ""}
            onChange={(e) => setForm({ ...form, footer_line: e.target.value })}
            placeholder="Merci de votre visite"
            className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
          />
        </label>
      </div>

      <button
        data-testid="save-print"
        onClick={submit}
        disabled={saving}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] disabled:opacity-50"
      >
        <Check className="h-5 w-5" />
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>

      <button
        data-testid="test-print-btn"
        onClick={() => {
          // simply trigger print of an empty journal as preview test
          window.print();
        }}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#E5E7EB] bg-white text-sm font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[#FAFAFA] active:scale-95"
      >
        <Printer className="h-4 w-4" />
        Tester l&apos;impression
      </button>
    </section>
  );
}
