import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../../api/client';
import type { PlatformAdminRow } from '../../api/types';
import { Breadcrumb } from '../../components/Breadcrumb';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { formatShortDate } from '../../lib/format';

/** The accounts that administer the platform: no shop, no organization. */
export function PlatformAdminsPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdminRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api
      .get<PlatformAdminRow[]>('/platform/admins')
      .then(setAdmins)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'));
  }

  useEffect(load, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      await api.post('/platform/admins', form);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  async function update(admin: PlatformAdminRow, patch: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      await api.put(`/platform/admins/${admin.id}`, patch);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  function resetPassword(admin: PlatformAdminRow) {
    const password = window.prompt(`Nouveau mot de passe pour ${admin.name} (8 caractères minimum) :`, '');
    if (!password) return;
    update(admin, { password });
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Super Admin', to: '/plateforme' }, { label: 'Administrateurs' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Administrateurs de la plateforme</h1>
          <p>Ces comptes gèrent MyBoutiqu. Ils n'ont pas de boutique et ne voient pas les ventes des clients.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvel administrateur
        </button>
      </div>

      <section className="catalog-history">
        <div className="table-wrap table-scroll cards-sm">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Depuis</th>
                <th>Statut</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td data-label="Nom">
                    {admin.name}
                    {admin.id === user?.id && <span className="hint"> · vous</span>}
                  </td>
                  <td data-label="E-mail">{admin.email}</td>
                  <td data-label="Depuis">{formatShortDate(admin.created_at)}</td>
                  <td data-label="Statut">
                    <span className={`badge ${admin.is_active ? 'ok' : 'neutral'}`}>{admin.is_active ? 'Actif' : 'Désactivé'}</span>
                  </td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => resetPassword(admin)}>
                        Mot de passe
                      </button>
                      {admin.id !== user?.id && (
                        <button
                          type="button"
                          className={`btn btn-sm${admin.is_active ? ' btn-danger' : ''}`}
                          disabled={busy}
                          onClick={() => update(admin, { is_active: !admin.is_active })}
                        >
                          {admin.is_active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <Modal title="Nouvel administrateur" onClose={() => setShowCreate(false)}>
          <form onSubmit={create}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pa-name">Nom</label>
                <input id="pa-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="pa-email">E-mail</label>
                <input id="pa-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="pa-password">Mot de passe provisoire</label>
                <input
                  id="pa-password"
                  type="text"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>
            <p className="hint">Il aura les mêmes droits que vous sur toute la plateforme.</p>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Créer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
