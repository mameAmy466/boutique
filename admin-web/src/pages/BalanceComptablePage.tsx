import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Shop, TrialBalance } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconTrend } from '../components/DashboardIcons';
import { exportToCsv } from '../lib/csv';
import { formatMoney } from '../lib/format';
import { ACCOUNT_TYPE_LABEL } from '../lib/accountTypes';

function soldeLabel(balance: number): string {
  if (Math.abs(balance) < 0.01) return formatMoney(0);
  return `${formatMoney(Math.abs(balance))} ${balance > 0 ? 'D' : 'C'}`;
}

export function BalanceComptablePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const [balance, setBalance] = useState<TrialBalance | null>(null);
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
      .get<TrialBalance>(`/accounting/balance?${params.toString()}`)
      .then(setBalance)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [shopFilter, fromFilter, toFilter, isSuperAdmin]);

  function handleExport() {
    if (!balance) return;
    exportToCsv(
      'balance-comptable.csv',
      balance.rows.map((r) => ({
        compte: r.account.code,
        intitule: r.account.name,
        solde_ouverture: r.opening_balance,
        debit: r.debit,
        credit: r.credit,
        solde_cloture: r.closing_balance,
      })),
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const balanced = balance ? Math.abs(balance.totals.debit - balance.totals.credit) < 0.01 : true;

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Balance comptable' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-aqua">
            <IconTrend />
          </div>
          <div>
            <h1>Balance comptable</h1>
            <p>Total débit, crédit et solde par compte — sert au contrôle d'équilibre général</p>
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
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport} disabled={!balance || balance.rows.length === 0}>
          ⬇️ Exporter CSV
        </button>
      </div>

      {balance && (
        <div className="catalog-stats" style={{ marginBottom: 16 }}>
          <div className="catalog-stat">
            <span className="label">Total débit</span>
            <span className="value num">{formatMoney(balance.totals.debit)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Total crédit</span>
            <span className="value num">{formatMoney(balance.totals.credit)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Écart</span>
            <span className={`value num ${balanced ? '' : 'badge bad'}`}>
              {formatMoney(balance.totals.debit - balance.totals.credit)}
            </span>
          </div>
        </div>
      )}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>Type</th>
              <th>Solde d'ouverture</th>
              <th>Débit</th>
              <th>Crédit</th>
              <th>Solde de clôture</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={6}>Chargement…</td>
              </tr>
            )}
            {!loading && balance && balance.rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={6}>Aucun mouvement sur la période.</td>
              </tr>
            )}
            {!loading &&
              balance?.rows.map((r) => (
                <tr key={r.account.id}>
                  <td className="mono" data-label="Compte">{r.account.code} — {r.account.name}</td>
                  <td data-label="Type">
                    <span className="badge neutral">{ACCOUNT_TYPE_LABEL[r.account.type]}</span>
                  </td>
                  <td className="num" data-label="Solde d'ouverture">{soldeLabel(r.opening_balance)}</td>
                  <td className="num" data-label="Débit">{r.debit > 0 ? formatMoney(r.debit) : ''}</td>
                  <td className="num" data-label="Crédit">{r.credit > 0 ? formatMoney(r.credit) : ''}</td>
                  <td className="num" data-label="Solde de clôture">{soldeLabel(r.closing_balance)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
