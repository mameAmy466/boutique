export function formatMoney(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const api = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
  const origin = String(api).replace(/\/api\/?$/, '');
  return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`;
}
