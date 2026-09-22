import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { IncomeStatement, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconTrend } from '../components/DashboardIcons';
import { formatMoney } from '../lib/format';

export function IncomeStatementPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const [statement, setStatement] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);
    api
      .get<IncomeStatement>(`/accounting/income-statement?${params.toString()}`)
      .then(setStatement)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [shopFilter, fromFilter, toFilter, isSuperAdmin]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const isProfit = (statement?.net_result ?? 0) >= 0;

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Compte de résultat' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconTrend />
          </div>
          <div>
            <h1>Compte de résultat</h1>
            <p>Charges et produits sur la période — pour connaître le bénéfice ou la perte réelle</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="list-toolbar">
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
        <input type="date" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} aria-label="Du" />
        <input type="date" value={toFilter} onChange={(e) => setToFilter(e.target.value)} aria-label="Au" />
      </div>

      {statement && (
        <div className="catalog-stats" style={{ marginBottom: 16 }}>
          <div className="catalog-stat">
            <span className="label">Total produits</span>
            <span className="value num">{formatMoney(statement.total_produits)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Total charges</span>
            <span className="value num">{formatMoney(statement.total_charges)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">{isProfit ? 'Bénéfice' : 'Perte'}</span>
            <span className={`value num ${isProfit ? '' : 'badge bad'}`}>{formatMoney(Math.abs(statement.net_result))}</span>
          </div>
        </div>
      )}

      <div className="two-col-stage">
        <section className="catalog-history">
          <h2>Produits</h2>
          <div className="table-wrap table-scroll cards-sm">
            <table>
              <thead>
                <tr>
                  <th>Compte</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr className="empty-row">
                    <td colSpan={2}>Chargement…</td>
                  </tr>
                )}
                {!loading && statement && statement.produits.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={2}>Aucun produit sur la période.</td>
                  </tr>
                )}
                {statement?.produits.map((l) => (
                  <tr key={l.account.id}>
                    <td data-label="Compte">{l.account.code} — {l.account.name}</td>
                    <td className="num" data-label="Montant">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="catalog-history">
          <h2>Charges</h2>
          <div className="table-wrap table-scroll cards-sm">
            <table>
              <thead>
                <tr>
                  <th>Compte</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr className="empty-row">
                    <td colSpan={2}>Chargement…</td>
                  </tr>
                )}
                {!loading && statement && statement.charges.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={2}>Aucune charge sur la période.</td>
                  </tr>
                )}
                {statement?.charges.map((l) => (
                  <tr key={l.account.id}>
                    <td data-label="Compte">{l.account.code} — {l.account.name}</td>
                    <td className="num" data-label="Montant">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
