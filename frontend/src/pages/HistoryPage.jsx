import { useEffect, useState } from "react";
import { Calendar, Eye } from "lucide-react";
import { api, formatCurrency, formatDateTime, todayISO } from "@/lib/api";
import ReceiptModal from "@/components/ReceiptModal";

const PAYMENT = { cash: "Espèces", card: "Carte", mobile: "Mobile Money" };

export default function HistoryPage() {
  const [date, setDate] = useState(todayISO());
  const [sales, setSales] = useState([]);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    const res = await api.get("/sales", { params: { target_date: date } });
    setSales(res.data);
  };

  useEffect(() => {
    load();
  }, [date]);

  const total = sales.reduce((a, s) => a + s.total, 0);

  return (
    <div className="p-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Journal
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Historique des ventes</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <input
            data-testid="history-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent outline-none text-sm"
          />
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Ventes" value={sales.length} />
        <Stat label="Chiffre du jour" value={formatCurrency(total)} accent />
        <Stat
          label="Panier moyen"
          value={formatCurrency(sales.length ? total / sales.length : 0)}
        />
      </div>

      <section className="rounded-md border border-[#E5E7EB] bg-white overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
            <tr>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500">Ticket</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500">Heure</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500">Articles</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500">Paiement</th>
              <th className="p-4 text-xs uppercase tracking-wider text-slate-500 text-right">Total</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody data-testid="history-table">
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-[#E5E7EB] last:border-0">
                <td className="p-4 font-mono font-semibold">
                  #{String(s.ticket_number).padStart(4, "0")}
                </td>
                <td className="p-4 text-slate-600">{formatDateTime(s.created_at)}</td>
                <td className="p-4">
                  {s.items.reduce((a, l) => a + l.quantity, 0)} article(s)
                </td>
                <td className="p-4">
                  <span className="inline-flex rounded-full bg-[#F4F6FB] px-2.5 py-1 text-xs font-semibold">
                    {PAYMENT[s.payment_method]}
                  </span>
                </td>
                <td className="p-4 text-right font-mono font-bold text-[#002FA7]">
                  {formatCurrency(s.total)}
                </td>
                <td className="p-4 text-right">
                  <button
                    data-testid={`view-sale-${s.id}`}
                    onClick={() => setPreview(s)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#FAFAFA] ml-auto"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Aucune vente pour cette date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <ReceiptModal
        open={!!preview}
        sale={preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      className={`rounded-md border p-5 ${
        accent ? "border-[#002FA7] bg-[#002FA7] text-white" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-[0.1em] font-semibold ${
          accent ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}
