import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Supplier } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { IconTruck } from '../components/DashboardIcons';

function emptyForm() {
  return { name: '', phone: '', email: '', address: '' };
}

export function SuppliersPage() {
  const { user } = useAuth();
  const canManage = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';
  const canDelete = user?.role?.slug === 'super_admin';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get<Supplier[]>('/suppliers')
      .then(setSuppliers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/suppliers', {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
      });
      setShowCreate(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(supplier: Supplier) {
    setEditError(null);
    setEditForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
    });
    setEditSupplier(supplier);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editSupplier) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/suppliers/${editSupplier.id}`, {
        name: editForm.name,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
      });
      setEditSupplier(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(supplier: Supplier) {
    setDeleteError(null);
    if (!window.confirm(`Supprimer le fournisseur ${supplier.name} ?`)) return;
    setDeletingId(supplier.id);
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon">
            <IconTruck />
          </div>
          <div>
            <h1>Fournisseurs</h1>
            <p>{suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''} référencé{suppliers.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Nouveau fournisseur
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>Adresse</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={5}>Chargement…</td>
              </tr>
            )}
            {!loading && suppliers.length === 0 && (
              <tr className="empty-row">
                <td colSpan={5}>Aucun fournisseur pour le moment.</td>
              </tr>
            )}
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td data-label="Nom">{s.name}</td>
                <td data-label="Téléphone">{s.phone ?? '—'}</td>
                <td data-label="Email">{s.email ?? '—'}</td>
                <td data-label="Adresse">{s.address ?? '—'}</td>
                <td data-label="" className="row-actions">
                  {canManage && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(s)}>
                      ✏️ Modifier
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost danger"
                      disabled={deletingId === s.id}
                      onClick={() => handleDelete(s)}
                    >
                      🗑️ {deletingId === s.id ? '…' : 'Supprimer'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouveau fournisseur" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="sup-name">Nom</label>
                <input id="sup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="sup-phone">Téléphone</label>
                <input id="sup-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sup-email">Email</label>
                <input
                  id="sup-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="sup-address">Adresse</label>
                <input id="sup-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer le fournisseur'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editSupplier && (
        <Modal title={`Modifier ${editSupplier.name}`} onClose={() => setEditSupplier(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert error">{editError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="esup-name">Nom</label>
                <input
                  id="esup-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="esup-phone">Téléphone</label>
                <input
                  id="esup-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="esup-email">Email</label>
                <input
                  id="esup-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="esup-address">Adresse</label>
                <input
                  id="esup-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditSupplier(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                {editSubmitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
