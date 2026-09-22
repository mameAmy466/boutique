import { useEffect, useState } from 'react';
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
  IconClose,
  IconGrid,
  IconReceipt,
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = () => {
      if (!mq.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
    ...(isSuperAdmin
      ? [
          { to: '/chart-of-accounts', label: 'Plan comptable', icon: <IconClipboard /> },
          { to: '/accounting-rules', label: 'Règles comptables', icon: <IconSettings /> },
        ]
      : []),
  ];

  return (
    <div className={`app-shell${menuOpen ? ' nav-open' : ''}`}>
      <div className="nav-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className="sidebar" id="app-nav">
        <div className="brand">
          <Logo />
          Boutique
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
          >
            <IconClose />
          </button>
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
          onMenuClick={() => setMenuOpen(true)}
          menuOpen={menuOpen}
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
