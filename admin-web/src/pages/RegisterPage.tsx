import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, firstValidationError } from '../api/client';
import type { PublicPlan } from '../api/types';
import { Logo } from '../components/Logo';
import { formatMoney } from '../lib/format';

const PLAN_LABEL: Record<string, string> = { simple: 'Simple', pro: 'Pro', pro_max: 'Pro Max' };

function slugifyCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 10);
}

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan') ?? 'pro';

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [form, setForm] = useState({
    organization_name: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    shop_name: '',
    shop_code: '',
    plan_code: requestedPlan,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<PublicPlan[]>('/plans').then(setPlans);
  }, []);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Inscription impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPlan = plans.find((p) => p.code === form.plan_code);

  return (
    <div className="login-shell">
      <div className="login-decor" aria-hidden="true">
        <span className="login-shape login-shape-ring" />
        <span className="login-shape login-shape-pill" />
        <span className="login-shape login-shape-line" />
        <span className="login-shape login-shape-arc" />
        <span className="login-shape login-shape-dot" />
      </div>

      <div className="login-panel">
        <div className="login-welcome">
          <div className="login-brand">
            <Logo size={36} />
            <span>Boutique</span>
          </div>
          <h1>Créer ton compte</h1>
          <p>
            15 jours d'essai gratuit sur le forfait {PLAN_LABEL[form.plan_code] ?? form.plan_code}, sans engagement.
            {selectedPlan && (
              <>
                {' '}
                Ensuite <strong>{formatMoney(selectedPlan.monthly_price)}</strong> / mois.
              </>
            )}
          </p>
        </div>

        <div className="login-form-card">
          <h2>Inscription</h2>

          {error && <div className="alert error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="plan_code">Forfait</label>
              <select id="plan_code" value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })}>
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} — {formatMoney(p.monthly_price)}/mois
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="organization_name">Nom de l'entreprise</label>
              <input
                id="organization_name"
                value={form.organization_name}
                onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="shop_name">Nom de la première boutique</label>
              <input
                id="shop_name"
                value={form.shop_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shop_name: e.target.value,
                    shop_code: form.shop_code || slugifyCode(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="shop_code">Code boutique</label>
              <input
                id="shop_code"
                value={form.shop_code}
                onChange={(e) => setForm({ ...form, shop_code: slugifyCode(e.target.value) })}
                placeholder="Ex. BDP"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="name">Ton nom complet</label>
              <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Téléphone (optionnel)</label>
              <input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? 'Création du compte…' : "Démarrer l'essai gratuit"}
            </button>
          </form>

          <p className="pricing-footnote">
            <Link to="/tarifs">← Retour aux tarifs</Link> · Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
