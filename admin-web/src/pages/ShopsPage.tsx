import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { formatMoney } from '../lib/format';
import { IconShop } from '../components/DashboardIcons';

const STATUS_BADGE: Record<Shop['status'], string> = {
  active: 'ok',
  suspended: 'warn',
  closed: 'bad',
  archived: 'neutral',
};

const STATUS_LABEL: Record<Shop['status'], string> = {
  active: 'Active',
  suspended: 'Suspendue',
  closed: 'Fermée',
  archived: 'Archivée',
};

function emptyForm() {
  return {
    name: '',
    code: '',
    description: '',
    manager_name: '',
    address: '',
    phone: '',
    email: '',
    category: '',
    monthly_budget: '',
  };
}

export function ShopsPage() {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.role?.slug === 'super_admin';

  function load() {
    setLoading(true);
    api
      .get<Shop[]>('/shops')
      .then(setShops)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/shops', {
        ...form,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : undefined,
      });
      setShowCreate(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(firstValidationError(err.body) ?? err.message);
      } else {
        setFormError('Erreur inattendue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-blue">
            <IconShop />
          </div>
          <div>
            <h1>Boutiques</h1>
            <p>{shops.length} boutique{shops.length > 1 ? 's' : ''} visible{shops.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Nouvelle boutique
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Responsable</th>
              <th>Budget mensuel</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={5}>Chargement…</td>
              </tr>
            )}
            {!loading && shops.length === 0 && (
              <tr className="empty-row">
                <td colSpan={5}>Aucune boutique pour le moment.</td>
              </tr>
            )}
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td className="mono" data-label="Code">{shop.code}</td>
                <td data-label="Nom">{shop.name}</td>
                <td data-label="Responsable">{shop.manager_name ?? '—'}</td>
                <td className="num" data-label="Budget mensuel">{formatMoney(shop.monthly_budget)}</td>
                <td data-label="Statut">
                  <span className={`badge ${STATUS_BADGE[shop.status]}`}>{STATUS_LABEL[shop.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle boutique" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="shop-name">Nom</label>
                <input
                  id="shop-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="shop-code">Code</label>
                <input
                  id="shop-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="BT01"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="shop-manager">Responsable</label>
                <input
                  id="shop-manager"
                  value={form.manager_name}
                  onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="shop-phone">Téléphone</label>
                <input id="shop-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="shop-address">Adresse</label>
                <input
                  id="shop-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="shop-budget">Budget mensuel (FCFA)</label>
                <input
                  id="shop-budget"
                  type="number"
                  min={0}
                  value={form.monthly_budget}
                  onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer la boutique'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
