import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Role, Shop, User, UserActivity } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatDate, formatMoney, initials } from '../lib/format';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Administrateur général',
  admin_boutique: 'Administrateur de boutique',
  caissier: 'Caissier / Vendeur',
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  transfer: 'Virement',
  other: 'Autre',
};

const SALE_STATUS: Record<string, string> = {
  completed: 'Validée',
  cancelled: 'Annulée',
  returned: 'Retournée',
  partially_returned: 'Retour partiel',
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
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((u) => {
      if (needle && !u.name.toLowerCase().includes(needle) && !u.email.toLowerCase().includes(needle)) return false;
      if (roleFilter && u.role?.slug !== roleFilter) return false;
      return true;
    });
  }, [users, search, roleFilter]);

  const selected = filtered.find((u) => u.id === selectedId) ?? null;

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filtered.some((u) => u.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setActivity(null);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    api
      .get<UserActivity>(`/users/${selectedId}/activity`)
      .then((data) => {
        if (!cancelled) setActivity(data);
      })
      .catch(() => {
        if (!cancelled) setActivity(null);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

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
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Utilisateurs' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-stage">
        <div className="catalog-main">
          <div className="catalog-heading">
            <div>
              <h1>Utilisateurs</h1>
              <p>
                {selected
                  ? `${selected.name} · ${selected.role ? ROLE_LABEL[selected.role.slug] ?? selected.role.name : 'Compte'}`
                  : `${users.length} compte${users.length > 1 ? 's' : ''}`}
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Nouvel utilisateur
            </button>
          </div>

          <div className="catalog-stats four">
            <div className="catalog-stat">
              <span className="label">Ventes</span>
              <span className="value num">
                {activityLoading ? '…' : formatMoney(activity?.sales.amount ?? 0)}
              </span>
            </div>
            <div className="catalog-stat">
              <span className="label">Stocks enregistrés</span>
              <span className="value num">
                {activityLoading ? '…' : formatMoney(activity?.stocks.amount ?? 0)}
              </span>
            </div>
            <div className="catalog-stat">
              <span className="label">Caisse</span>
              <span className="value num">
                {activityLoading ? '…' : formatMoney(activity?.cash.amount ?? 0)}
              </span>
            </div>
            <div className="catalog-stat">
              <span className="label">Mouvements</span>
              <span className="value num">
                {activityLoading ? '…' : formatMoney(activity?.movements.amount ?? 0)}
              </span>
            </div>
          </div>

          <section className="catalog-history">
            <h2>Comptes</h2>
            <div className="list-toolbar">
              <input
                type="text"
                placeholder="Rechercher un utilisateur…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">Tous les rôles</option>
                {Object.entries(ROLE_LABEL).map(([slug, label]) => (
                  <option key={slug} value={slug}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-wrap table-scroll cards-sm">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>E-mail</th>
                    <th>Rôle</th>
                    <th>Boutique</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr className="empty-row">
                      <td colSpan={5}>Chargement…</td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={5}>Aucun utilisateur pour le moment.</td>
                    </tr>
                  )}
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      className={selectedId === u.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(u.id)}
                    >
                      <td data-label="Nom">{u.name}</td>
                      <td data-label="E-mail">{u.email}</td>
                      <td data-label="Rôle">{u.role ? ROLE_LABEL[u.role.slug] ?? u.role.name : '—'}</td>
                      <td data-label="Boutique">{u.shop?.name ?? '—'}</td>
                      <td data-label="Statut">
                        <span className={`badge ${u.is_active ? 'ok' : 'neutral'}`}>
                          {u.is_active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="catalog-history">
            <h2>Ventes</h2>
            <div className="table-wrap table-scroll cards-sm">
              <table>
                <thead>
                  <tr>
                    <th>N° vente</th>
                    <th>Client</th>
                    <th>Paiement</th>
                    <th>Total</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLoading && (
                    <tr className="empty-row">
                      <td colSpan={6}>Chargement…</td>
                    </tr>
                  )}
                  {!activityLoading && (activity?.sales.rows?.length ?? 0) === 0 && (
                    <tr className="empty-row">
                      <td colSpan={6}>Aucune vente pour ce compte.</td>
                    </tr>
                  )}
                  {!activityLoading &&
                    activity?.sales.rows?.map((sale) => (
                      <tr key={sale.id}>
                        <td className="mono" data-label="N° vente">
                          {sale.sale_number}
                        </td>
                        <td data-label="Client">{sale.customer_name || 'Vente comptoir'}</td>
                        <td data-label="Paiement">{PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method}</td>
                        <td className="num" data-label="Total">
                          {formatMoney(sale.total)}
                        </td>
                        <td data-label="Statut">
                          <span
                            className={`badge ${sale.status === 'completed' ? 'ok' : sale.status === 'cancelled' ? 'bad' : 'warn'}`}
                          >
                            {SALE_STATUS[sale.status] ?? sale.status}
                          </span>
                        </td>
                        <td data-label="Date">{sale.created_at ? formatDate(sale.created_at) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="catalog-history">
            <h2>Stocks reçus</h2>
            <div className="table-wrap table-scroll cards-sm">
              <table>
                <thead>
                  <tr>
                    <th>Code lot</th>
                    <th>Produit</th>
                    <th>Quantité</th>
                    <th>Montant</th>
                    <th>Reçu le</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLoading && (
                    <tr className="empty-row">
                      <td colSpan={5}>Chargement…</td>
                    </tr>
                  )}
                  {!activityLoading && (activity?.stocks.rows?.length ?? 0) === 0 && (
                    <tr className="empty-row">
                      <td colSpan={5}>Aucun stock reçu pour ce compte.</td>
                    </tr>
                  )}
                  {!activityLoading &&
                    activity?.stocks.rows?.map((batch) => (
                      <tr key={batch.id}>
                        <td className="mono" data-label="Code lot">
                          {batch.batch_code}
                        </td>
                        <td data-label="Produit">{batch.product_name ?? '—'}</td>
                        <td className="num" data-label="Quantité">
                          {batch.quantity}
                        </td>
                        <td className="num" data-label="Montant">
                          {formatMoney(batch.amount)}
                        </td>
                        <td data-label="Reçu le">{batch.received_at ? formatDate(batch.received_at) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="catalog-aside">
          <h2>Fiche utilisateur</h2>
          {selected ? (
            <>
              <div className="catalog-aside-block">
                <span className="label">E-mail</span>
                <div className="catalog-aside-box">{selected.email}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Caisse</span>
                <div className="catalog-aside-box">
                  {activityLoading
                    ? '…'
                    : activity?.cash.register_name
                      ? `${activity.cash.register_name} · ${activity.cash.open ? 'Ouverte' : 'Fermée'}`
                      : 'Aucune session de caisse'}
                </div>
              </div>
              <div className="catalog-aside-product">
                <div className="catalog-row-avatar letter">{initials(selected.name)}</div>
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.role ? ROLE_LABEL[selected.role.slug] ?? selected.role.name : '—'}</span>
                </div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Boutique</span>
                  <span>{selected.shop?.name ?? '—'}</span>
                </div>
                <div>
                  <span>Sessions de caisse</span>
                  <span>{activity?.cash.sessions ?? 0}</span>
                </div>
                <div className="total">
                  <span>Statut</span>
                  <span>{selected.is_active ? 'Actif' : 'Désactivé'}</span>
                </div>
              </div>
              {selected.id !== me?.id && (
                <button type="button" className="btn btn-primary" onClick={() => toggleActive(selected)}>
                  {selected.is_active ? 'Désactiver' : 'Réactiver'}
                </button>
              )}
            </>
          ) : (
            <p className="catalog-empty">Sélectionne un utilisateur pour voir sa fiche.</p>
          )}
        </aside>
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
