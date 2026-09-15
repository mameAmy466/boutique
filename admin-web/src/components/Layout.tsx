import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';
import {
  IconBox,
  IconGrid,
  IconMoon,
  IconRegister,
  IconShop,
  IconSun,
  IconTag,
  IconTruck,
  IconUsers,
} from './DashboardIcons';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

export function ProtectedLayout() {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="name">{user.name}</span>
            <span className="role">{ROLE_LABELS[user.role?.slug ?? ''] ?? user.role?.name}</span>
          </div>
          <div className="sidebar-footer-actions">
            <button
              className="btn btn-ghost btn-sm theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
              aria-label="Changer de thème"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <button className="btn btn-ghost btn-sm logout-btn" onClick={() => logout()}>
              Se déconnecter
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
