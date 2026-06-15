import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Delete, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const press = (k) => {
    if (loading) return;
    if (pin.length >= 6) return;
    setPin((p) => p + k);
  };

  const erase = () => setPin((p) => p.slice(0, -1));

  const submit = async (value) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { pin: value });
      login(res.data);
      toast.success(`Bienvenue ${res.data.name}`);
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "PIN incorrect");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = () => {
    if (pin.length < 4) {
      toast.error("PIN trop court (min 4 chiffres)");
      return;
    }
    submit(pin);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FAFAFA] p-6">
      <div className="grid w-full max-w-5xl grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="hidden lg:flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#002FA7] text-white">
              <Zap className="h-6 w-6" />
            </div>
            <span className="text-3xl font-bold tracking-tight">QuickPOS</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Encaissez.
            <br />
            <span className="text-[#002FA7]">Clôturez.</span>
            <br />
            Recevez.
          </h1>
          <p className="text-lg text-[#4B5563] max-w-md leading-relaxed">
            Une caisse tactile minimaliste qui envoie automatiquement vos états
            quotidiens et mensuels par email à la clôture.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Tactile", "Stock simple", "Rapports auto", "Multi-paiement"].map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#4B5563]"
                >
                  {tag}
                </span>
              )
            )}
          </div>
          <p className="mt-4 text-sm text-slate-500" data-testid="default-pin-hint">
            PIN admin par défaut : <span className="font-mono font-bold">1234</span>
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-lg border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.1em] font-semibold text-slate-500">
              Connexion
            </p>
            <h2 className="text-2xl font-bold mt-1">Entrez votre code PIN</h2>
          </div>

          <div
            className="flex justify-center gap-3 py-4"
            data-testid="pin-display"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full transition-colors ${
                  pin.length > i ? "bg-[#002FA7]" : "bg-[#E5E7EB]"
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                data-testid={`pin-key-${k}`}
                onClick={() => press(k)}
                className="h-20 rounded-md border border-[#E5E7EB] bg-white text-3xl font-semibold tracking-tight text-[#0A0A0A] hover:bg-[#F4F6FB] active:scale-95 transition-transform"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              data-testid="pin-key-clear"
              onClick={() => setPin("")}
              className="h-20 rounded-md border border-[#E5E7EB] bg-white text-sm font-semibold uppercase tracking-wider text-[#4B5563] hover:bg-[#F4F6FB] active:scale-95 transition-transform"
            >
              Effacer
            </button>
            <button
              type="button"
              data-testid="pin-key-0"
              onClick={() => press("0")}
              className="h-20 rounded-md border border-[#E5E7EB] bg-white text-3xl font-semibold text-[#0A0A0A] hover:bg-[#F4F6FB] active:scale-95 transition-transform"
            >
              0
            </button>
            <button
              type="button"
              data-testid="pin-key-back"
              onClick={erase}
              className="flex h-20 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F4F6FB] active:scale-95 transition-transform"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          <button
            type="button"
            data-testid="pin-submit"
            disabled={loading || pin.length < 4}
            onClick={handleEnter}
            className="mt-2 h-16 rounded-md bg-[#002FA7] text-lg font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Connexion…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
