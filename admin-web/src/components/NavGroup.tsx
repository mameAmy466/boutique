import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconChevronDown } from './DashboardIcons';

const STORAGE_KEY = 'boutique-nav-groups';

function loadState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export interface NavGroupItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export function NavGroup({ id, label, icon, items }: { id: string; label: string; icon: ReactNode; items: NavGroupItem[] }) {
  const location = useLocation();
  const containsActive = items.some((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));

  const [expanded, setExpanded] = useState<boolean>(() => {
    const stored = loadState()[id];
    return stored === undefined ? true : stored;
  });

  useEffect(() => {
    if (containsActive && !expanded) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      const state = loadState();
      state[id] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return next;
    });
  }

  return (
    <div className={`nav-group${expanded ? '' : ' collapsed'}`}>
      <button type="button" className="nav-group-header" onClick={toggle} aria-expanded={expanded}>
        {icon}
        <span>{label}</span>
        <IconChevronDown className={`nav-group-chevron${expanded ? ' open' : ''}`} />
      </button>
      <div className="nav-group-children">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.icon} {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
