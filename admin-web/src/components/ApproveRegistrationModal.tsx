import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { PlatformOrganization, PlatformOrganizationDetail, PublicPlan } from '../api/types';
import { formatMoney } from '../lib/format';
import { PAYMENT_METHOD_LABEL } from '../lib/subscription';
import { Modal } from './Modal';

type Activation = 'trial' | 'paid' | 'pending_payment';

/** Accepts a signup and decides how the shop is opened: trial, first payment, or later. */
export function ApproveRegistrationModal({
  organization,
  onClose,
  onDone,
}: {
  organization: PlatformOrganization;
  onClose: () => void;
  onDone: (updated: PlatformOrganizationDetail) => void;
}) {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const alreadyApproved = organization.registration_status === 'approved';
  const [form, setForm] = useState({
    activation: (alreadyApproved ? 'paid' : 'trial') as Activation,
    plan_code: (organization.subscription?.plan?.code ?? 'pro') as string,
    trial_days: '15',
    months: '1',
    amount: '',
    method: 'wave',
    reference: '',
    note: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<PublicPlan[]>('/plans').then(setPlans).catch(() => setPlans([]));
  }, []);

  const monthly = Number(plans.find((p) => p.code === form.plan_code)?.monthly_price ?? 0);

  useEffect(() => {
    if (monthly) setForm((f) => ({ ...f, amount: String(monthly * Number(f.months || 1)) }));
  }, [monthly, form.months]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await api.post<PlatformOrganizationDetail>(`/platform/organizations/${organization.id}/approve`, {
        activation: form.activation,
        plan_code: form.plan_code,
        trial_days: form.activation === 'trial' ? Number(form.trial_days) : null,
        months: form.activation === 'paid' ? Number(form.months) : null,
        amount: form.activation === 'paid' ? Number(form.amount) : null,
        method: form.activation === 'paid' ? form.method : null,
        reference: form.reference || null,
        note: form.note || null,
      });
      onDone(updated);
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={alreadyApproved ? `Activer ${organization.name}` : `Accepter ${organization.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="field">
          <label htmlFor="ap-plan">Formule</label>
          <select id="ap-plan" value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} · {formatMoney(p.monthly_price)}/mois
                {p.code === organization.subscription?.plan?.code ? ' (demandée)' : ''}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="activation-choice">
          <legend>Activation</legend>
          <label>
            <input type="radio" name="activation" checked={form.activation === 'trial'} onChange={() => setForm({ ...form, activation: 'trial' })} />
            Accorder une période d'essai : la boutique est utilisable tout de suite
          </label>
          <label>
            <input type="radio" name="activation" checked={form.activation === 'paid'} onChange={() => setForm({ ...form, activation: 'paid' })} />
            Paiement reçu : enregistrer le paiement et activer
          </label>
          {!alreadyApproved && (
            <label>
              <input
                type="radio"
                name="activation"
                checked={form.activation === 'pending_payment'}
                onChange={() => setForm({ ...form, activation: 'pending_payment' })}
              />
              Accepter, mais attendre le paiement : la boutique reste inactive
            </label>
          )}
        </fieldset>

        {form.activation === 'trial' && (
          <div className="field">
            <label htmlFor="ap-days">Jours d'essai</label>
            <input
              id="ap-days"
              type="number"
              min={1}
              max={365}
              value={form.trial_days}
              onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
              required
            />
          </div>
        )}

        {form.activation === 'paid' && (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ap-months">Mois payés</label>
              <input id="ap-months" type="number" min={1} max={36} value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="ap-amount">Montant reçu (FCFA)</label>
              <input id="ap-amount" type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="ap-method">Moyen</label>
              <select id="ap-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ap-ref">Référence</label>
              <input id="ap-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Enregistrement…' : form.activation === 'pending_payment' ? 'Accepter' : 'Accepter et activer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
