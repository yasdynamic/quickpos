import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import * as Printer from "@/lib/printer";
import { buildReceipt, buildZJournal, cmd } from "@/lib/escpos";
import { useSettings } from "@/context/SettingsContext";

const PrinterContext = createContext(null);

export const PrinterProvider = ({ children }) => {
  const { settings } = useSettings();
  const [connected, setConnected] = useState(false);
  const [label, setLabel] = useState(null);
  const supported = Printer.isSupported();

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

  const printReceipt = useCallback(
    async (sale) => {
      if (!Printer.isConnected()) return false;
      try {
        const bytes = buildReceipt({
          sale,
          shopName: settings?.print?.shop_name,
          footerLine: settings?.print?.footer_line,
          currency: settings?.currency,
          width,
        });
        await Printer.send(bytes);
        return true;
      } catch (err) {
        toast.error("Erreur impression : " + err.message);
        return false;
      }
    },
    [settings, width]
  );

  const printZ = useCallback(
    async (sessionData, sales) => {
      if (!Printer.isConnected()) return false;
      try {
        const bytes = buildZJournal({
          sessionData,
          sales,
          shopName: settings?.print?.shop_name,
          footerLine: settings?.print?.footer_line,
          currency: settings?.currency,
          width,
        });
        await Printer.send(bytes);
        return true;
      } catch (err) {
        toast.error("Erreur impression Z : " + err.message);
        return false;
      }
    },
    [settings, width]
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
