import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

export function ProtectedLayout() {
  const { user, loading, logout } = useAuth();

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
          <span className="dot" />
          Boutique Admin
        </div>

        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Tableau de bord
        </NavLink>
        <NavLink to="/shops" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Boutiques
        </NavLink>
        {(user.role?.slug === 'super_admin' || user.role?.slug === 'admin_boutique') && (
          <NavLink to="/users" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Utilisateurs
          </NavLink>
        )}
        <NavLink to="/products" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Produits
        </NavLink>
        <NavLink to="/stocks" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Stock
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Ventes
        </NavLink>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="name">{user.name}</span>
            <span className="role">{ROLE_LABELS[user.role?.slug ?? ''] ?? user.role?.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => logout()} style={{ width: '100%' }}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
