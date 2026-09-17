import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { DashboardFigures, SalesTrendPoint, User } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatDate, formatMoney, initials } from '../lib/format';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

function ActivityBars({ data }: { data: SalesTrendPoint[] }) {
  const peak = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((best, point, i) => (point.total >= data[best].total ? i : best), 0);
  }, [data]);
  const [active, setActive] = useState<number | null>(null);
  const highlighted = active ?? peak;
  const max = Math.max(...data.map((d) => d.total), 1);

  if (data.length === 0) {
    return <p className="hint">Aucune vente sur la période.</p>;
  }

  return (
    <div className="account-bars" role="img" aria-label="Ventes des 14 derniers jours">
      <div className="account-bars-plot">
        {data.map((point, i) => {
          const height = Math.max((point.total / max) * 100, point.total > 0 ? 6 : 2);
          const isOn = i === highlighted;
          return (
            <button
              key={point.date}
              type="button"
              className={`account-bar${isOn ? ' is-on' : ''}`}
              style={{ height: `${height}%` }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${formatDate(point.date)} : ${formatMoney(point.total)}`}
            >
              {isOn && (
                <span className="account-bar-tip">
                  <strong>{new Date(point.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</strong>
                  {formatMoney(point.total)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="account-bars-axis">
        {data.map((point, i) =>
          i % 2 === 0 ? (
            <span key={point.date}>
              {new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          ) : (
            <span key={point.date} />
          ),
        )}
      </div>
    </div>
  );
}

export function AccountPage() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameSubmitting, setNameSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [figures, setFigures] = useState<DashboardFigures | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const path =
      user.role?.slug === 'super_admin' ? '/dashboard/general' : user.shop_id ? `/dashboard/shop/${user.shop_id}` : null;
    if (!path) return;
    api
      .get<DashboardFigures>(path)
      .then(setFigures)
      .catch(() => setFigures(null));
  }, [user]);

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role?.slug ?? ''] ?? user.role?.name ?? 'Compte';
  const shopLabel = user.shop?.name ?? 'Toutes les boutiques';
  const monthRevenue = figures?.revenue.this_month ?? 0;
  const budget = Number(user.shop?.monthly_budget ?? 0);
  const budgetPct = budget > 0 ? Math.min(100, Math.round((monthRevenue / budget) * 100)) : 0;

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(false);
    setNameSubmitting(true);
    try {
      const updated = await api.put<User>('/me', { name });
      updateUser(updated);
      setNameSuccess(true);
    } catch (err) {
      setNameError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setNameSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setPasswordSubmitting(true);
    try {
      const updated = await api.put<User>('/me', {
        current_password: currentPassword,
        password: newPassword,
      });
      updateUser(updated);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <div className="account-page">
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Page profil' }]} />

      <div className="account-title-row">
        <h1>Page profil</h1>
        <span className={`badge ${user.is_active ? 'ok' : 'neutral'}`}>{user.is_active ? 'Actif' : 'Désactivé'}</span>
      </div>

      <section className="account-hero">
        <div className="account-banner" aria-hidden="true">
          <span className="account-banner-orb" />
          <span className="account-banner-ring" />
          <span className="account-banner-wave" />
        </div>
        <div className="account-hero-card">
          <div className="account-hero-identity">
            <div className="account-avatar">{initials(user.name)}</div>
            <div>
              <span className="account-badge">{shopLabel}</span>
              <h2>{user.name}</h2>
              <p>
                {roleLabel}
                <span> · </span>
                {user.email}
              </p>
            </div>
          </div>
          <div className="account-hero-meta">
            <span className="label">Espace</span>
            <p>
              {user.created_at
                ? `Compte créé le ${formatDate(user.created_at)}.`
                : 'Compte rattaché à votre boutique.'}{' '}
              {user.shop
                ? `Vous travaillez actuellement sur ${user.shop.name}.`
                : 'Vous avez accès à l’ensemble des boutiques.'}
            </p>
            <Link to={user.shop_id ? '/sales' : '/shops'}>{user.shop_id ? 'Voir les ventes' : 'Voir les boutiques'} →</Link>
          </div>
        </div>
      </section>

      <div className="account-body">
        <div className="account-col">
          <form className="account-card" onSubmit={handleNameSubmit}>
            <h3>Informations</h3>
            {nameError && <div className="alert error">{nameError}</div>}
            {nameSuccess && <div className="alert success">Profil mis à jour.</div>}
            <div className="account-fields">
              <div className="account-field">
                <label htmlFor="acc-name">Nom</label>
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="account-field">
                <label htmlFor="acc-email">E-mail</label>
                <input id="acc-email" value={user.email} disabled />
              </div>
              <div className="account-field">
                <label htmlFor="acc-role">Rôle</label>
                <input id="acc-role" value={roleLabel} disabled />
              </div>
              <div className="account-field">
                <label htmlFor="acc-shop">Boutique</label>
                <input id="acc-shop" value={shopLabel} disabled />
              </div>
            </div>
            <div className="account-card-actions">
              <button type="submit" className="btn btn-primary" disabled={nameSubmitting}>
                {nameSubmitting ? 'Enregistrement…' : 'Enregistrer le profil'}
              </button>
            </div>
          </form>

          <form className="account-card" onSubmit={handlePasswordSubmit}>
            <h3>Mot de passe</h3>
            {passwordError && <div className="alert error">{passwordError}</div>}
            {passwordSuccess && <div className="alert success">Mot de passe modifié.</div>}
            <div className="account-fields">
              <div className="account-field">
                <label htmlFor="acc-current">Actuel</label>
                <input
                  id="acc-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="account-field">
                <label htmlFor="acc-new">Nouveau</label>
                <input
                  id="acc-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="account-field">
                <label htmlFor="acc-confirm">Confirmer</label>
                <input
                  id="acc-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
            <div className="account-card-actions">
              <button type="submit" className="btn btn-primary" disabled={passwordSubmitting}>
                {passwordSubmitting ? 'Enregistrement…' : 'Changer le mot de passe'}
              </button>
            </div>
          </form>
        </div>

        <section className="account-card account-activity">
          <h3>Activité</h3>
          <ActivityBars data={figures?.sales_trend ?? []} />
          <div className="account-usage">
            <div className="account-usage-track" aria-hidden="true">
              <span style={{ width: `${budget > 0 ? budgetPct : monthRevenue > 0 ? 40 : 0}%` }} />
            </div>
            <p>
              {budget > 0
                ? `CA de ce mois : ${formatMoney(monthRevenue)} / ${formatMoney(budget)}`
                : `CA de ce mois : ${formatMoney(monthRevenue)}`}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
