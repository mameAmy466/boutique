import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../../api/client';
import type { PlatformOrganizationDetail, PublicPlan, SubscriptionStatus } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';
import { Modal } from '../../components/Modal';
import { formatDate, formatMoney } from '../../lib/format';
import {
  ORGANIZATION_STATUS_BADGE,
  ORGANIZATION_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABEL,
} from '../../lib/subscription';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Propriétaire',
  admin_boutique: 'Admin boutique',
  caissier: 'Caissier',
};

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.';
}

export function PlatformClientPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState<PlatformOrganizationDetail | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'payment' | 'subscription' | 'info' | 'delete' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [payment, setPayment] = useState({ amount: '', method: 'wave', months: '1', reference: '', plan_code: '', paid_at: '', note: '' });
  const [sub, setSub] = useState({ plan_code: '', status: 'active' as SubscriptionStatus, trial_ends_at: '', current_period_end: '', grace_days: '7', extra_shops: '0', extra_users: '0', extra_registers: '0' });
  const [info, setInfo] = useState({ name: '', email: '', phone: '' });
  const [confirmName, setConfirmName] = useState('');

  function load() {
    api
      .get<PlatformOrganizationDetail>(`/platform/organizations/${id}`)
      .then(setOrg)
      .catch((err) => setError(errorMessage(err)));
  }

  useEffect(() => {
    load();
    api.get<PublicPlan[]>('/plans').then(setPlans).catch(() => setPlans([]));
  }, [id]);

  async function run(action: () => Promise<PlatformOrganizationDetail | void>, close = true) {
    setBusy(true);
    setError(null);
    setFormError(null);
    try {
      const result = await action();
      if (result) setOrg(result);
      if (close) setModal(null);
    } catch (err) {
      if (modal) setFormError(errorMessage(err));
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!org) {
    return error ? <div className="alert error">{error}</div> : <p className="catalog-empty">Chargement…</p>;
  }

  const s = org.subscription;
  const monthly = Number(plans.find((p) => p.code === (payment.plan_code || s?.plan?.code))?.monthly_price ?? 0);

  function openPayment() {
    setPayment({
      amount: monthly ? String(monthly) : '',
      method: 'wave',
      months: '1',
      reference: '',
      plan_code: '',
      paid_at: '',
      note: '',
    });
    setFormError(null);
    setModal('payment');
  }

  function openSubscription() {
    setSub({
      plan_code: s?.plan?.code ?? 'pro',
      status: s?.status ?? 'active',
      trial_ends_at: s?.trial_ends_at ?? '',
      current_period_end: s?.current_period_end ?? '',
      grace_days: String(s?.grace_days ?? 7),
      extra_shops: String(s?.extra_shops ?? 0),
      extra_users: String(s?.extra_users ?? 0),
      extra_registers: String(s?.extra_registers ?? 0),
    });
    setFormError(null);
    setModal('subscription');
  }

  function openInfo() {
    setInfo({ name: org!.name, email: org!.email ?? '', phone: org!.phone ?? '' });
    setFormError(null);
    setModal('info');
  }

  function suspend() {
    const reason = window.prompt(`Suspendre « ${org!.name} » ? Motif (facultatif) :`, 'Abonnement impayé');
    if (reason === null) return;
    run(() => api.post(`/platform/organizations/${org!.id}/suspend`, { reason: reason || null }));
  }

  function reactivate() {
    if (!window.confirm(`Réactiver l'accès de « ${org!.name} » ?`)) return;
    run(() => api.post(`/platform/organizations/${org!.id}/reactivate`));
  }

  function closeAccount() {
    if (!window.confirm(`Fermer définitivement le compte « ${org!.name} » ? Ses utilisateurs ne pourront plus se connecter.`)) return;
    run(() => api.post(`/platform/organizations/${org!.id}/close`));
  }

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Clients', to: '/plateforme/clients' }, { label: org.name }]}
      />
      {error && <div className="alert error">{error}</div>}
      {org.status !== 'active' && (
        <div className="alert error">
          Accès {ORGANIZATION_STATUS_LABEL[org.status].toLowerCase()}
          {org.suspended_at ? ` depuis le ${formatDate(org.suspended_at)}` : ''}
          {org.suspension_reason ? ` — ${org.suspension_reason}` : ''}.
        </div>
      )}

      <div className="catalog-heading">
        <div>
          <h1>{org.name}</h1>
          <p>
            Client depuis le {formatDate(org.created_at)}
            {org.is_platform_owner ? ' · votre organisation' : ''}
          </p>
        </div>
        <div className="shops-heading-actions">
          <button type="button" className="btn btn-primary" onClick={openPayment} disabled={busy}>
            Enregistrer un paiement
          </button>
          {!org.is_platform_owner && org.status === 'active' && (
            <button type="button" className="btn btn-danger" onClick={suspend} disabled={busy}>
              Suspendre
            </button>
          )}
          {!org.is_platform_owner && org.status !== 'active' && (
            <button type="button" className="btn" onClick={reactivate} disabled={busy}>
              Réactiver
            </button>
          )}
        </div>
      </div>

      <div className="catalog-stats four">
        <div className="catalog-stat">
          <span className="label">Formule</span>
          <span className="value">{s?.plan?.name ?? '—'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Abonnement</span>
          <span className="value">
            {s ? <span className={`badge ${SUBSCRIPTION_STATUS_BADGE[s.status]}`}>{SUBSCRIPTION_STATUS_LABEL[s.status]}</span> : '—'}
          </span>
        </div>
        <div className="catalog-stat">
          <span className="label">Échéance</span>
          <span className="value">{s?.ends_at ? formatDate(s.ends_at) : '—'}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Accès</span>
          <span className="value">
            <span className={`badge ${ORGANIZATION_STATUS_BADGE[org.status]}`}>{ORGANIZATION_STATUS_LABEL[org.status]}</span>
          </span>
        </div>
      </div>

      <div className="subscription-grid">
        <section className="card">
          <div className="card-head-row">
            <h2>Client</h2>
            <button type="button" className="btn btn-sm" onClick={openInfo}>
              Modifier
            </button>
          </div>
          <div className="catalog-totals">
            <div>
              <span>Responsable</span>
              <span>{org.owner?.name ?? '—'}</span>
            </div>
            <div>
              <span>E-mail</span>
              <span>{org.email ?? org.owner?.email ?? '—'}</span>
            </div>
            <div>
              <span>Téléphone</span>
              <span>{org.phone ?? '—'}</span>
            </div>
            <div>
              <span>Boutiques / utilisateurs</span>
              <span>
                {org.shops_count} / {org.users_count}
              </span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head-row">
            <h2>Abonnement</h2>
            <button type="button" className="btn btn-sm" onClick={openSubscription}>
              Modifier
            </button>
          </div>
          <div className="catalog-totals">
            <div>
              <span>Début de période</span>
              <span>{s?.current_period_start ? formatDate(s.current_period_start) : '—'}</span>
            </div>
            <div>
              <span>Fin d'essai</span>
              <span>{s?.trial_ends_at ? formatDate(s.trial_ends_at) : '—'}</span>
            </div>
            <div>
              <span>Fin de période payée</span>
              <span>{s?.current_period_end ? formatDate(s.current_period_end) : '—'}</span>
            </div>
            <div>
              <span>Délai de grâce</span>
              <span>{s ? `${s.grace_days} jours` : '—'}</span>
            </div>
            <div>
              <span>Options (boutiques / utilisateurs / caisses)</span>
              <span>{s ? `+${s.extra_shops} / +${s.extra_users} / +${s.extra_registers}` : '—'}</span>
            </div>
            <div className="total">
              <span>Montant {s?.billing_cycle === 'annual' ? 'annuel' : 'mensuel'}</span>
              <span className="num">{s?.amount_due != null ? formatMoney(s.amount_due) : '—'}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="catalog-history">
        <h2>Paiements</h2>
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Montant</th>
                <th>Moyen</th>
                <th>Référence</th>
                <th>Période couverte</th>
                <th>Saisi par</th>
              </tr>
            </thead>
            <tbody>
              {org.payments.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={6}>Aucun paiement enregistré.</td>
                </tr>
              )}
              {org.payments.map((p) => (
                <tr key={p.id}>
                  <td data-label="Date">{formatDate(p.paid_at)}</td>
                  <td data-label="Montant" className="num">
                    {formatMoney(p.amount)}
                  </td>
                  <td data-label="Moyen">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</td>
                  <td data-label="Référence">{p.reference ?? '—'}</td>
                  <td data-label="Période">
                    {p.period_start && p.period_end ? `${formatDate(p.period_start)} → ${formatDate(p.period_end)}` : '—'}
                  </td>
                  <td data-label="Saisi par">{p.recorder?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="subscription-grid">
        <section className="card">
          <h2>Boutiques</h2>
          <ul className="plain-list">
            {org.shops.map((shop) => (
              <li key={shop.id}>
                <strong>{shop.name}</strong> <span className="hint">{shop.code}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Utilisateurs</h2>
          <ul className="plain-list">
            {org.users.map((u) => (
              <li key={u.id}>
                <strong>{u.name}</strong> <span className="hint">{u.email}</span>{' '}
                <span className="badge neutral">{u.role ? ROLE_LABEL[u.role.slug] ?? u.role.name : '—'}</span>
                {!u.is_active && <span className="badge bad">Désactivé</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="catalog-history">
        <h2>Historique</h2>
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {org.audit_logs.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={3}>Aucune action enregistrée.</td>
                </tr>
              )}
              {org.audit_logs.map((log) => (
                <tr key={log.id}>
                  <td data-label="Date">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                  <td data-label="Action">{log.description}</td>
                  <td data-label="Par">{log.user?.name ?? 'Système'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!org.is_platform_owner && (
        <section className="card danger-zone">
          <h2>Zone sensible</h2>
          {org.status !== 'closed' ? (
            <>
              <p>Fermer le compte coupe définitivement l'accès du client. Ses données sont conservées.</p>
              <button type="button" className="btn btn-danger" onClick={closeAccount} disabled={busy}>
                Fermer le compte
              </button>
            </>
          ) : (
            <>
              <p>Supprimer efface le client et toutes ses données (ventes, stock, comptabilité). C'est irréversible.</p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setConfirmName('');
                  setFormError(null);
                  setModal('delete');
                }}
                disabled={busy}
              >
                Supprimer définitivement
              </button>
            </>
          )}
        </section>
      )}

      {modal === 'payment' && (
        <Modal title="Enregistrer un paiement" onClose={() => setModal(null)}>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() =>
                api.post<PlatformOrganizationDetail>(`/platform/organizations/${org.id}/payments`, {
                  amount: Number(payment.amount),
                  method: payment.method,
                  months: Number(payment.months),
                  reference: payment.reference || null,
                  plan_code: payment.plan_code || null,
                  paid_at: payment.paid_at || null,
                  note: payment.note || null,
                }),
              );
            }}
          >
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="p-plan">Formule</label>
                <select
                  id="p-plan"
                  value={payment.plan_code}
                  onChange={(e) => {
                    const code = e.target.value;
                    const price = Number(plans.find((p) => p.code === (code || s?.plan?.code))?.monthly_price ?? 0);
                    setPayment({ ...payment, plan_code: code, amount: String(price * Number(payment.months || 1)) });
                  }}
                >
                  <option value="">Garder {s?.plan?.name ?? 'la formule actuelle'}</option>
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      Passer à {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-months">Nombre de mois</label>
                <input
                  id="p-months"
                  type="number"
                  min={1}
                  max={36}
                  value={payment.months}
                  onChange={(e) =>
                    setPayment({ ...payment, months: e.target.value, amount: monthly ? String(monthly * Number(e.target.value || 1)) : payment.amount })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="p-amount">Montant reçu (FCFA)</label>
                <input
                  id="p-amount"
                  type="number"
                  min={0}
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="p-method">Moyen de paiement</label>
                <select id="p-method" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="p-ref">Référence (n° de transaction)</label>
                <input id="p-ref" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="p-date">Date du paiement</label>
                <input id="p-date" type="date" value={payment.paid_at} onChange={(e) => setPayment({ ...payment, paid_at: e.target.value })} />
              </div>
            </div>
            <p className="hint">
              La période payée est prolongée de {payment.months || 1} mois
              {s?.status === 'active' && s.current_period_end ? ` à partir du ${formatDate(s.current_period_end)}` : " à partir d'aujourd'hui"}
              {org.status === 'suspended' ? ", et l'accès du client est réactivé." : '.'}
            </p>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'subscription' && (
        <Modal title="Modifier l'abonnement" onClose={() => setModal(null)}>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() =>
                api.put<PlatformOrganizationDetail>(`/platform/organizations/${org.id}/subscription`, {
                  plan_code: sub.plan_code,
                  status: sub.status,
                  trial_ends_at: sub.trial_ends_at || null,
                  current_period_end: sub.current_period_end || null,
                  grace_days: Number(sub.grace_days || 0),
                  extra_shops: Number(sub.extra_shops || 0),
                  extra_users: Number(sub.extra_users || 0),
                  extra_registers: Number(sub.extra_registers || 0),
                }),
              );
            }}
          >
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-plan">Formule</label>
                <select id="s-plan" value={sub.plan_code} onChange={(e) => setSub({ ...sub, plan_code: e.target.value })}>
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-status">Statut</label>
                <select id="s-status" value={sub.status} onChange={(e) => setSub({ ...sub, status: e.target.value as SubscriptionStatus })}>
                  {(['trial', 'active', 'past_due', 'expired', 'cancelled'] as const).map((value) => (
                    <option key={value} value={value}>
                      {SUBSCRIPTION_STATUS_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-trial">Fin d'essai</label>
                <input id="s-trial" type="date" value={sub.trial_ends_at} onChange={(e) => setSub({ ...sub, trial_ends_at: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="s-end">Fin de période payée</label>
                <input
                  id="s-end"
                  type="date"
                  value={sub.current_period_end}
                  onChange={(e) => setSub({ ...sub, current_period_end: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="s-grace">Délai de grâce (jours)</label>
                <input
                  id="s-grace"
                  type="number"
                  min={0}
                  max={90}
                  value={sub.grace_days}
                  onChange={(e) => setSub({ ...sub, grace_days: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="s-xshops">Boutiques en plus</label>
                <input id="s-xshops" type="number" min={0} value={sub.extra_shops} onChange={(e) => setSub({ ...sub, extra_shops: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="s-xusers">Utilisateurs en plus</label>
                <input id="s-xusers" type="number" min={0} value={sub.extra_users} onChange={(e) => setSub({ ...sub, extra_users: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="s-xreg">Caisses en plus</label>
                <input
                  id="s-xreg"
                  type="number"
                  min={0}
                  value={sub.extra_registers}
                  onChange={(e) => setSub({ ...sub, extra_registers: e.target.value })}
                />
              </div>
            </div>
            <p className="hint">Pour un renouvellement payé, préférez « Enregistrer un paiement » : la période est calculée et le paiement gardé en historique.</p>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'info' && (
        <Modal title="Informations du client" onClose={() => setModal(null)}>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(() =>
                api.put<PlatformOrganizationDetail>(`/platform/organizations/${org.id}`, {
                  name: info.name,
                  email: info.email || null,
                  phone: info.phone || null,
                }),
              );
            }}
          >
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="i-name">Entreprise</label>
                <input id="i-name" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="i-email">E-mail</label>
                <input id="i-email" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="i-phone">Téléphone</label>
                <input id="i-phone" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal title="Supprimer définitivement" onClose={() => setModal(null)}>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(async () => {
                await api.delete(`/platform/organizations/${org.id}?confirm_name=${encodeURIComponent(confirmName)}`);
                navigate('/plateforme/clients');
              });
            }}
          >
            {formError && <div className="alert error">{formError}</div>}
            <p>
              Toutes les données de <strong>{org.name}</strong> seront effacées. Tapez son nom exact pour confirmer.
            </p>
            <div className="field">
              <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={org.name} autoFocus />
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-danger" disabled={busy || confirmName !== org.name}>
                Supprimer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
