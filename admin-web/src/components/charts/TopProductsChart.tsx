import type { TopProduct } from '../../api/types';
import { formatMoney } from '../../lib/format';

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  if (data.length === 0) {
    return <p className="hint">Aucune vente enregistrée pour le moment.</p>;
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="bar-list" role="img" aria-label="Top produits par chiffre d'affaires">
      {data.map((p) => {
        const pct = Math.max((p.revenue / max) * 100, 2);
        return (
          <div className="bar-row" key={p.product_id}>
            <div className="bar-label" title={p.name}>
              {p.name}
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="bar-value num">{formatMoney(p.revenue)}</div>
          </div>
        );
      })}
    </div>
  );
}
