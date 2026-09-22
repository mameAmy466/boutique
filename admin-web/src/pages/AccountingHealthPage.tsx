import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { AccountingRuleCoverage, IntegrityCheck } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconAudit } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';
import { ACCOUNTING_EVENT_LABEL } from '../lib/accountingEvents';
import { EXPENSE_CATEGORY_LABEL } from '../lib/expenseCategories';

export function AccountingHealthPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';

  const [coverage, setCoverage] = useState<AccountingRuleCoverage | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<AccountingRuleCoverage>('/accounting-rules/coverage'),
      api.get<IntegrityCheck>('/accounting/integrity-check'),
    ])
      .then(([cov, integ]) => {
        setCoverage(cov);
        setIntegrity(integ);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const missing = coverage?.rows.filter((r) => !r.configured) ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Contrôle comptable' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconAudit />
          </div>
          <div>
            <h1>Contrôle comptable</h1>
            <p>Couverture des règles et équilibre global des écritures</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="hint">Chargement…</p>}

      {integrity && (
        <>
          <h2 style={{ marginTop: 0 }}>Équilibre débit / crédit</h2>
          <div className="catalog-stats" style={{ marginBottom: 16 }}>
            <div className="catalog-stat">
              <span className="label">Total débit</span>
              <span className="value num">{formatMoney(integrity.total_debit)}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Total crédit</span>
              <span className="value num">{formatMoney(integrity.total_credit)}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">État</span>
              <span className={`badge ${integrity.balanced ? 'ok' : 'bad'}`}>
                {integrity.balanced ? 'Équilibré' : 'Déséquilibre détecté'}
              </span>
            </div>
          </div>

          {!integrity.balanced && (
            <div className="table-wrap table-scroll cards-sm" style={{ marginBottom: 24 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pièce</th>
                    <th>Libellé</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {integrity.unbalanced_entries.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Date">{formatDate(e.entry_date)}</td>
                      <td className="mono" data-label="Pièce">{e.reference ?? '—'}</td>
                      <td data-label="Libellé">{e.label}</td>
                      <td className="num" data-label="Écart">
                        <span className="badge bad">{formatMoney(e.diff)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {coverage && (
        <>
          <h2>Couverture du moteur de règles</h2>
          <div className="catalog-stats" style={{ marginBottom: 16 }}>
            <div className="catalog-stat">
              <span className="label">Événements configurés</span>
              <span className="value num">{coverage.configured_count} / {coverage.total}</span>
            </div>
          </div>

          {missing.length === 0 ? (
            <p className="hint">Tous les événements ont une règle configurée.</p>
          ) : (
            <div className="table-wrap table-scroll cards-sm">
              <table>
                <thead>
                  <tr>
                    <th>Événement</th>
                    <th>Catégorie</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {missing.map((r, i) => (
                    <tr key={i}>
                      <td data-label="Événement">{ACCOUNTING_EVENT_LABEL[r.event]}</td>
                      <td data-label="Catégorie">{r.category ? EXPENSE_CATEGORY_LABEL[r.category] : '—'}</td>
                      <td data-label="">
                        <span className="badge warn">Non configurée</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
