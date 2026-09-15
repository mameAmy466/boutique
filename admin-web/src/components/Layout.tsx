import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { TopBar } from './TopBar';
import {
  IconAudit,
  IconBox,
  IconClipboard,
  IconGrid,
  IconRegister,
  IconShop,
  IconTag,
  IconTruck,
  IconUsers,
} from './DashboardIcons';

export function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="spinner-line" style={{ padding: 40 }}>Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          Boutique Admin
        </div>

        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconGrid /> Tableau de bord
        </NavLink>
        <NavLink to="/shops" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconShop /> Boutiques
        </NavLink>
        {(user.role?.slug === 'super_admin' || user.role?.slug === 'admin_boutique') && (
          <NavLink to="/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconUsers /> Utilisateurs
          </NavLink>
        )}
        <NavLink to="/products" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconTag /> Produits
        </NavLink>
        <NavLink to="/suppliers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconTruck /> Fournisseurs
        </NavLink>
        <NavLink to="/stocks" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconBox /> Stock
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconRegister /> Ventes
        </NavLink>
        {(user.role?.slug === 'super_admin' || user.role?.slug === 'admin_boutique') && (
          <NavLink to="/audit" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconAudit /> Audit
          </NavLink>
        )}
        {user.role?.slug === 'super_admin' && (
          <NavLink to="/inventory" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconClipboard /> Inventaire
          </NavLink>
        )}
      </aside>

      <div className="main-col">
        <TopBar />
        <div className="main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
