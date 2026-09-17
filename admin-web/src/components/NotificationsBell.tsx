import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Product, ProductBatch } from '../api/types';
import { IconBell } from './DashboardIcons';

interface LowStockAlert {
  product: Product;
  available: number;
}

function computeAlerts(batches: ProductBatch[]): LowStockAlert[] {
  const byProduct = new Map<number, LowStockAlert>();
  for (const b of batches) {
    if (!b.product) continue;
    const entry = byProduct.get(b.product_id) ?? { product: b.product, available: 0 };
    entry.available += b.quantity_available;
    byProduct.set(b.product_id, entry);
  }
  return [...byProduct.values()]
    .filter((a) => a.available <= a.product.min_stock)
    .sort((a, b) => a.available - b.available);
}

export function NotificationsBell() {
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<ProductBatch[]>('/stocks')
      .then((batches) => setAlerts(computeAlerts(batches)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="dropdown-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
      >
        <IconBell />
        {alerts.length > 0 && <span className="notif-badge">{alerts.length > 9 ? '9+' : alerts.length}</span>}
      </button>
      {open && (
        <div className="dropdown-menu notif-dropdown">
          <div className="dropdown-title">Alertes stock</div>
          {alerts.length === 0 && <p className="hint" style={{ padding: '4px 14px 12px' }}>Aucune alerte pour le moment.</p>}
          {alerts.slice(0, 8).map((a) => (
            <Link key={a.product.id} to="/stocks" className="notif-row" onClick={() => setOpen(false)}>
              <span className={`badge ${a.available === 0 ? 'bad' : 'warn'}`}>{a.available === 0 ? 'Rupture' : 'Faible'}</span>
              <span className="notif-desc">{a.product.name}</span>
              <span className="notif-qty">{a.available} / min. {a.product.min_stock}</span>
            </Link>
          ))}
          {alerts.length > 0 && (
            <Link to="/stocks" className="dropdown-footer-link" onClick={() => setOpen(false)}>
              Voir le stock →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
