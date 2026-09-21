import type { CashflowBucket, CashflowGroupBy } from '../../api/types';
import { formatMoney } from '../../lib/format';

const WIDTH = 720;
const HEIGHT = 260;
const PAD_LEFT = 54;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;
const BAR_MAX_WIDTH = 20;
const BAR_GAP = 2;

function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

function periodLabel(period: string, groupBy: CashflowGroupBy): string {
  const date = new Date(`${period}T00:00:00`);
  if (groupBy === 'year') return date.getFullYear().toString();
  if (groupBy === 'month') return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function CashflowChart({ data, groupBy }: { data: CashflowBucket[]; groupBy: CashflowGroupBy }) {
  if (data.length === 0) {
    return <p className="hint">Aucune donnée sur la période.</p>;
  }

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(...data.map((d) => Math.max(d.entrees, d.sorties)), 1);
  const groupW = plotW / data.length;
  const barW = Math.min(BAR_MAX_WIDTH, (groupW - BAR_GAP * 3) / 2);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div>
      <div className="chart-legend">
        <span>
          <i style={{ background: 'var(--chart-blue)' }} /> Entrées (ventes)
        </span>
        <span>
          <i style={{ background: 'var(--chart-orange)' }} /> Sorties (dépenses)
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Entrées et sorties par période">
      {gridLines.map((t) => {
        const y = PAD_TOP + plotH * (1 - t);
        return (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" fontSize="10.5" fill="var(--ink-soft)">
              {compactMoney(max * t)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const groupX = PAD_LEFT + i * groupW + (groupW - (barW * 2 + BAR_GAP)) / 2;
        const entreesH = (d.entrees / max) * plotH;
        const sortiesH = (d.sorties / max) * plotH;
        const baseline = PAD_TOP + plotH;

        return (
          <g key={d.period}>
            <rect
              x={groupX}
              y={baseline - entreesH}
              width={barW}
              height={entreesH}
              rx={4}
              fill="var(--chart-blue)"
            >
              <title>
                Entrées {periodLabel(d.period, groupBy)} : {formatMoney(d.entrees)}
              </title>
            </rect>
            <rect
              x={groupX + barW + BAR_GAP}
              y={baseline - sortiesH}
              width={barW}
              height={sortiesH}
              rx={4}
              fill="var(--chart-orange)"
            >
              <title>
                Sorties {periodLabel(d.period, groupBy)} : {formatMoney(d.sorties)}
              </title>
            </rect>
            {i % labelEvery === 0 && (
              <text
                x={groupX + barW + BAR_GAP / 2}
                y={HEIGHT - 10}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--ink-soft)"
              >
                {periodLabel(d.period, groupBy)}
              </text>
            )}
          </g>
        );
      })}
      </svg>
    </div>
  );
}
