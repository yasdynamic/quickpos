import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Package,
  BarChart3,
  History,
  Mail,
  LogOut,
  Banknote,
  Home,
  Settings as Cog,
  Users,
  Truck,
  Boxes,
  ClipboardList,
  RotateCcw,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

// Each nav entry now declares a permission key it requires (when defined).
// If the role has the permission OR the role is admin (full access), the entry is shown.
const NAV = [
  { to: "/", label: "Caisse", icon: Home, testid: "nav-hub", perm: null },
  { to: "/tables", label: "Plan de salle", icon: LayoutGrid, testid: "nav-tables", perm: "tables.access" },
  { to: "/session", label: "Sessions", icon: Banknote, testid: "nav-session", perm: "session.open" },
  { to: "/produits", label: "Produits", icon: Package, testid: "nav-products", perm: "products.read" },
  { to: "/plan-de-salle", label: "Config. salle", icon: MapPin, testid: "nav-tableplan", perm: "tableplan.write" },
  { to: "/stock", label: "Stock", icon: Boxes, testid: "nav-stock", perm: "stock.read" },
  { to: "/inventaire", label: "Inventaire", icon: ClipboardList, testid: "nav-inventory", perm: "stock.inventory" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck, testid: "nav-suppliers", perm: "suppliers.read" },
  { to: "/retours", label: "Retours / Avoirs", icon: RotateCcw, testid: "nav-refunds", perm: "refund.create" },
  { to: "/clients", label: "Clients", icon: Users, testid: "nav-customers", perm: "customers.read" },
  { to: "/dashboard", label: "Tableau de bord", icon: BarChart3, testid: "nav-dashboard", perm: "dashboard.read" },
  { to: "/historique", label: "Historique", icon: History, testid: "nav-history", perm: "history.read" },
  { to: "/rapports", label: "Rapports", icon: Mail, testid: "nav-reports", perm: "reports.read" },
  { to: "/parametres", label: "Paramètres", icon: Cog, testid: "nav-settings", perm: "settings.shop" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userPerms = (() => {
    const role = user?.role || "server";
    if (role === "admin") return null; // admin sees everything
    const rp = settings?.role_permissions || {};
    return new Set(rp[role] || []);
  })();

  const visibleNav = NAV.filter((item) => {
    if (!item.perm) return true;
    if (userPerms === null) return true; // admin
    return userPerms.has(item.perm);
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA]">
      <aside className="flex w-20 lg:w-64 shrink-0 flex-col border-r border-[#E5E7EB] bg-white">
        <div className="flex h-24 items-center justify-center px-4 lg:px-6 border-b border-[#E5E7EB]">
          <img
            src="/brand/warya-icon-192.png"
            alt="WARYA"
            className="h-16 w-16 rounded-md object-contain lg:hidden"
          />
          <img
            src="/brand/warya-blue-large.png"
            alt="WARYA"
            className="hidden lg:block h-16 object-contain"
          />
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-2 lg:p-3 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={item.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#002FA7] text-white"
                    : "text-[#4B5563] hover:bg-[#F4F6FB] hover:text-[#0A0A0A]"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#E5E7EB] p-3 space-y-2">
          <div
            className="hidden lg:flex items-center gap-2 rounded-md px-2 py-2"
            data-testid="current-user-card"
            style={{ backgroundColor: (user?.color || "#0A0A0A") + "10" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md font-bold text-white text-sm"
              style={{ backgroundColor: user?.color || "#0A0A0A" }}
            >
              {user?.name?.[0] || "?"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                {user?.role}
              </p>
              <p className="font-bold text-sm truncate" data-testid="current-user">
                {user?.name}
              </p>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="flex w-full items-center justify-center lg:justify-start gap-2 rounded-md border border-[#E5E7EB] px-3 py-2.5 text-sm font-medium text-[#4B5563] hover:bg-[#FAFAFA] active:scale-95 transition-transform"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
