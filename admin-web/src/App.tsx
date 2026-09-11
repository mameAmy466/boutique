import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedLayout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ShopsPage } from './pages/ShopsPage';
import { ProductsPage } from './pages/ProductsPage';
import { StocksPage } from './pages/StocksPage';
import { SalesPage } from './pages/SalesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/stocks" element={<StocksPage />} />
            <Route path="/sales" element={<SalesPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
