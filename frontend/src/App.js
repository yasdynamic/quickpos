import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { PrinterProvider } from "@/context/PrinterContext";
import { LicenseProvider, useLicense } from "@/context/LicenseContext";
import LoginPage from "@/pages/LoginPage";
import ActivationPage from "@/pages/ActivationPage";
import CaisseHubPage from "@/pages/CaisseHubPage";
import TablesPage from "@/pages/TablesPage";
import OrderPage from "@/pages/OrderPage";
import POSPage from "@/pages/POSPage";
import ProductsPage from "@/pages/ProductsPage";
import DashboardPage from "@/pages/DashboardPage";
import HistoryPage from "@/pages/HistoryPage";
import ReportsPage from "@/pages/ReportsPage";
import SessionPage from "@/pages/SessionPage";
import SettingsPage from "@/pages/SettingsPage";
import CustomersPage from "@/pages/CustomersPage";
import SuppliersPage from "@/pages/SuppliersPage";
import StockPage from "@/pages/StockPage";
import RefundsPage from "@/pages/RefundsPage";
import InventoryPage from "@/pages/InventoryPage";
import TablePlanPage from "@/pages/TablePlanPage";
import AppShell from "@/components/AppShell";
import SessionGuard from "@/components/SessionGuard";
import LicenseGuard from "@/components/LicenseGuard";

const Protected = ({ children }) => {
  const { user, hydrated } = useAuth();
  const { status } = useLicense();
  if (!hydrated) return null;
  // Gate behind license first so unactivated installs never see Login
  if (status && (status.mode === "unactivated" || status.mode === "invalid")) {
    return <Navigate to="/activation" replace />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <LicenseGuard><AppShell>{children}</AppShell></LicenseGuard>;
};

function App() {
  return (
    <div className="App">
      <SettingsProvider>
        <PrinterProvider>
          <LicenseProvider>
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/activation" element={<ActivationPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/" element={<Protected><CaisseHubPage /></Protected>} />
                  <Route path="/tables" element={<Protected><SessionGuard><TablesPage /></SessionGuard></Protected>} />
                  <Route path="/commande/:orderId" element={<Protected><SessionGuard><OrderPage /></SessionGuard></Protected>} />
                  <Route path="/vente-rapide" element={<Protected><SessionGuard><POSPage /></SessionGuard></Protected>} />
                  <Route path="/session" element={<Protected><SessionPage /></Protected>} />
                  <Route path="/produits" element={<Protected><ProductsPage /></Protected>} />
                  <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
                  <Route path="/historique" element={<Protected><HistoryPage /></Protected>} />
                  <Route path="/rapports" element={<Protected><ReportsPage /></Protected>} />
                  <Route path="/parametres" element={<Protected><SettingsPage /></Protected>} />
                  <Route path="/clients" element={<Protected><CustomersPage /></Protected>} />
                  <Route path="/fournisseurs" element={<Protected><SuppliersPage /></Protected>} />
                  <Route path="/stock" element={<Protected><StockPage /></Protected>} />
                  <Route path="/inventaire" element={<Protected><InventoryPage /></Protected>} />
                  <Route path="/inventaire/:sessionId" element={<Protected><InventoryPage /></Protected>} />
                  <Route path="/retours" element={<Protected><SessionGuard><RefundsPage /></SessionGuard></Protected>} />
                  <Route path="/plan-de-salle" element={<Protected><TablePlanPage /></Protected>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
              <Toaster position="top-right" richColors />
            </AuthProvider>
          </LicenseProvider>
        </PrinterProvider>
      </SettingsProvider>
    </div>
  );
}

export default App;
