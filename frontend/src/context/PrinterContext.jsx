import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import * as Printer from "@/lib/printer";
import { buildReceipt, buildZJournal, cmd, loadLogoBytes } from "@/lib/escpos";
import { useSettings } from "@/context/SettingsContext";

const PrinterContext = createContext(null);

const DEFAULT_LOGO_SRC = "/assets/warya-logo-print.png";

export const PrinterProvider = ({ children }) => {
  const { settings } = useSettings();
  const [connected, setConnected] = useState(false);
  const [label, setLabel] = useState(null);
  const supported = Printer.isSupported();
  // Cache rasterized logo bytes keyed by `${src}|${maxWidth}` to avoid
  // rebuilding the bitmap for every receipt.
  const logoCacheRef = useRef({ key: null, bytes: null });

  // Auto-reconnect to previously authorized device on mount
  useEffect(() => {
    if (!supported) return;
    Printer.reconnect()
      .then((d) => {
        if (d) {
          setConnected(true);
          setLabel(Printer.getDeviceLabel());
        }
      })
      .catch(() => {
        /* silent */
      });
  }, [supported]);

  const connect = useCallback(async () => {
    try {
      await Printer.requestDevice();
      setConnected(true);
      setLabel(Printer.getDeviceLabel());
      toast.success(`Imprimante connectée : ${Printer.getDeviceLabel()}`);
      return true;
    } catch (err) {
      toast.error(err.message || "Connexion impossible");
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await Printer.disconnect();
    setConnected(false);
    setLabel(null);
    toast.info("Imprimante déconnectée");
  }, []);

  const width = (settings?.print?.paper_width_mm || 80) === 58 ? 32 : 48;
  const maxLogoWidth = width === 32 ? 256 : 384;

  // Resolve the logo source: prefer a user-configured data URL from settings,
  // fall back to the bundled WARYA logo PNG.
  const logoSrc = settings?.print?.logo_data_url || DEFAULT_LOGO_SRC;

  const getLogoBytes = useCallback(async () => {
    const cacheKey = `${logoSrc}|${maxLogoWidth}`;
    if (logoCacheRef.current.key === cacheKey) {
      return logoCacheRef.current.bytes;
    }
    const bytes = await loadLogoBytes(logoSrc, { maxWidth: maxLogoWidth });
    logoCacheRef.current = { key: cacheKey, bytes };
    return bytes;
  }, [logoSrc, maxLogoWidth]);

  const shopInfo = {
    address: settings?.print?.shop_address || "",
    phone: settings?.print?.shop_phone || "",
    email: settings?.print?.shop_email || "",
    website: settings?.print?.shop_website || "",
    tax_number: settings?.print?.shop_tax_number || "",
  };

  const printReceipt = useCallback(
    async (sale) => {
      if (!Printer.isConnected()) return false;
      try {
        const logoBytes = await getLogoBytes();
        const bytes = buildReceipt({
          sale,
          shopName: settings?.print?.shop_name,
          shopInfo,
          footerLine: settings?.print?.footer_line,
          currency: settings?.currency,
          width,
          logoBytes,
        });
        await Printer.send(bytes);
        return true;
      } catch (err) {
        toast.error("Erreur impression : " + err.message);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, width, getLogoBytes]
  );

  const printZ = useCallback(
    async (sessionData, sales) => {
      if (!Printer.isConnected()) return false;
      try {
        const logoBytes = await getLogoBytes();
        const bytes = buildZJournal({
          sessionData,
          sales,
          shopName: settings?.print?.shop_name,
          shopInfo,
          footerLine: settings?.print?.footer_line,
          currency: settings?.currency,
          width,
          logoBytes,
        });
        await Printer.send(bytes);
        return true;
      } catch (err) {
        toast.error("Erreur impression Z : " + err.message);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, width, getLogoBytes]
  );

  const openDrawer = useCallback(async () => {
    if (!Printer.isConnected()) return false;
    try {
      await Printer.send(cmd.drawer());
      return true;
    } catch (err) {
      toast.error("Tiroir non ouvert : " + err.message);
      return false;
    }
  }, []);

  const beep = useCallback(async () => {
    if (!Printer.isConnected()) return false;
    try {
      await Printer.send(cmd.beep());
      return true;
    } catch {
      return false;
    }
  }, []);

  const testPrint = useCallback(async () => {
    if (!Printer.isConnected()) {
      toast.error("Imprimante non connectée");
      return false;
    }
    try {
      const parts = [
        cmd.init(),
        cmd.align(1),
        cmd.doubleSize(true),
        cmd.text((settings?.print?.shop_name || "WARYA") + "\n"),
        cmd.doubleSize(false),
        cmd.text("TEST IMPRESSION\n"),
        cmd.align(0),
        cmd.text("-".repeat(width) + "\n"),
        cmd.text("Connexion OK : " + Printer.getDeviceLabel() + "\n"),
        cmd.text("Largeur : " + width + " caractères\n"),
        cmd.text("Date : " + new Date().toLocaleString("fr-FR") + "\n"),
        cmd.text("-".repeat(width) + "\n"),
        cmd.lf(3),
        cmd.cut(),
      ];
      const total = parts.reduce((a, b) => a + b.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const p of parts) {
        out.set(p, off);
        off += p.length;
      }
      await Printer.send(out);
      toast.success("Test imprimé");
      return true;
    } catch (err) {
      toast.error("Erreur : " + err.message);
      return false;
    }
  }, [settings, width]);

  return (
    <PrinterContext.Provider
      value={{
        supported,
        connected,
        label,
        connect,
        disconnect,
        printReceipt,
        printZ,
        openDrawer,
        beep,
        testPrint,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = () => useContext(PrinterContext);
