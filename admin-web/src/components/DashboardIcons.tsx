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
