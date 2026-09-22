import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { BalanceSheet, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconClipboard } from '../components/DashboardIcons';
import { formatMoney } from '../lib/format';

export function BalanceSheetPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
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
    if (toFilter) params.set('to', toFilter);
    api
      .get<BalanceSheet>(`/accounting/balance-sheet?${params.toString()}`)
      .then(setSheet)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [shopFilter, toFilter, isSuperAdmin]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const balanced = sheet ? Math.abs(sheet.total_actif - sheet.total_passif) < 0.01 : true;

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Bilan' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-blue">
            <IconClipboard />
          </div>
          <div>
            <h1>Bilan</h1>
            <p>Actif et passif à une date donnée, résultat de l'exercice non encore clôturé inclus</p>
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
        <input type="date" value={toFilter} onChange={(e) => setToFilter(e.target.value)} aria-label="À la date du" />
      </div>

      {sheet && (
        <div className="catalog-stats" style={{ marginBottom: 16 }}>
          <div className="catalog-stat">
            <span className="label">Total actif</span>
            <span className="value num">{formatMoney(sheet.total_actif)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Total passif (+ résultat)</span>
            <span className="value num">{formatMoney(sheet.total_passif)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Écart</span>
            <span className={`value num ${balanced ? '' : 'badge bad'}`}>
              {formatMoney(sheet.total_actif - sheet.total_passif)}
            </span>
          </div>
        </div>
      )}

      <div className="two-col-stage">
        <section className="catalog-history">
          <h2>Actif</h2>
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
                {!loading && sheet && sheet.actif.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={2}>Aucun compte d'actif.</td>
                  </tr>
                )}
                {sheet?.actif.map((l) => (
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
          <h2>Passif</h2>
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
                {sheet?.passif.map((l) => (
                  <tr key={l.account.id}>
                    <td data-label="Compte">{l.account.code} — {l.account.name}</td>
                    <td className="num" data-label="Montant">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
                {!loading && sheet && (
                  <tr>
                    <td data-label="Compte"><em>Résultat de l'exercice (non clôturé)</em></td>
                    <td className="num" data-label="Montant">{formatMoney(sheet.net_result)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
