import { useState } from "react";
import { Download, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BackupSection() {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      // Use fetch + blob to trigger download with original filename
      const res = await fetch(`${API_URL}/api/backup/export`);
      if (!res.ok) throw new Error("Erreur de génération");
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename=([^;]+)/i);
      const filename = (match && match[1].trim()) || "warya-backup.zip";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Sauvegarde téléchargée : ${filename}`);
    } catch (err) {
      toast.error(err?.message || "Échec de la sauvegarde");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="max-w-2xl space-y-6" data-testid="backup-section">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold tracking-tight">Sauvegarder mes données</h2>
            <p className="mt-1 text-sm text-[#4B5563]">
              Crée un fichier ZIP local contenant toutes vos données : produits,
              ventes, clients, fournisseurs, stock, sessions de caisse,
              paramètres et journal NF525. Conservez ce fichier en lieu sûr
              (clé USB, Google&nbsp;Drive, OneDrive…).
            </p>
            <button
              data-testid="backup-download-btn"
              disabled={downloading}
              onClick={download}
              className="mt-5 flex items-center gap-2 rounded-md bg-[#002FA7] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Génération…" : "Télécharger la sauvegarde"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">Bonnes pratiques</p>
            <ul className="mt-1 list-disc list-inside space-y-1 text-amber-800">
              <li>Sauvegardez avant chaque clôture mensuelle.</li>
              <li>Conservez plusieurs copies (locale + Cloud).</li>
              <li>
                Le ZIP contient tous vos historiques de ventes (NF525) — gardez-le confidentiel.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
