import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { MySubscription } from '../api/types';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatDate, formatMoney } from '../lib/format';
import {
  ORGANIZATION_STATUS_BADGE,
  ORGANIZATION_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PLATFORM_CONTACT,
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABEL,
} from '../lib/subscription';

/** The client's own subscription: plan, due date, payment history and how to pay. */
export function SubscriptionPage() {
  const [data, setData] = useState<MySubscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MySubscription>('/subscription')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'));
  }, []);

  const subscription = data?.subscription;
  const organization = data?.organization;
  const whatsappText = encodeURIComponent(
    `Bonjour, je souhaite payer mon abonnement Boutique (${organization?.name ?? ''}).`,
  );

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Mon abonnement' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Mon abonnement</h1>
          <p>{organization?.name ?? '…'}</p>
        </div>
      </div>

      {data?.access && <div className="alert error">{data.access.message}</div>}

      <div className="catalog-stats four">
        <div className="catalog-stat">
          <span className="label">Formule</span>
          <span className="value">{subscription?.plan.name ?? '—'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Statut</span>
          <span className="value">
            {subscription ? (
              <span className={`badge ${SUBSCRIPTION_STATUS_BADGE[subscription.status]}`}>
                {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
              </span>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className="catalog-stat">
          <span className="label">{subscription?.status === 'trial' ? "Fin de l'essai" : 'Échéance'}</span>
          <span className="value">{subscription?.ends_at ? formatDate(subscription.ends_at) : '—'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Prix mensuel</span>
          <span className="value num">{subscription ? formatMoney(subscription.plan.monthly_price) : '—'}</span>
        </div>
      </div>

      <div className="subscription-grid">
        <section className="card">
          <h2>Payer ou renouveler</h2>
          <p>
            Envoyez votre paiement (Wave, Orange Money, espèces ou virement) puis prévenez-nous : votre abonnement
            est prolongé dès réception.
          </p>
          {organization && organization.status !== 'active' && (
            <p>
              Accès :{' '}
              <span className={`badge ${ORGANIZATION_STATUS_BADGE[organization.status]}`}>
                {ORGANIZATION_STATUS_LABEL[organization.status]}
              </span>
            </p>
          )}
          <div className="form-actions">
            <a
              className="btn btn-primary"
              href={`https://wa.me/${PLATFORM_CONTACT.whatsapp}?text=${whatsappText}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
            <a className="btn btn-ghost" href={PLATFORM_CONTACT.phoneHref}>
              {PLATFORM_CONTACT.phoneDisplay}
            </a>
            <a className="btn btn-ghost" href={`mailto:${PLATFORM_CONTACT.email}`}>
              {PLATFORM_CONTACT.email}
            </a>
          </div>

          {data && data.plans.length > 0 && (
            <>
              <h3>Formules disponibles</h3>
              <ul className="subscription-plans">
                {data.plans.map((plan) => (
                  <li key={plan.code} className={plan.code === subscription?.plan.code ? 'is-current' : undefined}>
                    <strong>{plan.name}</strong>
                    <span className="num">{formatMoney(plan.monthly_price)} / mois</span>
                    {plan.code === subscription?.plan.code && <span className="badge ok">Actuelle</span>}
                  </li>
                ))}
              </ul>
              <p className="hint">Pour changer de formule, contactez-nous : le changement est appliqué immédiatement.</p>
            </>
          )}
        </section>

        <section className="card">
          <h2>Historique des paiements</h2>
          <div className="table-wrap table-scroll cards-sm">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Moyen</th>
                  <th>Période couverte</th>
                </tr>
              </thead>
              <tbody>
                {data && data.payments.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={4}>Aucun paiement enregistré.</td>
                  </tr>
                )}
                {data?.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td data-label="Date">{formatDate(payment.paid_at)}</td>
                    <td data-label="Montant" className="num">
                      {formatMoney(payment.amount)}
                    </td>
                    <td data-label="Moyen">{PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</td>
                    <td data-label="Période">
                      {payment.period_start && payment.period_end
                        ? `${formatDate(payment.period_start)} → ${formatDate(payment.period_end)}`
                        : '—'}
                    </td>
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
