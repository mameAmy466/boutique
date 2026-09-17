import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { CashSession, Product, ProductBatch } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { IconBell } from './DashboardIcons';
import { CASH_DISCREPANCY_THRESHOLD, LONG_OPEN_SESSION_HOURS } from '../lib/cashAlerts';
import { formatMoney } from '../lib/format';

interface AlertItem {
  id: string;
  tone: 'bad' | 'warn';
  badge: string;
  desc: string;
  meta: string;
  to: string;
}

function computeLowStockAlerts(batches: ProductBatch[]): AlertItem[] {
  const byProduct = new Map<number, { product: Product; available: number }>();
  for (const b of batches) {
    if (!b.product) continue;
    const entry = byProduct.get(b.product_id) ?? { product: b.product, available: 0 };
    entry.available += b.quantity_available;
    byProduct.set(b.product_id, entry);
  }
  return [...byProduct.values()]
    .filter((a) => a.available <= a.product.min_stock)
    .sort((a, b) => a.available - b.available)
    .map((a) => ({
      id: `stock-${a.product.id}`,
      tone: a.available === 0 ? 'bad' : 'warn',
      badge: a.available === 0 ? 'Rupture' : 'Faible',
      desc: a.product.name,
      meta: `${a.available} / min. ${a.product.min_stock}`,
      to: '/stocks',
    }));
}

function computeCashAlerts(sessions: CashSession[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = Date.now();

  for (const s of sessions) {
    if (s.status === 'closed' && s.difference !== null) {
      const diff = Number(s.difference);
      if (Math.abs(diff) >= CASH_DISCREPANCY_THRESHOLD) {
        alerts.push({
          id: `diff-${s.id}`,
          tone: 'bad',
          badge: 'Écart caisse',
          desc: s.user?.name ?? `Session #${s.id}`,
          meta: formatMoney(diff),
          to: '/cash-discrepancies',
        });
      }
    }
    if (s.status === 'open') {
      const openedHours = (now - new Date(s.opened_at).getTime()) / 3_600_000;
      if (openedHours >= LONG_OPEN_SESSION_HOURS) {
        alerts.push({
          id: `long-${s.id}`,
          tone: 'warn',
          badge: 'Caisse ouverte',
          desc: s.user?.name ?? `Session #${s.id}`,
          meta: `depuis ${Math.floor(openedHours / 24)} j`,
          to: '/cash-sessions',
        });
      }
    }
  }

  return alerts.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1));
}

export function NotificationsBell() {
  const { user } = useAuth();
  const isAdmin = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<ProductBatch[]>('/stocks')
      .then((batches) => setAlerts((prev) => [...computeLowStockAlerts(batches), ...prev.filter((a) => !a.id.startsWith('stock-'))]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<CashSession[]>('/cash-sessions')
      .then((sessions) => setAlerts((prev) => [...prev.filter((a) => a.id.startsWith('stock-')), ...computeCashAlerts(sessions)]))
      .catch(() => {});
  }, [isAdmin]);

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
          <div className="dropdown-title">Alertes</div>
          {alerts.length === 0 && <p className="hint" style={{ padding: '4px 14px 12px' }}>Aucune alerte pour le moment.</p>}
          {alerts.slice(0, 8).map((a) => (
            <Link key={a.id} to={a.to} className="notif-row" onClick={() => setOpen(false)}>
              <span className={`badge ${a.tone}`}>{a.badge}</span>
              <span className="notif-desc">{a.desc}</span>
              <span className="notif-qty">{a.meta}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
