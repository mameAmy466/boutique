import type { ReactNode } from 'react';
import { SearchBox } from './SearchBox';
import { NotificationsBell } from './NotificationsBell';
import { ProfileMenu } from './ProfileMenu';
import { IconMenu } from './DashboardIcons';

export function TopBar({
  lead,
  onMenuClick,
  menuOpen,
  shopTools = true,
}: {
  lead?: ReactNode;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  /** Product search and stock alerts: only for a shop's own space. */
  shopTools?: boolean;
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
        {shopTools && <SearchBox variant="inline" />}
        {shopTools && <NotificationsBell />}
        <ProfileMenu />
      </div>
    </header>
  );
}
