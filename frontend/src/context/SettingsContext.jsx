import { createContext, useContext, useEffect, useState } from "react";
import { api, setCurrency } from "@/lib/api";

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const res = await api.get("/settings");
    setCurrency(res.data.currency);
    setSettings(res.data);
    setLoaded(true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, []);

  const save = async (patch) => {
    const res = await api.put("/settings", patch);
    setCurrency(res.data.currency);
    setSettings(res.data);
    return res.data;
  };

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FAFAFA]">
        <p className="text-slate-400 font-mono text-sm">Chargement…</p>
      </div>
    );
  }

  // key forces children remount when currency changes -> all formatCurrency calls refresh
  return (
    <SettingsContext.Provider value={{ settings, save, reload: load }}>
      <div key={`${settings.currency.code}-${settings.currency.symbol}`} style={{ display: "contents" }}>
        {children}
      </div>
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
