import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Package,
  BarChart3,
  History,
  Mail,
  LogOut,
  Zap,
  Banknote,
  Zap as Bolt,
  Settings as Cog,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Plan de salle", icon: LayoutGrid, testid: "nav-tables" },
  { to: "/vente-rapide", label: "Vente directe", icon: Bolt, testid: "nav-pos" },
  { to: "/session", label: "Caisse", icon: Banknote, testid: "nav-session" },
  { to: "/produits", label: "Produits", icon: Package, testid: "nav-products" },
  { to: "/clients", label: "Clients", icon: Users, testid: "nav-customers" },
  { to: "/dashboard", label: "Tableau de bord", icon: BarChart3, testid: "nav-dashboard" },
  { to: "/historique", label: "Historique", icon: History, testid: "nav-history" },
  { to: "/rapports", label: "Rapports", icon: Mail, testid: "nav-reports" },
  { to: "/parametres", label: "Paramètres", icon: Cog, testid: "nav-settings" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA]">
      <aside className="flex w-20 lg:w-64 shrink-0 flex-col border-r border-[#E5E7EB] bg-white">
        <div className="flex h-16 items-center gap-2 px-4 lg:px-6 border-b border-[#E5E7EB]">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <Zap className="h-5 w-5" />
          </div>
          <span className="hidden lg:block font-bold text-lg tracking-tight">QuickPOS</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-2 lg:p-3 overflow-y-auto">
          {NAV.map((item) => (
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
