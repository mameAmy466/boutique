export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" className="logo-mark">
      <rect x="0.5" y="0.5" width="27" height="27" rx="8" fill="var(--accent)" />
      <path
        d="M8.5 9.5 9.2 6.8h9.6l0.7 2.7"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 9.5c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2c0 1.1.9 2 2 2s2-.9 2-2"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 11.6V21h9V11.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21v-4.2c0-1 .9-1.8 2-1.8s2 .8 2 1.8V21" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
