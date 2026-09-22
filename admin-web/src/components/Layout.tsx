import { NavLink, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { TopBar } from './TopBar';
import { NavGroup, type NavGroupItem } from './NavGroup';
import {
  IconAlert,
  IconAudit,
  IconBag,
  IconBank,
  IconBox,
  IconCashDrawer,
  IconClipboard,
  IconCoin,
  IconGrid,
  IconReceipt,
  IconRegister,
  IconSend,
  IconSettings,
  IconShop,
  IconTag,
  IconTrend,
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
    ...(isAdmin ? [{ to: '/cash-discrepancies', label: 'Écarts de caisse', icon: <IconAlert /> }] : []),
    ...(isSuperAdmin ? [{ to: '/inventory', label: 'Inventaire', icon: <IconClipboard /> }] : []),
  ];

  const accountingItems: NavGroupItem[] = [
    { to: '/expenses', label: 'Dépenses', icon: <IconReceipt /> },
    { to: '/cashflow', label: 'Trésorerie', icon: <IconBank /> },
    { to: '/supplier-debts', label: 'Dettes fournisseurs', icon: <IconTruck /> },
    { to: '/client-debts', label: 'Créances clients', icon: <IconBag /> },
    { to: '/journal-entries', label: 'Écritures', icon: <IconAudit /> },
    { to: '/grand-livre', label: 'Grand livre', icon: <IconCoin /> },
    { to: '/balance-comptable', label: 'Balance comptable', icon: <IconTrend /> },
    ...(isSuperAdmin
      ? [
          { to: '/chart-of-accounts', label: 'Plan comptable', icon: <IconClipboard /> },
          { to: '/accounting-rules', label: 'Règles comptables', icon: <IconSettings /> },
        ]
      : []),
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

        {isAdmin && (
          <NavGroup
            id="purchasing"
            label="Achats"
            icon={<IconSend />}
            items={[{ to: '/purchase-orders', label: 'Bons de commande', icon: <IconSend /> }]}
          />
        )}

        {isAdmin && <NavGroup id="accounting" label="Comptabilité" icon={<IconBank />} items={accountingItems} />}

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
