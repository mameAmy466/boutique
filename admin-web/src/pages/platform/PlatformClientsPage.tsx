import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../../api/client';
import type { PlatformOrganization, PlatformOrganizationDetail, PublicPlan } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';
import { Modal } from '../../components/Modal';
import { formatMoney, formatShortDate } from '../../lib/format';
import {
  ORGANIZATION_STATUS_BADGE,
  ORGANIZATION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABEL,
} from '../../lib/subscription';

function emptyForm() {
  return {
    organization_name: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    shop_name: '',
    shop_code: '',
    plan_code: 'pro',
    trial_days: '15',
  };
}

export function PlatformClientsPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get<PlatformOrganization[]>('/platform/organizations')
      .then(setOrganizations)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get<PublicPlan[]>('/plans').then(setPlans).catch(() => setPlans([]));
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return organizations.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (planFilter && o.subscription?.plan?.code !== planFilter) return false;
      if (subscriptionFilter && o.subscription?.status !== subscriptionFilter) return false;
      if (!needle) return true;
      return [o.name, o.email, o.phone, o.owner?.name, o.owner?.email].some((v) => (v ?? '').toLowerCase().includes(needle));
    });
  }, [organizations, search, statusFilter, planFilter, subscriptionFilter]);

  async function toggleSuspension(o: PlatformOrganization) {
    if (o.status === 'active') {
      const reason = window.prompt(`Suspendre « ${o.name} » ? Motif (facultatif) :`, 'Abonnement impayé');
      if (reason === null) return;
      setBusyId(o.id);
      try {
        await api.post(`/platform/organizations/${o.id}/suspend`, { reason: reason || null });
        load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
      } finally {
        setBusyId(null);
      }
    } else {
      if (!window.confirm(`Réactiver l'accès de « ${o.name} » ?`)) return;
      setBusyId(o.id);
      try {
        await api.post(`/platform/organizations/${o.id}/reactivate`);
        load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
      } finally {
        setBusyId(null);
      }
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.post<PlatformOrganizationDetail>('/platform/organizations', {
        ...form,
        trial_days: Number(form.trial_days || 0),
      });
      navigate(`/plateforme/clients/${created.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Clients' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Clients</h1>
          <p>
            {organizations.length} organisation{organizations.length > 1 ? 's' : ''} inscrite
            {organizations.length > 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouveau client
        </button>
      </div>

      <section className="catalog-history">
        <div className="list-toolbar">
          <input
            type="text"
            placeholder="Rechercher un client, un responsable, un e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous les accès</option>
            {Object.entries(ORGANIZATION_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={subscriptionFilter} onChange={(e) => setSubscriptionFilter(e.target.value)}>
            <option value="">Tous les abonnements</option>
            {(['trial', 'active', 'past_due', 'expired', 'cancelled'] as const).map((value) => (
              <option key={value} value={value}>
                {SUBSCRIPTION_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="">Toutes les formules</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Responsable</th>
                <th>Formule</th>
                <th>Échéance</th>
                <th>Dernier paiement</th>
                <th>Abonnement</th>
                <th>Accès</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="empty-row">
                  <td colSpan={8}>Chargement…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={8}>Aucun client ne correspond.</td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="is-clickable" onClick={() => navigate(`/plateforme/clients/${o.id}`)}>
                  <td data-label="Client">
                    <Link to={`/plateforme/clients/${o.id}`} onClick={(e) => e.stopPropagation()}>
                      {o.name}
                    </Link>
                    <div className="hint">
                      {o.shops_count} boutique{o.shops_count > 1 ? 's' : ''} · {o.users_count} utilisateur
                      {o.users_count > 1 ? 's' : ''}
                    </div>
                  </td>
                  <td data-label="Responsable">
                    {o.owner?.name ?? '—'}
                    {o.owner?.email && <div className="hint">{o.owner.email}</div>}
                  </td>
                  <td data-label="Formule">
                    {o.subscription?.plan?.name ?? '—'}
                    {o.subscription?.amount_due != null && (
                      <div className="hint">{formatMoney(o.subscription.amount_due)}</div>
                    )}
                  </td>
                  <td data-label="Échéance">{o.subscription?.ends_at ? formatShortDate(o.subscription.ends_at) : '—'}</td>
                  <td data-label="Dernier paiement">
                    {o.last_payment ? (
                      <>
                        {formatMoney(o.last_payment.amount)}
                        <div className="hint">{formatShortDate(o.last_payment.paid_at)}</div>
                      </>
                    ) : (
                      'Aucun'
                    )}
                  </td>
                  <td data-label="Abonnement">
                    {o.subscription ? (
                      <span className={`badge ${SUBSCRIPTION_STATUS_BADGE[o.subscription.status]}`}>
                        {SUBSCRIPTION_STATUS_LABEL[o.subscription.status]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Accès">
                    <span className={`badge ${ORGANIZATION_STATUS_BADGE[o.status]}`}>{ORGANIZATION_STATUS_LABEL[o.status]}</span>
                  </td>
                  <td data-label="Action" onClick={(e) => e.stopPropagation()}>
                    {!o.is_platform_owner && o.status !== 'closed' && (
                      <button
                        type="button"
                        className={`btn btn-sm${o.status === 'active' ? ' btn-danger' : ''}`}
                        disabled={busyId === o.id}
                        onClick={() => toggleSuspension(o)}
                      >
                        {o.status === 'active' ? 'Suspendre' : 'Réactiver'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <Modal title="Nouveau client" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="c-org">Entreprise</label>
                <input
                  id="c-org"
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="c-name">Responsable</label>
                <input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="c-email">E-mail de connexion</label>
                <input
                  id="c-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="c-password">Mot de passe provisoire</label>
                <input
                  id="c-password"
                  type="text"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="c-phone">Téléphone</label>
                <input id="c-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="c-shop">Première boutique</label>
                <input
                  id="c-shop"
                  value={form.shop_name}
                  onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="c-code">Code boutique</label>
                <input
                  id="c-code"
                  value={form.shop_code}
                  onChange={(e) => setForm({ ...form, shop_code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="c-plan">Formule</label>
                <select id="c-plan" value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })}>
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} · {formatMoney(p.monthly_price)}/mois
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-trial">Jours d'essai</label>
                <input
                  id="c-trial"
                  type="number"
                  min={0}
                  max={365}
                  value={form.trial_days}
                  onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer le client'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
