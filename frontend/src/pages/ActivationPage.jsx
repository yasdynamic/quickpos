import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Copy, Upload, FileWarning, CheckCircle2, RotateCcw, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function ActivationPage() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [activating, setActivating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const r = await api.get("/license/status");
      setInfo(r.data);
      if (r.data.mode === "active" || r.data.mode === "expiring_soon_30" || r.data.mode === "expiring_soon_90") {
        // Already activated → bounce to Hub
        navigate("/", { replace: true });
      }
    } catch (e) {
      // fallback to /license/machine-id if status fails
      try {
        const m = await api.get("/license/machine-id");
        setInfo({ ...m.data, mode: "unactivated", activated: false });
      } catch {}
    }
  };

  useEffect(() => { load(); }, []);

  const onFile = async (file) => {
    if (!file) return;
    setActivating(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/license/activate", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Licence activée avec succès !");
      setTimeout(() => navigate("/", { replace: true }), 800);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Activation impossible");
    } finally {
      setActivating(false);
    }
  };

  const copyFingerprint = () => {
    const fp = info?.machine_fingerprint || "";
    navigator.clipboard.writeText(fp).then(
      () => toast.success("Empreinte copiée"),
      () => toast.error("Copie impossible"),
    );
  };

  if (!info) return <div className="p-12 text-slate-400">Chargement…</div>;
  const fp = info.machine_fingerprint;
  const isInvalid = info.mode === "invalid";
  const isRestricted = info.mode === "restricted";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F4F6FB] to-[#E5E7EB] p-6" data-testid="activation-page">
      <div className="w-full max-w-3xl">
        <header className="mb-6 text-center">
          <img
            src="/brand/warya-blue-large.png"
            alt="WARYA"
            className="mx-auto h-40 w-auto object-contain mb-6"
          />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Activer WARYA
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Logiciel sous licence — activation hors ligne sécurisée
          </p>
        </header>

        {isRestricted && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-[#FF2A2A] bg-red-50 p-4">
            <FileWarning className="h-5 w-5 text-[#FF2A2A] mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-[#FF2A2A]">Licence expirée — mode restreint</p>
              <p className="text-red-900 mt-1">
                Vous pouvez consulter vos données et imprimer vos rapports, mais
                l'enregistrement de nouvelles ventes est bloqué. Renouvelez votre
                licence en important un nouveau fichier ci-dessous.
              </p>
            </div>
          </div>
        )}

        {isInvalid && info.reason && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
            <FileWarning className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-900">{info.reason}</p>
          </div>
        )}

        <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <KeyRound className="h-5 w-5 text-[#002FA7]" />
            <h2 className="text-lg font-bold">1. Votre empreinte machine</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Envoyez cette empreinte à votre éditeur WARYA via{" "}
            <strong>WhatsApp, SMS, email ou téléphone</strong>. L'éditeur générera
            un fichier licence personnalisé pour ce poste exact.
          </p>
          <div className="flex items-center gap-3 rounded-md border-2 border-[#002FA7] bg-[#F4F6FB] p-4">
            <code data-testid="machine-fingerprint" className="flex-1 font-mono text-2xl font-bold text-[#002FA7] tracking-[0.1em] select-all">
              {fp}
            </code>
            <button
              data-testid="copy-fingerprint"
              onClick={copyFingerprint}
              className="flex items-center gap-2 rounded-md bg-[#002FA7] px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
            >
              <Copy className="h-4 w-4" />
              Copier
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-[#FAFAFA] p-3">
              <p className="text-slate-500 uppercase tracking-wider font-semibold">Produit</p>
              <p className="font-bold mt-0.5">{info.product || "WARYA"}</p>
            </div>
            <div className="rounded-md bg-[#FAFAFA] p-3">
              <p className="text-slate-500 uppercase tracking-wider font-semibold">Version</p>
              <p className="font-bold mt-0.5">{info.version || "1.0"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="h-5 w-5 text-[#002FA7]" />
            <h2 className="text-lg font-bold">2. Importer la licence reçue</h2>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".lic,.json,.txt"
            data-testid="license-file-input"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <div
            data-testid="license-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center cursor-pointer rounded-md border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-[#002FA7] bg-[#F4F6FB]" : "border-[#E5E7EB] hover:border-[#002FA7] hover:bg-[#FAFAFA]"
            } ${activating ? "opacity-50 pointer-events-none" : ""}`}
          >
            {activating ? (
              <>
                <RotateCcw className="h-10 w-10 text-[#002FA7] animate-spin mb-3" />
                <p className="text-base font-semibold">Vérification de la signature…</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-base font-semibold">
                  Glissez-déposez le fichier <code className="bg-[#FAFAFA] rounded px-1.5 py-0.5 text-[#002FA7]">.lic</code>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ou cliquez pour parcourir
                </p>
              </>
            )}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-md bg-emerald-50 border border-emerald-200 p-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-900">
              <p className="font-bold">Activation 100% hors ligne</p>
              <p className="mt-0.5">
                La signature Ed25519 est vérifiée localement avec la clé publique
                intégrée à l'application. Aucune connexion Internet n'est requise.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-slate-400">
          WARYA — Protégé par signature cryptographique Ed25519 + AES-256
        </p>
      </div>
    </div>
  );
}
