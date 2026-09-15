import { Link } from 'react-router-dom';
import { SearchBox } from './SearchBox';
import { NotificationsBell } from './NotificationsBell';
import { ProfileMenu } from './ProfileMenu';
import { IconSettings } from './DashboardIcons';

export function TopBar() {
  return (
    <div className="topbar">
      <div className="topbar-actions">
        <SearchBox />
        <NotificationsBell />
        <Link to="/account" className="icon-btn" aria-label="Paramètres du compte" title="Paramètres du compte">
          <IconSettings />
        </Link>
        <ProfileMenu />
      </div>
    </div>
  );
}
