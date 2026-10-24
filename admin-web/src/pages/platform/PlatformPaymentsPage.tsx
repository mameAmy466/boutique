import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { SubscriptionPaymentRow } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';
import { formatDate, formatMoney } from '../../lib/format';
import { PAYMENT_METHOD_LABEL } from '../../lib/subscription';

export function PlatformPaymentsPage() {
  const [payments, setPayments] = useState<SubscriptionPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    setLoading(true);
    api
      .get<SubscriptionPaymentRow[]>(`/platform/payments?${params}`)
      .then(setPayments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [from, to]);

  const total = useMemo(() => payments.reduce((sum, p) => sum + Number(p.amount), 0), [payments]);

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Paiements' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Paiements reçus</h1>
          <p>
            {payments.length} paiement{payments.length > 1 ? 's' : ''} · {formatMoney(total)}
          </p>
        </div>
      </div>

      <section className="catalog-history">
        <div className="list-toolbar">
          <label className="hint" htmlFor="pay-from">
            Du
          </label>
          <input id="pay-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="hint" htmlFor="pay-to">
            au
          </label>
          <input id="pay-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Formule</th>
                <th>Montant</th>
                <th>Moyen</th>
                <th>Référence</th>
                <th>Période</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={7}>Chargement…</td>
                </tr>
              )}
              {!loading && payments.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={7}>Aucun paiement sur cette période.</td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Date">{formatDate(p.paid_at)}</td>
                  <td data-label="Client">
                    {p.organization ? <Link to={`/plateforme/clients/${p.organization.id}`}>{p.organization.name}</Link> : '—'}
                  </td>
                  <td data-label="Formule">{p.plan?.name ?? '—'}</td>
                  <td data-label="Montant" className="num">
                    {formatMoney(p.amount)}
                  </td>
                  <td data-label="Moyen">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                  <td data-label="Référence">{p.reference ?? '—'}</td>
                  <td data-label="Période">
                    {p.period_start && p.period_end ? `${formatDate(p.period_start)} → ${formatDate(p.period_end)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
