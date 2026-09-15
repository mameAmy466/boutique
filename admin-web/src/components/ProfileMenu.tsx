import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { IconChevronDown, IconMoon, IconSettings, IconSun } from './DashboardIcons';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="dropdown-wrap" ref={ref}>
      <button type="button" className="profile-chip" onClick={() => setOpen((o) => !o)}>
        <span className="avatar-circle">{initials(user.name)}</span>
        <span className="profile-chip-text">
          <span className="profile-chip-name">{user.name}</span>
          <span className="profile-chip-role">{ROLE_LABELS[user.role?.slug ?? ''] ?? user.role?.name}</span>
        </span>
        <IconChevronDown />
      </button>
      {open && (
        <div className="dropdown-menu profile-dropdown">
          <button type="button" className="dropdown-item" onClick={toggleTheme}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            {theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          </button>
          <Link to="/account" className="dropdown-item" onClick={() => setOpen(false)}>
            <IconSettings />
            Mon compte
          </Link>
          <div className="dropdown-sep" />
          <button type="button" className="dropdown-item danger" onClick={() => logout()}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
