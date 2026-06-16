import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const LicenseContext = createContext({ status: null, refresh: () => {} });

export function LicenseProvider({ children }) {
  const [status, setStatus] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get("/license/status");
      setStatus(r.data);
      return r.data;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-check every 10 minutes (and on focus)
    const id = setInterval(refresh, 10 * 60 * 1000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <LicenseContext.Provider value={{ status, refresh }}>
      {children}
    </LicenseContext.Provider>
  );
}

export const useLicense = () => useContext(LicenseContext);
