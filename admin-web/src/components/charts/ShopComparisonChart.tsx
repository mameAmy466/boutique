import type { ShopComparisonRow } from '../../api/types';
import { formatMoney } from '../../lib/format';

const WIDTH = 640;
const HEIGHT = 240;
const PAD_LEFT = 54;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 40;

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

export function ShopComparisonChart({ data }: { data: ShopComparisonRow[] }) {
  if (data.length === 0) {
    return <p className="hint">Aucune boutique active pour le moment.</p>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(...data.map((d) => Math.max(d.revenue, d.profit)), 1);
  const groupW = plotW / data.length;
  const barW = Math.min(28, groupW / 3.2);
  const gridLines = [0, 0.5, 1];

  return (
    <div>
      <div className="chart-legend">
        <span>
          <i style={{ background: 'var(--chart-blue)' }} /> Chiffre d'affaires (mois en cours)
        </span>
        <span>
          <i style={{ background: 'var(--chart-aqua)' }} /> Bénéfice brut
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Comparaison des boutiques">
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

        {data.map((shop, i) => {
          const cx = PAD_LEFT + groupW * i + groupW / 2;
          const revH = (shop.revenue / max) * plotH;
          const profH = (shop.profit / max) * plotH;
          const baseY = PAD_TOP + plotH;
          return (
            <g key={shop.shop_id}>
              <rect x={cx - barW - 2} y={baseY - revH} width={barW} height={revH} fill="var(--chart-blue)" rx={2}>
                <title>
                  {shop.name} — CA : {formatMoney(shop.revenue)}
                </title>
              </rect>
              <rect x={cx + 2} y={baseY - profH} width={barW} height={profH} fill="var(--chart-aqua)" rx={2}>
                <title>
                  {shop.name} — Bénéfice : {formatMoney(shop.profit)}
                </title>
              </rect>
              <text x={cx} y={HEIGHT - 16} textAnchor="middle" fontSize="11" fill="var(--ink)">
                {shop.name.length > 14 ? `${shop.name.slice(0, 13)}…` : shop.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
