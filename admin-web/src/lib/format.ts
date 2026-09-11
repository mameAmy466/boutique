export function formatMoney(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
