import type { ReactNode } from 'react';
import { SearchBox } from './SearchBox';
import { NotificationsBell } from './NotificationsBell';
import { ProfileMenu } from './ProfileMenu';
import { IconMenu } from './DashboardIcons';

export function TopBar({
  lead,
  onMenuClick,
  menuOpen,
}: {
  lead?: ReactNode;
  onMenuClick?: () => void;
  menuOpen?: boolean;
}) {
  return (
    <header className="topbar">
      {onMenuClick && (
        <button
          type="button"
          className="icon-btn menu-toggle"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-controls="app-nav"
        >
          <IconMenu />
        </button>
      )}
      <div className="topbar-lead">{lead}</div>
      <div className="topbar-actions">
        <SearchBox variant="inline" />
        <NotificationsBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
