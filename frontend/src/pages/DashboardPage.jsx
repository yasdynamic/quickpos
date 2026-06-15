import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, RefreshCw } from "lucide-react";
import { api, formatCurrency, todayISO } from "@/lib/api";

const PAYMENT_LABEL = { cash: "Espèces", card: "Carte", mobile: "Mobile Money" };
const COLORS = ["#002FA7", "#0EA5E9", "#F97316", "#EC4899", "#10B981", "#A855F7"];

export default function DashboardPage() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dashboard", { params: { target_date: date } });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date]);

  if (!data) {
    return <div className="p-8 text-slate-400">Chargement…</div>;
  }

  const paymentData = Object.entries(data.by_payment || {}).map(([k, v]) => ({
    name: PAYMENT_LABEL[k] || k,
    value: v,
  }));

  return (
    <div className="p-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
            Pilotage
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Tableau de bord</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <input
              data-testid="dashboard-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none text-sm"
            />
          </div>
          <button
            data-testid="dashboard-refresh"
            onClick={load}
            className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#FAFAFA] active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPI label="Chiffre d'affaires" value={formatCurrency(data.total_revenue)} accent />
        <KPI label="Nombre de ventes" value={data.num_sales} testid="kpi-num-sales" />
        <KPI label="Panier moyen" value={formatCurrency(data.avg_ticket)} />
        <KPI
          label="Méthodes utilisées"
          value={Object.keys(data.by_payment || {}).length}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Ventes par heure" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.by_hour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6FB" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => formatCurrency(v)}
                contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }}
              />
              <Bar dataKey="revenue" fill="#002FA7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Moyens de paiement">
          {paymentData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Ventes par catégorie" className="lg:col-span-2">
          {data.by_category.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.by_category} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F6FB" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Top produits">
          {data.top_products.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-slate-400 text-sm">
              Aucune donnée
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]" data-testid="top-products">
              {data.top_products.slice(0, 6).map((p, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-slate-400 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate font-semibold text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-mono text-sm">{formatCurrency(p.revenue)}</p>
                    <p className="text-xs text-slate-500">{p.qty} vendus</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function KPI({ label, value, accent, testid }) {
  return (
    <div
      className={`rounded-md border p-6 ${
        accent ? "border-[#002FA7] bg-[#002FA7] text-white" : "border-[#E5E7EB] bg-white"
      }`}
      data-testid={testid || `kpi-${label}`}
    >
      <p
        className={`text-xs uppercase tracking-[0.1em] font-semibold ${
          accent ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold font-mono tracking-tight">{value}</p>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section
      className={`rounded-md border border-[#E5E7EB] bg-white p-6 ${className}`}
    >
      <h3 className="mb-4 text-sm uppercase tracking-wider font-semibold text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}
