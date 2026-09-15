import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Role, Shop, User } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { IconUsers } from '../components/DashboardIcons';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

function emptyForm(defaultShopId: string) {
  return {
    name: '',
    email: '',
    password: '',
    role_id: '',
    shop_id: defaultShopId,
  };
}

export function UsersPage() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role?.slug === 'super_admin';

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(() => emptyForm(me?.shop_id ? String(me.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get<User[]>('/users'),
      api.get<Role[]>('/roles'),
      isSuperAdmin ? api.get<Shop[]>('/shops') : Promise.resolve([] as Shop[]),
    ])
      .then(([u, r, s]) => {
        setUsers(u);
        setRoles(r);
        setShops(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [isSuperAdmin]);

  const selectedRole = roles.find((r) => String(r.id) === form.role_id);
  const needsShop = selectedRole ? selectedRole.slug !== 'super_admin' : true;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/users', {
        name: form.name,
        email: form.email,
        password: form.password,
        role_id: Number(form.role_id),
        shop_id: needsShop && form.shop_id ? Number(form.shop_id) : undefined,
      });
      setShowCreate(false);
      setForm(emptyForm(me?.shop_id ? String(me.shop_id) : ''));
      loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(target: User) {
    try {
      await api.patch(`/users/${target.id}`, { is_active: !target.is_active });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de modifier cet utilisateur.');
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconUsers />
          </div>
          <div>
            <h1>Utilisateurs</h1>
            <p>{users.length} compte{users.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvel utilisateur
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôle</th>
              <th>Boutique</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={6}>Chargement…</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr className="empty-row">
                <td colSpan={6}>Aucun utilisateur pour le moment.</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label="Nom">{u.name}</td>
                <td data-label="E-mail">{u.email}</td>
                <td data-label="Rôle">{u.role ? ROLE_LABEL[u.role.slug] ?? u.role.name : '—'}</td>
                <td data-label="Boutique">{u.shop?.name ?? '—'}</td>
                <td data-label="Statut">
                  <span className={`badge ${u.is_active ? 'ok' : 'neutral'}`}>
                    {u.is_active ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td data-label="">
                  {u.id !== me?.id && (
                    <button className="btn btn-sm btn-ghost" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvel utilisateur" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="u-name">Nom</label>
                <input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="u-email">E-mail</label>
                <input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="u-password">Mot de passe</label>
                <input
                  id="u-password"
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="u-role">Rôle</label>
                <select id="u-role" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                  <option value="">— choisir —</option>
                  {roles
                    .filter((r) => isSuperAdmin || r.slug !== 'super_admin')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {ROLE_LABEL[r.slug] ?? r.name}
                      </option>
                    ))}
                </select>
              </div>
              {needsShop && (
                <div className="field">
                  <label htmlFor="u-shop">Boutique</label>
                  {isSuperAdmin ? (
                    <select id="u-shop" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })} required>
                      <option value="">— choisir —</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input id="u-shop" value={me?.shop?.name ?? ''} disabled />
                  )}
                </div>
              )}
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : "Créer l'utilisateur"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
