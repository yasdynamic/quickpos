import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Blocks rendering of children when no cash session is open and redirects
 * to the Caisse Hub. Used to enforce the strict Clyo-style workflow.
 */
export default function SessionGuard({ children }) {
  const [state, setState] = useState({ loading: true, hasSession: false });

  useEffect(() => {
    let mounted = true;
    api
      .get("/cash-sessions/current")
      .then((res) => {
        if (!mounted) return;
        setState({ loading: false, hasSession: !!res.data });
      })
      .catch(() => mounted && setState({ loading: false, hasSession: false }));
    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="p-8 text-sm text-slate-400" data-testid="session-guard-loading">
        Vérification de la caisse…
      </div>
    );
  }
  if (!state.hasSession) {
    toast.warning("Ouvrez d'abord la caisse pour accéder à cette page");
    return <Navigate to="/" replace />;
  }
  return children;
}
