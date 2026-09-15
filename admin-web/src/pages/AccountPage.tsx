import { useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { User } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { IconSettings } from '../components/DashboardIcons';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

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

  if (!user) return null;

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
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconSettings />
          </div>
          <div>
            <h1>Mon compte</h1>
            <p>Informations personnelles et sécurité</p>
          </div>
        </div>
      </div>

      <div className="account-grid">
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Profil</div>
          <form onSubmit={handleNameSubmit}>
            {nameError && <div className="alert error">{nameError}</div>}
            {nameSuccess && <div className="alert success">Profil mis à jour.</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="acc-name">Nom</label>
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="acc-email">Email</label>
                <input id="acc-email" value={user.email} disabled />
              </div>
              <div className="field">
                <label>Rôle</label>
                <input value={ROLE_LABELS[user.role?.slug ?? ''] ?? user.role?.name ?? '—'} disabled />
              </div>
              <div className="field">
                <label>Boutique</label>
                <input value={user.shop?.name ?? '— (toutes)'} disabled />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={nameSubmitting}>
                {nameSubmitting ? 'Enregistrement…' : 'Enregistrer le profil'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Mot de passe</div>
          <form onSubmit={handlePasswordSubmit}>
            {passwordError && <div className="alert error">{passwordError}</div>}
            {passwordSuccess && <div className="alert success">Mot de passe modifié.</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="acc-current">Mot de passe actuel</label>
                <input
                  id="acc-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="acc-new">Nouveau mot de passe</label>
                <input
                  id="acc-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="acc-confirm">Confirmer le nouveau mot de passe</label>
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
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={passwordSubmitting}>
                {passwordSubmitting ? 'Enregistrement…' : 'Changer le mot de passe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
