import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { CashflowBucket, CashflowGroupBy, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconBank } from '../components/DashboardIcons';
import { CashflowChart } from '../components/charts/CashflowChart';
import { formatDate, formatMoney } from '../lib/format';

const GROUP_LABEL: Record<CashflowGroupBy, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
};

function periodDisplay(period: string, groupBy: CashflowGroupBy): string {
  if (groupBy === 'year') return period.slice(0, 4);
  if (groupBy === 'month') {
    return new Date(`${period}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  if (groupBy === 'week') return `Semaine du ${formatDate(period).split(' ')[0]}`;
  return formatDate(period).split(' ')[0];
}

export function CashflowPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [groupBy, setGroupBy] = useState<CashflowGroupBy>('month');
  const [shopFilter, setShopFilter] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [buckets, setBuckets] = useState<CashflowBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ group_by: groupBy });
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    api
      .get<CashflowBucket[]>(`/accounting/cashflow?${params.toString()}`)
      .then(setBuckets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [groupBy, shopFilter, isSuperAdmin]);

  const totals = useMemo(
    () =>
      buckets.reduce(
        (acc, b) => ({ entrees: acc.entrees + b.entrees, sorties: acc.sorties + b.sorties, net: acc.net + b.net }),
        { entrees: 0, sorties: 0, net: 0 },
      ),
    [buckets],
  );

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Trésorerie' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-blue">
            <IconBank />
          </div>
          <div>
            <h1>Trésorerie</h1>
            <p>Entrées (ventes) et sorties (dépenses) — vue jour / semaine / mois / année</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="list-toolbar">
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as CashflowGroupBy)}>
          {Object.entries(GROUP_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              Par {label.toLowerCase()}
            </option>
          ))}
        </select>
        {isSuperAdmin && (
          <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
            <option value="">Toutes les boutiques</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="catalog-stats" style={{ marginBottom: 16 }}>
        <div className="catalog-stat">
          <span className="label">Entrées</span>
          <span className="value num">{formatMoney(totals.entrees)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Sorties</span>
          <span className="value num">{formatMoney(totals.sorties)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Résultat net</span>
          <span className="value num" style={{ color: totals.net >= 0 ? undefined : 'var(--danger)' }}>
            {formatMoney(totals.net)}
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        {loading ? <p className="hint">Chargement…</p> : <CashflowChart data={buckets} groupBy={groupBy} />}
      </div>

      <div className="section-title">Détail par période</div>
      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Période</th>
              <th>Entrées</th>
              <th>Sorties</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {!loading && buckets.length === 0 && (
              <tr className="empty-row">
                <td colSpan={4}>Aucune donnée sur la période.</td>
              </tr>
            )}
            {[...buckets].reverse().map((b) => (
              <tr key={b.period}>
                <td data-label="Période">{periodDisplay(b.period, groupBy)}</td>
                <td className="num" data-label="Entrées">{formatMoney(b.entrees)}</td>
                <td className="num" data-label="Sorties">{formatMoney(b.sorties)}</td>
                <td className="num" data-label="Net">
                  <span className={`badge ${b.net >= 0 ? 'ok' : 'bad'}`}>{formatMoney(b.net)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
