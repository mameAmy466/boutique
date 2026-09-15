import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedLayout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ShopsPage } from './pages/ShopsPage';
import { UsersPage } from './pages/UsersPage';
import { ProductsPage } from './pages/ProductsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { StocksPage } from './pages/StocksPage';
import { SalesPage } from './pages/SalesPage';
import { AuditPage } from './pages/AuditPage';
import { InventoryPage } from './pages/InventoryPage';
import { AccountPage } from './pages/AccountPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/stocks" element={<StocksPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
