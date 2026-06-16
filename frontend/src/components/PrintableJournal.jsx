import { formatCurrency, formatDateTime } from "@/lib/api";

const PAYMENT_LABEL = { cash: "ESPÈCES", card: "CARTE", mobile: "MOBILE" };

/**
 * Z journal layout optimized for 80mm thermal printer.
 * Print CSS in index.css sets @page size 80mm and hides everything else.
 */
export default function PrintableJournal({ shopName, sessionData, sales }) {
  if (!sessionData) return null;
  const opened = sessionData.opened_at;
  const closed = sessionData.closed_at;

  return (
    <div className="print-only printable-z">
      <div className="z-header">
        <p className="z-title">{shopName || "QuickPOS"}</p>
        <p>JOURNAL DE CLÔTURE Z</p>
        <p className="z-mono">{closed?.slice(0, 10)}</p>
      </div>
      <div className="z-dashed" />
      <p>Serveur: {sessionData.server_name || "—"}</p>
      <p>Ouverture: {formatDateTime(opened)}</p>
      <p>Clôture: {formatDateTime(closed)}</p>
      <div className="z-dashed" />

      <p className="z-section">VENTES ({sessionData.num_sales})</p>
      {(sales || []).length === 0 ? (
        <p>Aucune vente</p>
      ) : (
        (sales || []).map((s) => (
          <div key={s.id} className="z-sale">
            <div className="z-row">
              <span>#{String(s.ticket_number).padStart(4, "0")}</span>
              <span>{(s.created_at || "").slice(11, 16)}</span>
              <span>{PAYMENT_LABEL[s.payment_method] || s.payment_method}</span>
              <span className="z-total">{formatCurrency(s.total)}</span>
            </div>
          </div>
        ))
      )}

      <div className="z-dashed" />
      <p className="z-section">TOTAUX</p>
      <div className="z-row">
        <span>Nb ventes</span>
        <span>{sessionData.num_sales}</span>
      </div>
      <div className="z-row">
        <span>Panier moyen</span>
        <span>{formatCurrency(sessionData.avg_ticket)}</span>
      </div>
      <div className="z-row z-bold">
        <span>CHIFFRE D'AFFAIRES</span>
        <span>{formatCurrency(sessionData.total_revenue)}</span>
      </div>

      <div className="z-dashed" />
      <p className="z-section">PAIEMENTS</p>
      {Object.entries(sessionData.by_payment || {}).map(([k, v]) => (
        <div className="z-row" key={k}>
          <span>{PAYMENT_LABEL[k] || k}</span>
          <span>{formatCurrency(v)}</span>
        </div>
      ))}

      {sessionData.by_category && sessionData.by_category.length > 0 && (
        <>
          <div className="z-dashed" />
          <p className="z-section">CATÉGORIES</p>
          {sessionData.by_category.map((c) => (
            <div className="z-row" key={c.category}>
              <span>{c.category}</span>
              <span>{formatCurrency(c.revenue)}</span>
            </div>
          ))}
        </>
      )}

      <div className="z-dashed" />
      <p className="z-section">CAISSE</p>
      <div className="z-row">
        <span>Fond initial</span>
        <span>{formatCurrency(sessionData.opening_cash || 0)}</span>
      </div>
      <div className="z-row">
        <span>Espèces attendues</span>
        <span>{formatCurrency(sessionData.expected_cash || 0)}</span>
      </div>
      <div className="z-row">
        <span>Espèces comptées</span>
        <span>{formatCurrency(sessionData.closing_cash_declared || 0)}</span>
      </div>
      <div className="z-row z-bold">
        <span>ÉCART</span>
        <span>{formatCurrency(sessionData.cash_difference || 0)}</span>
      </div>

      {sessionData.top_products && sessionData.top_products.length > 0 && (
        <>
          <div className="z-dashed" />
          <p className="z-section">TOP 5 PRODUITS</p>
          {sessionData.top_products.slice(0, 5).map((p, i) => (
            <div className="z-row" key={i}>
              <span>
                {p.qty}× {p.name}
              </span>
              <span>{formatCurrency(p.revenue)}</span>
            </div>
          ))}
        </>
      )}

      <div className="z-dashed" />
      <p className="z-center">— FIN DU JOURNAL Z —</p>
      <p className="z-center z-small">Document non modifiable</p>
      <div style={{ height: "32px" }} />
    </div>
  );
}
