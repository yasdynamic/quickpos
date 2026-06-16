import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Delete, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const press = (k) => {
    if (loading) return;
    if (pin.length >= 6) return;
    setPin((p) => p + k);
  };

  const erase = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Nom d'utilisateur requis");
      return;
    }
    if (pin.length < 4) {
      toast.error("PIN trop court (4 à 6 chiffres)");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { name: name.trim(), pin });
      login(res.data);
      toast.success(`Bienvenue ${res.data.name}`);
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Identifiants incorrects");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-[#FAFAFA] p-6">
      <img
        src="/brand/warya-blue-large.png"
        alt="WARYA"
        className="h-48 w-auto object-contain mb-10"
      />

      <div className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500 text-center">
          Connexion
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-center mt-1 mb-6">
          Bienvenue
        </h1>

        <label className="block mb-5">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1">
            <User className="h-3 w-3" />
            Nom d&apos;utilisateur
          </span>
          <input
            data-testid="login-name"
            autoFocus
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Admin, Sophie, Marc…"
            className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-3 text-lg outline-none focus:border-[#002FA7]"
            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("pin-field")?.focus(); }}
          />
        </label>

        <div className="mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Code PIN
          </span>
          <div
            id="pin-field"
            data-testid="pin-display"
            className="mt-1 flex h-14 items-center justify-center gap-3 rounded-md border-2 border-[#E5E7EB] bg-[#FAFAFA]"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full transition-colors ${
                  i < pin.length ? "bg-[#002FA7]" : "bg-[#E5E7EB]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <button
              key={k}
              data-testid={`pin-key-${k}`}
              onClick={() => press(k)}
              className="h-16 rounded-md border border-[#E5E7EB] bg-white text-2xl font-bold hover:bg-[#FAFAFA] active:scale-95 transition-transform"
            >
              {k}
            </button>
          ))}
          <button
            data-testid="pin-clear"
            onClick={() => setPin("")}
            className="h-16 rounded-md border border-[#E5E7EB] bg-white text-xs font-bold uppercase tracking-wider hover:bg-[#FAFAFA] active:scale-95"
          >
            Effacer
          </button>
          <button
            data-testid="pin-key-0"
            onClick={() => press("0")}
            className="h-16 rounded-md border border-[#E5E7EB] bg-white text-2xl font-bold hover:bg-[#FAFAFA] active:scale-95 transition-transform"
          >
            0
          </button>
          <button
            data-testid="pin-erase"
            onClick={erase}
            className="h-16 rounded-md border border-[#E5E7EB] bg-white flex items-center justify-center hover:bg-[#FAFAFA] active:scale-95"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <button
          data-testid="pin-submit"
          disabled={loading || !name.trim() || pin.length < 4}
          onClick={submit}
          className="mt-4 h-14 w-full rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Connexion…" : "Valider"}
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center">
        WARYA · Caisse tactile · Activation hors ligne sécurisée
      </p>
    </div>
  );
}
