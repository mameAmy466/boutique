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

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function SalesTrendChart({
  data,
  variant = 'default',
}: {
  data: SalesTrendPoint[];
  variant?: 'default' | 'wave';
}) {
  if (data.length === 0) {
    return <p className="hint">Aucune vente sur la période.</p>;
  }

  const isWave = variant === 'wave';
  const padLeft = isWave ? 8 : PAD_LEFT;
  const padRight = isWave ? 8 : PAD_RIGHT;
  const padTop = isWave ? 18 : PAD_TOP;
  const padBottom = isWave ? 36 : PAD_BOTTOM;
  const plotW = WIDTH - padLeft - padRight;
  const plotH = HEIGHT - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.total), 1);

  const points = data.map((d, i) => {
    const x = padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padTop + plotH * (1 - d.total / max);
    return { x, y, ...d };
  });

  const linePath = isWave
    ? smoothPath(points)
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`;

  const highlightIndex = points.reduce((best, p, i) => (p.total >= points[best].total ? i : best), 0);
  const highlight = points[highlightIndex];
  const labelEvery = Math.ceil(data.length / 6);
  const gridLines = [0, 0.5, 1];

  if (isWave) {
    const highlightLabel = new Date(highlight.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Évolution des ventes">
        <defs>
          <linearGradient id="dashWaveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dash-chart)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--dash-chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#dashWaveFill)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--dash-chart)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        <line
          x1={highlight.x}
          x2={highlight.x}
          y1={highlight.y + 8}
          y2={HEIGHT - 28}
          stroke="var(--dash-chart)"
          strokeWidth={1.5}
          strokeDasharray="3 5"
          opacity={0.45}
        />
        <circle cx={highlight.x} cy={highlight.y} r={11} fill="var(--dash-chart)" opacity={0.12} />
        <circle cx={highlight.x} cy={highlight.y} r={5.5} fill="#fff" stroke="var(--dash-chart)" strokeWidth={2.4} />
        <title>
          {new Date(highlight.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} :{' '}
          {formatMoney(highlight.total)}
        </title>
        {points.map((p, i) =>
          i % labelEvery === 0 && i !== highlightIndex ? (
            <text
              key={p.date}
              x={p.x}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--dash-muted, var(--ink-soft))"
              fontWeight={500}
            >
              {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </text>
          ) : null,
        )}
        <rect x={Math.min(WIDTH - 46, Math.max(2, highlight.x - 22))} y={HEIGHT - 26} width="44" height="18" rx="9" fill="var(--dash-chart)" />
        <text
          x={Math.min(WIDTH - 24, Math.max(24, highlight.x))}
          y={HEIGHT - 13.5}
          textAnchor="middle"
          fontSize="10"
          fill="#fff"
          fontWeight={700}
        >
          {highlightLabel}
        </text>
      </svg>
    );
  }

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

      <path d={areaPath} fill="var(--dash-chart)" opacity={0.12} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--dash-chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--dash-chart)" />
          <title>
            {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} : {formatMoney(p.total)}
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
