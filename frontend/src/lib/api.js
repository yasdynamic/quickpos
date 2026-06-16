import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Mutable currency config — updated by SettingsProvider on app load + change
let CURRENCY = { code: "EUR", symbol: "€", decimals: 2, position: "after" };

export const setCurrency = (c) => {
  if (c && c.code) CURRENCY = { ...CURRENCY, ...c };
};

export const getCurrency = () => CURRENCY;

const formatNumber = (value, decimals) => {
  const v = Number(value || 0);
  const fixed = v.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimals > 0 ? `${withSep},${decPart}` : withSep;
};

export const formatCurrency = (value) => {
  const num = formatNumber(value, CURRENCY.decimals);
  if (CURRENCY.position === "before") return `${CURRENCY.symbol} ${num}`;
  return `${num} ${CURRENCY.symbol}`;
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const PRESETS = [
  { code: "EUR", symbol: "€", decimals: 2, position: "after", label: "Euro" },
  { code: "XOF", symbol: "FCFA", decimals: 0, position: "after", label: "FCFA (Afrique de l'Ouest)" },
  { code: "XAF", symbol: "FCFA", decimals: 0, position: "after", label: "FCFA (Afrique Centrale)" },
  { code: "USD", symbol: "$", decimals: 2, position: "before", label: "Dollar US" },
  { code: "GBP", symbol: "£", decimals: 2, position: "before", label: "Livre Sterling" },
  { code: "CHF", symbol: "CHF", decimals: 2, position: "after", label: "Franc Suisse" },
  { code: "MAD", symbol: "DH", decimals: 2, position: "after", label: "Dirham Marocain" },
  { code: "TND", symbol: "DT", decimals: 3, position: "after", label: "Dinar Tunisien" },
  { code: "CAD", symbol: "$", decimals: 2, position: "before", label: "Dollar Canadien" },
];
