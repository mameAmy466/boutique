import type { SVGProps } from 'react';

function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: '0 0 20 20',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export function IconCoin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v7M12.2 8.1c-.3-.6-1-1-2-1-1.2 0-2 .6-2 1.4 0 2 4.3 1 4.3 2.9 0 .8-.9 1.5-2.1 1.5-1 0-1.8-.4-2.1-1" />
    </svg>
  );
}

export function IconTrend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 13.5 8 8l3 3 6-6.5" />
      <path d="M13.5 4h3.5v3.5" />
    </svg>
  );
}

export function IconBox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" />
      <path d="M3 6.5v7L10 17l7-3.5v-7" />
      <path d="M10 10v7" />
    </svg>
  );
}

export function IconAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.2 17.5 16H2.5L10 3.2Z" />
      <path d="M10 8.3v3.4" />
      <circle cx="10" cy="13.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRegister(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="8" width="14" height="8.5" rx="1.2" />
      <path d="M5.5 8V5.8A2.3 2.3 0 0 1 7.8 3.5h4.4a2.3 2.3 0 0 1 2.3 2.3V8" />
      <path d="M7 12h6" />
    </svg>
  );
}

export function IconShop(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 7.5 4 3.5h12l1 4" />
      <path d="M3 7.5c0 1.4 1.1 2.5 2.4 2.5S7.8 8.9 7.8 7.5c0 1.4 1.2 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.4 2.5S17.5 8.9 17.5 7.5" />
      <path d="M4.5 10v6.5h11V10" />
    </svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="7.3" cy="7" r="2.6" />
      <path d="M2.5 16c.4-2.7 2.3-4.3 4.8-4.3s4.4 1.6 4.8 4.3" />
      <circle cx="14" cy="6.3" r="2" />
      <path d="M12.8 11.9c1.9.2 3.3 1.7 3.7 4.1" />
    </svg>
  );
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10.8 3H16v5.2L8.6 15.6a1.4 1.4 0 0 1-2 0L3.4 12.4a1.4 1.4 0 0 1 0-2L10.8 3Z" />
      <circle cx="13.2" cy="5.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.7v2M10 15.3v2M17.3 10h-2M4.7 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8" />
    </svg>
  );
}

export function IconTruck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 6.5h9v7h-9z" />
      <path d="M11.5 9.5h3l2.5 2.5v1.5h-5.5z" />
      <circle cx="6" cy="15" r="1.4" />
      <circle cx="14" cy="15" r="1.4" />
    </svg>
  );
}

export function IconAudit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="8.5" cy="8.5" r="5.2" />
      <path d="M12.4 12.4 17 17" />
    </svg>
  );
}

export function IconClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3.5" width="12" height="14" rx="1.6" />
      <path d="M7.5 3.5V3a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 3v.5" />
      <path d="M7 9h6M7 12h6M7 15h3.5" />
    </svg>
  );
}

export function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="6" height="6" rx="1.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.4" />
      <rect x="3" y="11" width="6" height="6" rx="1.4" />
      <rect x="11" y="11" width="6" height="6" rx="1.4" />
    </svg>
  );
}

export function IconCashDrawer(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="5" width="15" height="10.5" rx="1.4" />
      <path d="M2.5 10.2h4.2l1 1.6h4.6l1-1.6h4.2" />
      <circle cx="10" cy="8.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="8.7" cy="8.7" r="5.2" />
      <path d="M12.6 12.6 17 17" />
    </svg>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 8.5a5 5 0 0 1 10 0c0 3.5 1.2 4.5 1.5 5.5H3.5C3.8 13 5 12 5 8.5Z" />
      <path d="M8.3 16.5a1.8 1.8 0 0 0 3.4 0" />
    </svg>
  );
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2.1M10 15.1v2.1M17.2 10h-2.1M4.9 10H2.8M14.9 5.1l-1.5 1.5M6.6 13.4l-1.5 1.5M14.9 14.9l-1.5-1.5M6.6 6.6 5.1 5.1" />
    </svg>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M16.5 12.3A6.8 6.8 0 1 1 7.7 3.5a5.6 5.6 0 0 0 8.8 8.8Z" />
    </svg>
  );
}

export function IconCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="M2.5 8.2h15" />
      <path d="M6 13h3" />
    </svg>
  );
}

export function IconBank(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 8.2 10 3.8 17 8.2" />
      <path d="M5 8.5v6.2M8.5 8.5v6.2M11.5 8.5v6.2M15 8.5v6.2" />
      <path d="M3.5 14.7h13" />
    </svg>
  );
}

export function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 16.2V5.2" />
      <path d="M6.2 8.8 10 5.2l3.8 3.6" />
    </svg>
  );
}

export function IconBag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4.2 7.2h11.6l-.8 8.3a1.8 1.8 0 0 1-1.8 1.6H6.8a1.8 1.8 0 0 1-1.8-1.6L4.2 7.2Z" />
      <path d="M7.2 7.2V5.8A2.8 2.8 0 0 1 10 3a2.8 2.8 0 0 1 2.8 2.8v1.4" />
    </svg>
  );
}

export function IconSpark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.2 11.2 7.6 15.5 8.8 11.2 10 10 14.4 8.8 10 4.5 8.8 8.8 7.6 10 3.2Z" />
    </svg>
  );
}

export function IconBarcode(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 4.5v11M6.2 4.5v11M8 4.5v11M11.5 4.5v11M13.2 4.5v11M16.5 4.5v11" />
    </svg>
  );
}

export function IconReceipt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 3.5h10v13.2l-1.6-1-1.7 1-1.7-1-1.7 1-1.7-1-1.6 1V3.5Z" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
    </svg>
  );
}

export function IconPencil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M11.8 4.2 15.8 8.2 8 16H4v-4l7.8-7.8Z" />
      <path d="M10.2 5.8 14.2 9.8" />
    </svg>
  );
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 6.5h11" />
      <path d="M8 6.5V4.5h4v2" />
      <path d="M6.2 6.5 7 16h6l.8-9.5" />
    </svg>
  );
}

export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 7.2h3l1.2-2h4.6l1.2 2h3v10.3H3.5V7.2Z" />
      <circle cx="10" cy="12.2" r="2.6" />
    </svg>
  );
}
