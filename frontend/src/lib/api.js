import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Add X-User-Id header automatically from localStorage for RBAC
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("quickpos.user");
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.id) config.headers["X-User-Id"] = u.id;
    }
  } catch {/* ignore */}
  return config;
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
  { code: "EUR", symbol: "€", decimals: 2, position: "after", label: "Euro",
    quickAmounts: [5, 10, 20, 50, 100] },
  { code: "XOF", symbol: "FCFA", decimals: 0, position: "after", label: "FCFA (Afrique de l'Ouest)",
    quickAmounts: [500, 1000, 2000, 5000, 10000] },
  { code: "XAF", symbol: "FCFA", decimals: 0, position: "after", label: "FCFA (Afrique Centrale)",
    quickAmounts: [500, 1000, 2000, 5000, 10000] },
  { code: "USD", symbol: "$", decimals: 2, position: "before", label: "Dollar US",
    quickAmounts: [5, 10, 20, 50, 100] },
  { code: "GBP", symbol: "£", decimals: 2, position: "before", label: "Livre Sterling",
    quickAmounts: [5, 10, 20, 50, 100] },
  { code: "CHF", symbol: "CHF", decimals: 2, position: "after", label: "Franc Suisse",
    quickAmounts: [5, 10, 20, 50, 100] },
  { code: "MAD", symbol: "DH", decimals: 2, position: "after", label: "Dirham Marocain",
    quickAmounts: [20, 50, 100, 200, 500] },
  { code: "TND", symbol: "DT", decimals: 3, position: "after", label: "Dinar Tunisien",
    quickAmounts: [5, 10, 20, 50, 100] },
  { code: "CAD", symbol: "$", decimals: 2, position: "before", label: "Dollar Canadien",
    quickAmounts: [5, 10, 20, 50, 100] },
];

// Default quick amounts when the active preset does not define them
const DEFAULT_QUICK_AMOUNTS = [5, 10, 20, 50, 100];

export const getQuickAmounts = () => {
  const match = PRESETS.find((p) => p.code === CURRENCY.code);
  return match?.quickAmounts || DEFAULT_QUICK_AMOUNTS;
};

// Format a numeric value using the active currency's decimals (no symbol)
export const formatAmountInput = (value) => {
  const d = CURRENCY.decimals || 0;
  return Number(value || 0).toFixed(d);
};
