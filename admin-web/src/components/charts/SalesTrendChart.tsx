import type { SalesTrendPoint } from '../../api/types';
import { formatMoney } from '../../lib/format';

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 54;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

export function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(...data.map((d) => d.total), 1);

  const points = data.map((d, i) => {
    const x = PAD_LEFT + (data.length === 1 ? 0 : (i / (data.length - 1)) * plotW);
    const y = PAD_TOP + plotH * (1 - d.total / max);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_TOP + plotH} L ${points[0].x} ${PAD_TOP + plotH} Z`;

  const gridLines = [0, 0.5, 1];
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Évolution des ventes sur 14 jours">
      {gridLines.map((t) => {
        const y = PAD_TOP + plotH * t;
        return (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" fontSize="10.5" fill="var(--ink-soft)">
              {compactMoney(max * (1 - t))}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="var(--accent)" opacity={0.12} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
          <title>
            {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} :{' '}
            {formatMoney(p.total)}
          </title>
          {i % labelEvery === 0 && (
            <text x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize="10.5" fill="var(--ink-soft)">
              {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
