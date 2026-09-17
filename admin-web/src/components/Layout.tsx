import { NavLink, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { TopBar } from './TopBar';
import { NavGroup, type NavGroupItem } from './NavGroup';
import {
  IconAudit,
  IconBox,
  IconCashDrawer,
  IconClipboard,
  IconGrid,
  IconRegister,
  IconSettings,
  IconShop,
  IconTag,
  IconTruck,
  IconUsers,
} from './DashboardIcons';

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  if (loading) {
    return <div className="spinner-line" style={{ padding: 40 }}>Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role?.slug === 'super_admin' || user.role?.slug === 'admin_boutique';
  const isSuperAdmin = user.role?.slug === 'super_admin';
  const firstName = user.name.trim().split(/\s+/)[0] ?? '';

  const stockProduits: NavGroupItem[] = [
    { to: '/products', label: 'Produits', icon: <IconTag /> },
    { to: '/stocks', label: 'Stock', icon: <IconBox /> },
  ];

  const adminItems: NavGroupItem[] = [
    { to: '/shops', label: 'Boutiques', icon: <IconShop /> },
    ...(isAdmin ? [{ to: '/users', label: 'Utilisateurs', icon: <IconUsers /> }] : []),
    ...(isAdmin ? [{ to: '/audit', label: 'Audit', icon: <IconAudit /> }] : []),
    ...(isSuperAdmin ? [{ to: '/inventory', label: 'Inventaire', icon: <IconClipboard /> }] : []),
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          Boutique
        </div>

        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <IconGrid /> Tableau de bord
        </NavLink>

        <NavGroup
          id="sales"
          label="Ventes & Caisses"
          icon={<IconRegister />}
          items={[
            { to: '/sales', label: 'Ventes', icon: <IconRegister /> },
            { to: '/cash-sessions', label: 'Caisses', icon: <IconCashDrawer /> },
          ]}
        />

        <NavGroup id="stock" label="Stocks & Produits" icon={<IconBox />} items={stockProduits} />

        <NavGroup
          id="partners"
          label="Tiers"
          icon={<IconTruck />}
          items={[{ to: '/suppliers', label: 'Fournisseurs', icon: <IconTruck /> }]}
        />

        <NavGroup id="admin" label="Administration" icon={<IconSettings />} items={adminItems} />

        <div className="dash-sidebar-promo">
          <p>Gérez votre stock en temps réel</p>
          <Link to="/stocks" className="dash-sidebar-promo-btn">
            Accéder
          </Link>
        </div>
      </aside>

      <div className="main-col">
        <TopBar
          lead={
            isDashboard ? (
              <div>
                <p className="dash-hello">Bonjour {firstName},</p>
                <h1>Bienvenue sur Boutique</h1>
              </div>
            ) : (
              <p className="topbar-context">{user.shop?.name ?? 'Boutique'}</p>
            )
          }
        />
        <div className="main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
