import { useEffect, useState } from "react";
import {
  Printer,
  Check,
  Usb,
  PowerOff,
  Coins,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/context/SettingsContext";
import { usePrinter } from "@/context/PrinterContext";

export default function PrintSection() {
  const { settings, save } = useSettings();
  const { supported, connected, label, connect, disconnect, testPrint, openDrawer } = usePrinter();
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
    <div className="space-y-6">
      {/* USB Printer connection */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <Usb className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Matériel POS
            </p>
            <h2 className="text-xl font-bold">Imprimante thermique USB</h2>
          </div>
          {connected ? (
            <span
              className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700"
              data-testid="printer-status-connected"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connectée
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600"
              data-testid="printer-status-disconnected"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Non connectée
            </span>
          )}
        </div>

        {!supported && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">⚠️ WebUSB non disponible</p>
            <p className="mt-1">
              L&apos;impression directe nécessite Chrome ou Edge en HTTPS. Sur Firefox ou Safari, utilisez la solution de secours via le dialogue d&apos;impression natif (bouton &laquo;&nbsp;Tester l&apos;impression&nbsp;&raquo; plus bas).
            </p>
          </div>
        )}

        {connected ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-bold text-emerald-900">Imprimante détectée</p>
            <p className="mt-1 font-mono text-emerald-800">{label}</p>
            <p className="text-emerald-700 mt-1 text-xs">
              Connexion mémorisée — reconnexion automatique au prochain lancement.
            </p>
          </div>
        ) : (
          <div className="mb-4 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] p-4 text-sm text-[#4B5563]">
            <p>
              Cliquez ci-dessous, sélectionnez votre imprimante thermique 80&nbsp;mm dans la
              popup et autorisez l&apos;accès. La connexion est mémorisée pour les
              sessions futures (aucun pilote système requis).
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Modèles testés : Epson TM-T20/T82/T88, Star TSP100/143, Bixolon SRP-330,
              et la plupart des génériques USB 80&nbsp;mm.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {!connected ? (
            <button
              data-testid="connect-printer"
              onClick={connect}
              disabled={!supported}
              className="flex items-center justify-center gap-2 rounded-md bg-[#002FA7] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Usb className="h-4 w-4" />
              Connecter l&apos;imprimante
            </button>
          ) : (
            <button
              data-testid="disconnect-printer"
              onClick={disconnect}
              className="flex items-center justify-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95"
            >
              <PowerOff className="h-4 w-4" />
              Déconnecter
            </button>
          )}
          <button
            data-testid="test-print-btn"
            disabled={!connected}
            onClick={testPrint}
            className="flex items-center justify-center gap-2 rounded-md bg-[#0A0A0A] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-black active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            Tester impression
          </button>
          <button
            data-testid="test-drawer-btn"
            disabled={!connected}
            onClick={openDrawer}
            className="flex items-center justify-center gap-2 rounded-md border-2 border-[#F97316] bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider text-[#F97316] hover:bg-orange-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Coins className="h-4 w-4" />
            Ouvrir tiroir
          </button>
        </div>
      </section>

      {/* Behavior preferences */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Comportement
            </p>
            <h2 className="text-xl font-bold">Impressions automatiques</h2>
          </div>
        </div>

        <div className="space-y-3">
          <ToggleCard
            testid="auto-print-z"
            label="Imprimer le journal Z à la clôture"
            description="Génère et imprime automatiquement le journal des ventes du service à chaque clôture Z."
            checked={form.auto_print_z}
            onChange={(v) => setForm({ ...form, auto_print_z: v })}
          />
          <ToggleCard
            testid="auto-print-receipt"
            label="Imprimer le ticket à chaque encaissement"
            description="Le reçu sort automatiquement dès qu'une vente est validée."
            checked={form.auto_print_receipt ?? true}
            onChange={(v) => setForm({ ...form, auto_print_receipt: v })}
          />
          <ToggleCard
            testid="open-drawer-on-cash"
            label="Ouvrir le tiroir-caisse pour les paiements en espèces"
            description="Envoie une impulsion au tiroir branché sur le port RJ11 de l'imprimante (commande ESC p)."
            checked={form.open_drawer_on_cash ?? true}
            onChange={(v) => setForm({ ...form, open_drawer_on_cash: v })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Largeur papier
            </span>
            <select
              data-testid="paper-width"
              value={form.paper_width_mm}
              onChange={(e) =>
                setForm({ ...form, paper_width_mm: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 outline-none focus:border-[#002FA7]"
            >
              <option value={58}>58 mm (32 caractères)</option>
              <option value={80}>80 mm (48 caractères)</option>
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

        <label className="block mt-3">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Pied de ticket
          </span>
          <input
            data-testid="footer-line"
            value={form.footer_line || ""}
            onChange={(e) => setForm({ ...form, footer_line: e.target.value })}
            placeholder="Merci de votre visite — A bientot !"
            className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
          />
        </label>

        <button
          data-testid="save-print"
          onClick={submit}
          disabled={saving}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </section>

      <section className="rounded-md border-2 border-dashed border-[#E5E7EB] bg-white p-6 max-w-3xl text-sm text-[#4B5563]">
        <p className="font-bold text-[#0A0A0A] mb-2">📦 Installation locale en kiosque</p>
        <ol className="ml-4 list-decimal space-y-1.5">
          <li>
            Sur le terminal POS, ouvrez QuickPOS dans Chrome ou Edge en HTTPS.
          </li>
          <li>
            Cliquez sur l&apos;icône <strong>&laquo;&nbsp;Installer&nbsp;&raquo;</strong> dans la barre
            d&apos;adresse → l&apos;app s&apos;ajoute au bureau et démarre comme une appli native.
          </li>
          <li>
            Branchez l&apos;imprimante thermique en USB et cliquez &laquo;&nbsp;Connecter
            l&apos;imprimante&nbsp;&raquo; ci-dessus (autorisation une seule fois).
          </li>
          <li>
            Branchez le tiroir-caisse au port RJ11 de l&apos;imprimante.
          </li>
          <li>
            Lancez l&apos;app en plein écran avec <code>chrome --kiosk --app=https://votre-app</code>{" "}
            pour un mode dédié sans navigation.
          </li>
        </ol>
      </section>
    </div>
  );
}

function ToggleCard({ testid, label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-md border-2 border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 cursor-pointer hover:bg-white">
      <input
        type="checkbox"
        data-testid={testid}
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 mt-0.5"
      />
      <div className="flex-1">
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
