import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import LoginPage from "@/pages/LoginPage";
import TablesPage from "@/pages/TablesPage";
import OrderPage from "@/pages/OrderPage";
import POSPage from "@/pages/POSPage";
import ProductsPage from "@/pages/ProductsPage";
import DashboardPage from "@/pages/DashboardPage";
import HistoryPage from "@/pages/HistoryPage";
import ReportsPage from "@/pages/ReportsPage";
import SessionPage from "@/pages/SessionPage";
import SettingsPage from "@/pages/SettingsPage";
import AppShell from "@/components/AppShell";

const Protected = ({ children }) => {
  const { user, hydrated } = useAuth();
  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
};

function App() {
  return (
    <div className="App">
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Protected><TablesPage /></Protected>} />
              <Route path="/commande/:orderId" element={<Protected><OrderPage /></Protected>} />
              <Route path="/vente-rapide" element={<Protected><POSPage /></Protected>} />
              <Route path="/session" element={<Protected><SessionPage /></Protected>} />
              <Route path="/produits" element={<Protected><ProductsPage /></Protected>} />
              <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
              <Route path="/historique" element={<Protected><HistoryPage /></Protected>} />
              <Route path="/rapports" element={<Protected><ReportsPage /></Protected>} />
              <Route path="/parametres" element={<Protected><SettingsPage /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </SettingsProvider>
    </div>
  );
}

export default App;
