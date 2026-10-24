import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { PlatformAuditLogRow } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';

/** Every platform-level action: suspensions, reactivations, payments, plan changes. */
export function PlatformHistoryPage() {
  const [logs, setLogs] = useState<PlatformAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PlatformAuditLogRow[]>('/platform/audit-logs')
      .then(setLogs)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Historique' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Historique</h1>
          <p>Suspensions, réactivations, paiements et modifications d'abonnement</p>
        </div>
      </div>

      <section className="catalog-history">
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Action</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={4}>Chargement…</td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={4}>Aucune action pour le moment.</td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Date">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                  <td data-label="Client">
                    {log.organization ? <Link to={`/plateforme/clients/${log.organization.id}`}>{log.organization.name}</Link> : '—'}
                  </td>
                  <td data-label="Action">{log.description}</td>
                  <td data-label="Par">{log.user?.name ?? 'Système'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
