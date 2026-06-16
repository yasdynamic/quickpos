import { Printer, X } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

const METHOD_LABEL = {
  cash: "ESPÈCES",
  card: "CARTE",
  mobile: "MOBILE MONEY",
};

export default function ReceiptModal({ open, onClose, sale }) {
  const { settings } = useSettings();
  if (!open || !sale) return null;

  const handlePrint = () => window.print();

  const shop = settings?.print || {};
  const logoSrc = shop.logo_data_url || "";
  const shopName = shop.shop_name || "WARYA";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="receipt-modal"
    >
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-sm uppercase tracking-wider font-bold">
            Aperçu ticket
          </h2>
          <div className="flex gap-2">
            <button
              data-testid="receipt-print"
              onClick={handlePrint}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              data-testid="receipt-close"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="receipt printable">
          <div className="flex flex-col items-center text-center">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={shopName}
                data-testid="receipt-logo"
                className="mb-2 max-h-16 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <p data-testid="receipt-shop-name" className="font-bold text-base uppercase tracking-wide">
              {shopName}
            </p>
            {shop.shop_address && (
              <p data-testid="receipt-shop-address" className="text-xs leading-tight">
                {shop.shop_address}
              </p>
            )}
            {shop.shop_phone && (
              <p data-testid="receipt-shop-phone" className="text-xs">
                Tél : {shop.shop_phone}
              </p>
            )}
            {shop.shop_email && (
              <p className="text-xs">{shop.shop_email}</p>
            )}
            {shop.shop_website && (
              <p className="text-xs">{shop.shop_website}</p>
            )}
            {shop.shop_tax_number && (
              <p data-testid="receipt-shop-tax" className="text-xs">
                N° fiscal : {shop.shop_tax_number}
              </p>
            )}
            <p className="mt-1">Reçu de caisse</p>
            <p>{formatDateTime(sale.created_at)}</p>
          </div>
          <div className="dashed" />
          <p>Ticket N° {String(sale.ticket_number).padStart(4, "0")}</p>
          {sale.cashier_name && <p>Caissier : {sale.cashier_name}</p>}
          <div className="dashed" />
          {sale.items.map((l, i) => (
            <div key={i} className="flex justify-between">
              <span className="truncate pr-2">
                {l.quantity} × {l.name}
              </span>
              <span>{formatCurrency(l.price * l.quantity)}</span>
            </div>
          ))}
          <div className="dashed" />
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL</span>
            <span data-testid="receipt-total">{formatCurrency(sale.total)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>{METHOD_LABEL[sale.payment_method]}</span>
            <span>
              {formatCurrency(
                sale.amount_received != null ? sale.amount_received : sale.total
              )}
            </span>
          </div>
          {sale.change_due != null && sale.change_due > 0 && (
            <div className="flex justify-between">
              <span>Rendu</span>
              <span>{formatCurrency(sale.change_due)}</span>
            </div>
          )}
          <div className="dashed" />
          <p className="text-center">
            {shop.footer_line || "Merci de votre visite !"}
          </p>
        </div>
      </div>
    </div>
  );
}
