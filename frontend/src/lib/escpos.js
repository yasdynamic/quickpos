// ESC/POS command builder for 80mm thermal printers
// All commands accept the printer width in characters (32 for 58mm, 48 for 80mm)

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const encoder = new TextEncoder();

// Build a Uint8Array from multiple byte/string parts
const concat = (...parts) => {
  const buffers = parts.map((p) => {
    if (typeof p === "string") return encoder.encode(p);
    if (p instanceof Uint8Array) return p;
    if (Array.isArray(p)) return new Uint8Array(p);
    if (typeof p === "number") return new Uint8Array([p]);
    return new Uint8Array();
  });
  const total = buffers.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of buffers) {
    out.set(b, off);
    off += b.length;
  }
  return out;
};

// Strip diacritics & non-ASCII for thermal printers (CP437/CP850 default)
const stripAccents = (str) =>
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[€]/g, "EUR")
    .replace(/[—–]/g, "-")
    .replace(/[''`]/g, "'")
    .replace(/[""«»]/g, '"');

export const cmd = {
  init: () => new Uint8Array([ESC, 0x40]), // ESC @
  lf: (n = 1) => new Uint8Array(Array(n).fill(LF)),
  align: (n) => new Uint8Array([ESC, 0x61, n]), // 0=left 1=center 2=right
  bold: (on) => new Uint8Array([ESC, 0x45, on ? 1 : 0]),
  doubleSize: (on) => new Uint8Array([GS, 0x21, on ? 0x11 : 0x00]), // double w+h
  doubleHeight: (on) => new Uint8Array([GS, 0x21, on ? 0x01 : 0x00]),
  underline: (n) => new Uint8Array([ESC, 0x2d, n]), // 0,1,2
  cut: () => new Uint8Array([GS, 0x56, 0x01]), // partial cut
  feedAndCut: () => new Uint8Array([GS, 0x56, 0x42, 0x05]),
  // Drawer kick - pulse on pin 2 (m=0) or pin 5 (m=1)
  drawer: () => new Uint8Array([ESC, 0x70, 0x00, 0x32, 0xfa]),
  beep: () => new Uint8Array([ESC, 0x42, 0x03, 0x02]), // 3 beeps short
  text: (s) => encoder.encode(stripAccents(s || "")),
};

// Build a single 80mm-formatted line: leftLabel ........... rightValue
// width default 48 for 80mm, 32 for 58mm
export const pad = (left, right, width = 48) => {
  left = stripAccents(String(left ?? ""));
  right = stripAccents(String(right ?? ""));
  if (left.length + right.length + 1 >= width) {
    return left + " " + right;
  }
  const spaces = " ".repeat(width - left.length - right.length);
  return left + spaces + right;
};

export const dashed = (width = 48) => "-".repeat(width);

// Build a receipt for a sale
export const buildReceipt = ({ sale, shopName, footerLine, currency, width = 48 }) => {
  const parts = [];
  parts.push(cmd.init());
  parts.push(cmd.align(1)); // center
  parts.push(cmd.doubleSize(true));
  parts.push(cmd.text((shopName || "POS") + "\n"));
  parts.push(cmd.doubleSize(false));
  parts.push(cmd.text("Reçu de caisse\n"));
  parts.push(cmd.text(new Date(sale.created_at).toLocaleString("fr-FR") + "\n"));
  parts.push(cmd.align(0)); // left
  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.text(`Ticket N° ${String(sale.ticket_number).padStart(4, "0")}\n`));
  if (sale.cashier_name) parts.push(cmd.text(`Caissier : ${sale.cashier_name}\n`));
  if (sale.table_name) parts.push(cmd.text(`Table : ${sale.table_name}\n`));
  parts.push(cmd.text(dashed(width) + "\n"));

  const fmt = (v) => formatMoneyForPrint(v, currency);
  for (const item of sale.items || []) {
    const total = item.price * item.quantity;
    parts.push(cmd.text(`${item.quantity} x ${item.name}\n`));
    parts.push(cmd.text(pad("", fmt(total), width) + "\n"));
  }

  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.bold(true));
  parts.push(cmd.doubleHeight(true));
  parts.push(cmd.text(pad("TOTAL", fmt(sale.total), width) + "\n"));
  parts.push(cmd.doubleHeight(false));
  parts.push(cmd.bold(false));

  const methodLabel = { cash: "ESPÈCES", card: "CARTE", mobile: "MOBILE" }[sale.payment_method] || sale.payment_method;
  parts.push(
    cmd.text(
      pad(
        methodLabel,
        fmt(sale.amount_received != null ? sale.amount_received : sale.total),
        width
      ) + "\n"
    )
  );
  if (sale.change_due != null && sale.change_due > 0) {
    parts.push(cmd.text(pad("Rendu", fmt(sale.change_due), width) + "\n"));
  }
  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.align(1));
  if (footerLine) parts.push(cmd.text(stripAccents(footerLine) + "\n"));
  parts.push(cmd.lf(3));
  parts.push(cmd.cut());
  return concat(...parts);
};

// Build a Z journal
export const buildZJournal = ({ sessionData, sales, shopName, footerLine, currency, width = 48 }) => {
  const parts = [];
  const fmt = (v) => formatMoneyForPrint(v, currency);
  parts.push(cmd.init());
  parts.push(cmd.align(1));
  parts.push(cmd.doubleSize(true));
  parts.push(cmd.text((shopName || "POS") + "\n"));
  parts.push(cmd.doubleSize(false));
  parts.push(cmd.bold(true));
  parts.push(cmd.text("JOURNAL Z\n"));
  parts.push(cmd.bold(false));
  parts.push(cmd.text((sessionData.closed_at || "").slice(0, 10) + "\n"));
  parts.push(cmd.align(0));
  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.text(`Serveur  : ${sessionData.server_name || "-"}\n`));
  parts.push(cmd.text(`Ouvert   : ${(sessionData.opened_at || "").slice(0, 19).replace("T", " ")}\n`));
  parts.push(cmd.text(`Clôturé  : ${(sessionData.closed_at || "").slice(0, 19).replace("T", " ")}\n`));
  parts.push(cmd.text(dashed(width) + "\n"));

  parts.push(cmd.bold(true));
  parts.push(cmd.text(`VENTES (${sessionData.num_sales})\n`));
  parts.push(cmd.bold(false));
  for (const s of sales || []) {
    const m = { cash: "ESP", card: "CB", mobile: "MOB" }[s.payment_method] || "?";
    const line = `#${String(s.ticket_number).padStart(4, "0")} ${(s.created_at || "").slice(11, 16)} ${m}`;
    parts.push(cmd.text(pad(line, fmt(s.total), width) + "\n"));
  }
  if (!sales || sales.length === 0) {
    parts.push(cmd.text("Aucune vente\n"));
  }

  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.bold(true));
  parts.push(cmd.text("TOTAUX\n"));
  parts.push(cmd.bold(false));
  parts.push(cmd.text(pad("Nb ventes", String(sessionData.num_sales), width) + "\n"));
  parts.push(cmd.text(pad("Panier moyen", fmt(sessionData.avg_ticket), width) + "\n"));
  parts.push(cmd.bold(true));
  parts.push(cmd.doubleHeight(true));
  parts.push(cmd.text(pad("CA TOTAL", fmt(sessionData.total_revenue), width) + "\n"));
  parts.push(cmd.doubleHeight(false));
  parts.push(cmd.bold(false));

  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.bold(true));
  parts.push(cmd.text("PAIEMENTS\n"));
  parts.push(cmd.bold(false));
  for (const [k, v] of Object.entries(sessionData.by_payment || {})) {
    const label = { cash: "Espèces", card: "Carte", mobile: "Mobile" }[k] || k;
    parts.push(cmd.text(pad(label, fmt(v), width) + "\n"));
  }

  if ((sessionData.by_category || []).length > 0) {
    parts.push(cmd.text(dashed(width) + "\n"));
    parts.push(cmd.bold(true));
    parts.push(cmd.text("CATÉGORIES\n"));
    parts.push(cmd.bold(false));
    for (const c of sessionData.by_category) {
      parts.push(cmd.text(pad(c.category, fmt(c.revenue), width) + "\n"));
    }
  }

  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.bold(true));
  parts.push(cmd.text("CAISSE\n"));
  parts.push(cmd.bold(false));
  parts.push(cmd.text(pad("Fond initial", fmt(sessionData.opening_cash || 0), width) + "\n"));
  parts.push(cmd.text(pad("Esp. attendues", fmt(sessionData.expected_cash || 0), width) + "\n"));
  parts.push(cmd.text(pad("Esp. comptées", fmt(sessionData.closing_cash_declared || 0), width) + "\n"));
  parts.push(cmd.bold(true));
  parts.push(cmd.text(pad("ÉCART", fmt(sessionData.cash_difference || 0), width) + "\n"));
  parts.push(cmd.bold(false));

  if ((sessionData.top_products || []).length > 0) {
    parts.push(cmd.text(dashed(width) + "\n"));
    parts.push(cmd.bold(true));
    parts.push(cmd.text("TOP 5 PRODUITS\n"));
    parts.push(cmd.bold(false));
    for (const p of sessionData.top_products.slice(0, 5)) {
      parts.push(cmd.text(pad(`${p.qty}x ${p.name}`, fmt(p.revenue), width) + "\n"));
    }
  }

  parts.push(cmd.text(dashed(width) + "\n"));
  parts.push(cmd.align(1));
  parts.push(cmd.text("— FIN DU JOURNAL Z —\n"));
  parts.push(cmd.text("Document non modifiable\n"));
  if (footerLine) parts.push(cmd.text(stripAccents(footerLine) + "\n"));
  parts.push(cmd.lf(4));
  parts.push(cmd.cut());
  return concat(...parts);
};

const formatMoneyForPrint = (value, currency) => {
  const c = currency || { symbol: "EUR", decimals: 2, position: "after" };
  const decimals = c.decimals ?? 2;
  const v = Number(value || 0);
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const num = decimals > 0 ? `${withSep},${dec}` : withSep;
  const sym = stripAccents(c.symbol || "");
  return c.position === "before" ? `${sym} ${num}` : `${num} ${sym}`;
};
