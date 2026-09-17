import type { ReactNode } from 'react';
import { SearchBox } from './SearchBox';
import { NotificationsBell } from './NotificationsBell';
import { ProfileMenu } from './ProfileMenu';

export function TopBar({ lead }: { lead?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-lead">{lead}</div>
      <div className="topbar-actions">
        <SearchBox variant="inline" />
        <NotificationsBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
