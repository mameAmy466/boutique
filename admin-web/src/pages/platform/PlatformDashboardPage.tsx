import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { PlatformDashboard, PlatformOrganization } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';
import { formatDate, formatMoney } from '../../lib/format';
import { SUBSCRIPTION_STATUS_BADGE, SUBSCRIPTION_STATUS_LABEL } from '../../lib/subscription';

export function PlatformDashboardPage() {
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [attention, setAttention] = useState<PlatformOrganization[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<PlatformDashboard>('/platform/dashboard'),
      api.get<PlatformOrganization[]>('/platform/organizations'),
    ])
      .then(([dashboard, organizations]) => {
        setData(dashboard);
        const soon = new Date();
        soon.setDate(soon.getDate() + 7);
        setAttention(
          organizations
            .filter((o) => !o.is_platform_owner && o.status !== 'closed')
            .filter((o) => {
              const s = o.subscription;
              if (!s) return true;
              if (s.status === 'past_due' || s.status === 'expired') return true;
              return Boolean(s.ends_at && new Date(s.ends_at) <= soon);
            })
            .sort((a, b) => (a.subscription?.ends_at ?? '').localeCompare(b.subscription?.ends_at ?? '')),
        );
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'));
  }, []);

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin' }, { label: "Vue d'ensemble" }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Plateforme</h1>
          <p>Toutes les boutiques clientes et leurs abonnements</p>
        </div>
        <Link className="btn btn-primary" to="/plateforme/clients">
          Gérer les clients
        </Link>
      </div>

      <div className="catalog-stats four">
        <div className="catalog-stat">
          <span className="label">Clients inscrits</span>
          <span className="value num">{data?.organizations.total ?? '…'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Actifs</span>
          <span className="value num">{data?.organizations.active ?? '…'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Suspendus</span>
          <span className="value num">{data?.organizations.suspended ?? '…'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Échéance sous 7 jours</span>
          <span className="value num">{data?.subscriptions.expiring_soon ?? '…'}</span>
        </div>
      </div>

      <div className="catalog-stats four">
        <div className="catalog-stat">
          <span className="label">En essai</span>
          <span className="value num">{data?.subscriptions.trial ?? '…'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Paiements en retard</span>
          <span className="value num">{data ? data.subscriptions.past_due + data.subscriptions.expired : '…'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Encaissé ce mois</span>
          <span className="value num">{data ? formatMoney(data.revenue.month) : '…'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Encaissé cette année</span>
          <span className="value num">{data ? formatMoney(data.revenue.year) : '…'}</span>
        </div>
      </div>

      <section className="catalog-history">
        <h2>À surveiller</h2>
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Formule</th>
                <th>Abonnement</th>
                <th>Échéance</th>
              </tr>
            </thead>
            <tbody>
              {data && attention.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={4}>Rien à signaler : tous les abonnements sont à jour.</td>
                </tr>
              )}
              {attention.map((o) => (
                <tr key={o.id}>
                  <td data-label="Client">
                    <Link to={`/plateforme/clients/${o.id}`}>{o.name}</Link>
                  </td>
                  <td data-label="Formule">{o.subscription?.plan?.name ?? '—'}</td>
                  <td data-label="Abonnement">
                    {o.subscription ? (
                      <span className={`badge ${SUBSCRIPTION_STATUS_BADGE[o.subscription.status]}`}>
                        {SUBSCRIPTION_STATUS_LABEL[o.subscription.status]}
                      </span>
                    ) : (
                      <span className="badge bad">Aucun</span>
                    )}
                  </td>
                  <td data-label="Échéance">{o.subscription?.ends_at ? formatDate(o.subscription.ends_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data && Object.keys(data.by_plan).length > 0 && (
        <section className="catalog-history">
          <h2>Répartition par formule</h2>
          <div className="catalog-stats">
            {Object.entries(data.by_plan).map(([plan, count]) => (
              <div className="catalog-stat" key={plan}>
                <span className="label">{plan}</span>
                <span className="value num">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
