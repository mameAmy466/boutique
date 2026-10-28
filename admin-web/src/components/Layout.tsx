import { useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ACCESS_DENIED_EVENT, FEATURE_DENIED_EVENT } from '../api/client';
import type { AccessDenial, MySubscription } from '../api/types';
import { Logo } from './Logo';
import { AccessBlocked } from './AccessBlocked';
import { SubscriptionNotice } from './SubscriptionNotice';
import { FeatureLocked } from './FeatureLocked';
import { SubscriptionContext, makeCan } from '../context/SubscriptionContext';
import { featureForPath } from '../lib/features';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [denial, setDenial] = useState<AccessDenial | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function loadPendingRequests() {
    if (!user?.is_platform_admin) return;
    api
      .get<{ registrations: { pending: number } }>('/platform/dashboard')
      .then((d) => setPendingRequests(d.registrations.pending))
      .catch(() => setPendingRequests(0));
  }

  function loadSubscription() {
    api
      .get<MySubscription>('/subscription')
      .then((data) => {
        setSubscription(data);
        setDenial(data.is_platform_admin ? null : data.access);
      })
      .catch(() => setSubscription(null))
      .finally(() => setSubscriptionLoaded(true));
  }

  useEffect(() => {
    if (user) loadSubscription();
    loadPendingRequests();
  }, [user?.id]);

  // New signups show up in the menu without reloading the page.
  useEffect(() => {
    loadPendingRequests();
  }, [location.pathname]);

  // Rights change when the client renews or switches plan, or when the
  // Super Admin edits a formula: pick that up whenever the tab comes back.
  useEffect(() => {
    const onFocus = () => {
      if (user) loadSubscription();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener(FEATURE_DENIED_EVENT, onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(FEATURE_DENIED_EVENT, onFocus);
    };
  }, [user?.id]);

  useEffect(() => {
    const onDenied = (event: Event) => {
      const detail = (event as CustomEvent<AccessDenial | null>).detail;
      if (detail?.code) setDenial(detail);
    };
    window.addEventListener(ACCESS_DENIED_EVENT, onDenied);
    return () => window.removeEventListener(ACCESS_DENIED_EVENT, onDenied);
  }, []);

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
  const isPlatformAdmin = Boolean(user.is_platform_admin);
  const can = makeCan(subscription, subscriptionLoaded);
  const allowed = (item: NavGroupItem) => {
    const feature = featureForPath(item.to);
    return !feature || can(feature);
  };
  const lockedFeature = featureForPath(location.pathname);
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
    ...(isSuperAdmin && !isPlatformAdmin ? [{ to: '/abonnement', label: 'Mon abonnement', icon: <IconCoin /> }] : []),
  ];

  const platformItems: NavGroupItem[] = [
    { to: '/plateforme', label: 'Vue d’ensemble', icon: <IconGrid />, end: true },
    { to: '/plateforme/demandes', label: 'Inscriptions', icon: <IconSend />, badge: pendingRequests },
    { to: '/plateforme/clients', label: 'Clients', icon: <IconShop /> },
    { to: '/plateforme/formules', label: 'Formules', icon: <IconTag /> },
    { to: '/plateforme/paiements', label: 'Paiements', icon: <IconCoin /> },
    { to: '/plateforme/historique', label: 'Historique', icon: <IconAudit /> },
  ];

  const accountingItems: NavGroupItem[] = ([
    { to: '/expenses', label: 'Dépenses', icon: <IconReceipt /> },
    { to: '/cashflow', label: 'Trésorerie', icon: <IconBank /> },
    { to: '/supplier-debts', label: 'Dettes fournisseurs', icon: <IconTruck /> },
    { to: '/client-debts', label: 'Créances clients', icon: <IconBag /> },
    { to: '/journal-entries', label: 'Écritures', icon: <IconAudit /> },
    { to: '/grand-livre', label: 'Grand livre', icon: <IconCoin /> },
    { to: '/balance-comptable', label: 'Balance comptable', icon: <IconTrend /> },
    { to: '/compte-de-resultat', label: 'Compte de résultat', icon: <IconTrend /> },
    { to: '/bilan', label: 'Bilan', icon: <IconClipboard /> },
    { to: '/rapprochement-bancaire', label: 'Rapprochement bancaire', icon: <IconBank /> },
    ...(isSuperAdmin
      ? [
          { to: '/chart-of-accounts', label: 'Plan comptable', icon: <IconClipboard /> },
          { to: '/accounting-rules', label: 'Règles comptables', icon: <IconSettings /> },
          { to: '/controle-comptable', label: 'Contrôle comptable', icon: <IconAudit /> },
        ]
      : []),
  ] as NavGroupItem[]).filter(allowed);

  const partnerItems: NavGroupItem[] = [
    { to: '/suppliers', label: 'Fournisseurs', icon: <IconTruck /> },
    { to: '/employees', label: 'Employés', icon: <IconUsers /> },
  ].filter(allowed);

  const purchasingItems: NavGroupItem[] = [
    { to: '/purchase-orders', label: 'Bons de commande', icon: <IconSend /> },
  ].filter(allowed);

  return (
    <SubscriptionContext.Provider value={{ data: subscription, can, refresh: loadSubscription }}>
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

        <nav className="sidebar-nav">
          {isPlatformAdmin && (
            <NavGroup id="platform" label="Super Admin" icon={<IconSettings />} items={platformItems} />
          )}

          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <IconGrid />
            <span>Tableau de bord</span>
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

          <NavGroup id="partners" label="Tiers" icon={<IconTruck />} items={partnerItems} />

          {isAdmin && purchasingItems.length > 0 && (
            <NavGroup id="purchasing" label="Achats" icon={<IconSend />} items={purchasingItems} />
          )}

          {isAdmin && accountingItems.length > 0 && (
            <NavGroup id="accounting" label="Comptabilité" icon={<IconBank />} items={accountingItems} />
          )}

          <NavGroup id="admin" label="Administration" icon={<IconSettings />} items={adminItems} />
        </nav>

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
          {denial && location.pathname !== '/abonnement' ? (
            <AccessBlocked
              denial={denial}
              onRetry={() => {
                setDenial(null);
                loadSubscription();
              }}
            />
          ) : lockedFeature && subscriptionLoaded && !can(lockedFeature) ? (
            <FeatureLocked feature={lockedFeature} data={subscription} />
          ) : lockedFeature && !subscriptionLoaded ? (
            <div className="spinner-line">Chargement…</div>
          ) : (
            <>
              <SubscriptionNotice data={subscription} />
              <Outlet />
            </>
          )}
        </div>
      </div>
    </div>
    </SubscriptionContext.Provider>
  );
}
