import { Navigate } from "react-router-dom";
import { useLicense } from "@/context/LicenseContext";

/**
 * Gates the entire app behind a valid license.
 * - unactivated / invalid → redirect to /activation
 * - active / expiring_soon_* / restricted → allow (restricted is enforced at API + UI level)
 */
export default function LicenseGuard({ children }) {
  const { status } = useLicense();
  if (!status) {
    return (
      <div className="p-12 text-sm text-slate-400" data-testid="license-loading">
        Vérification de la licence…
      </div>
    );
  }
  if (status.mode === "unactivated" || status.mode === "invalid") {
    return <Navigate to="/activation" replace />;
  }
  return children;
}
