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

// ---------------------------------------------------------------------------
// Raster image (GS v 0) — used for printing the WARYA logo on each receipt.
//
// Format: 1D 76 30 m  xL xH  yL yH  d1 ... dk
//   m   : mode (0 = normal, 1 = 2× width, 2 = 2× height, 3 = quadruple)
//   xL,xH: image width in BYTES (so pixel-width / 8)
//   yL,yH: image height in DOTS
//   data : monochrome bitmap, 8 horizontal pixels packed per byte,
//          MSB = leftmost pixel, "1" = black dot.
// ---------------------------------------------------------------------------

// Pack a monochrome ImageData-like {width, height, data} (RGBA8) into the
// ESC/POS raster command. Pixels are considered "black" when their luminance
// is below `threshold` (0..255). The width is rounded up to the next multiple
// of 8 by padding with white pixels on the right.
export const buildRasterImage = (imgData, { threshold = 180, mode = 0 } = {}) => {
  const { width, height, data } = imgData;
  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      // Treat fully-transparent as white; blend others on white background
      const alpha = a / 255;
      const lum =
        (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
      if (lum < threshold) {
        const byteIdx = y * bytesPerRow + (x >> 3);
        bitmap[byteIdx] |= 0x80 >> (x & 7);
      }
    }
  }
  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  const header = new Uint8Array([GS, 0x76, 0x30, mode, xL, xH, yL, yH]);
  const out = new Uint8Array(header.length + bitmap.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  return out;
};

// Load an image URL (or data URL) and rasterize it to ESC/POS, scaling so
// that the width never exceeds `maxWidth` dots (default 384 for 80mm paper).
// Returns a Uint8Array containing the full GS v 0 command, or null on failure.
export const loadLogoBytes = async (
  src,
  { maxWidth = 384, threshold = 180 } = {}
) => {
  if (!src) return null;
  if (typeof document === "undefined") return null;
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("logo load failed"));
      im.src = src;
    });
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w === 0 || h === 0) return null;
    if (w > maxWidth) {
      h = Math.round((h * maxWidth) / w);
      w = maxWidth;
    }
    // Round width down to a multiple of 8 so the raster maps cleanly
    w = Math.max(8, w - (w % 8));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    // White background so transparent areas don't print as black noise
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    return buildRasterImage(imgData, { threshold });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("logo rasterization failed", e);
    return null;
  }
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

// Build a receipt for a sale.
// `logoBytes` is an optional Uint8Array containing a pre-built GS v 0 raster
// (use `loadLogoBytes` ahead of time). `shopInfo` provides the rich shop
// identity printed beneath the logo.
export const buildReceipt = ({
  sale,
  shopName,
  shopInfo,
  footerLine,
  currency,
  width = 48,
  logoBytes = null,
}) => {
  const parts = [];
  parts.push(cmd.init());
  parts.push(cmd.align(1)); // center
  if (logoBytes && logoBytes.length) {
    parts.push(logoBytes);
    parts.push(cmd.lf(1));
  }
  parts.push(cmd.doubleSize(true));
  parts.push(cmd.text((shopName || "POS") + "\n"));
  parts.push(cmd.doubleSize(false));
  if (shopInfo?.address) parts.push(cmd.text(shopInfo.address + "\n"));
  if (shopInfo?.phone) parts.push(cmd.text("Tel : " + shopInfo.phone + "\n"));
  if (shopInfo?.email) parts.push(cmd.text(shopInfo.email + "\n"));
  if (shopInfo?.website) parts.push(cmd.text(shopInfo.website + "\n"));
  if (shopInfo?.tax_number)
    parts.push(cmd.text("N° fiscal : " + shopInfo.tax_number + "\n"));
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
export const buildZJournal = ({
  sessionData,
  sales,
  shopName,
  shopInfo,
  footerLine,
  currency,
  width = 48,
  logoBytes = null,
}) => {
  const parts = [];
  const fmt = (v) => formatMoneyForPrint(v, currency);
  parts.push(cmd.init());
  parts.push(cmd.align(1));
  if (logoBytes && logoBytes.length) {
    parts.push(logoBytes);
    parts.push(cmd.lf(1));
  }
  parts.push(cmd.doubleSize(true));
  parts.push(cmd.text((shopName || "POS") + "\n"));
  parts.push(cmd.doubleSize(false));
  if (shopInfo?.address) parts.push(cmd.text(shopInfo.address + "\n"));
  if (shopInfo?.phone) parts.push(cmd.text("Tel : " + shopInfo.phone + "\n"));
  if (shopInfo?.tax_number)
    parts.push(cmd.text("N° fiscal : " + shopInfo.tax_number + "\n"));
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
