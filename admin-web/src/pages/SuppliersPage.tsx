import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Supplier, SupplierFiche } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatMoney, initials } from '../lib/format';

function emptyForm() {
  return { name: '', tax_id: '', phone: '', email: '', address: '', payment_terms_days: '' };
}

function paymentTermsLabel(days: number | null): string {
  if (!days) return 'Comptant';
  return `${days} jours`;
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
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fiche, setFiche] = useState<SupplierFiche | null>(null);
  const [ficheLoading, setFicheLoading] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Supplier[]>('/suppliers')
      .then(setSuppliers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        (s.phone ?? '').toLowerCase().includes(needle) ||
        (s.email ?? '').toLowerCase().includes(needle),
    );
  }, [suppliers, search]);

  const selected = filtered.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filtered.some((s) => s.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setFiche(null);
      return;
    }
    setFicheLoading(true);
    api
      .get<SupplierFiche>(`/suppliers/${selectedId}`)
      .then(setFiche)
      .catch(() => setFiche(null))
      .finally(() => setFicheLoading(false));
  }, [selectedId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/suppliers', {
        name: form.name,
        tax_id: form.tax_id || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        payment_terms_days: form.payment_terms_days ? Number(form.payment_terms_days) : undefined,
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
      tax_id: supplier.tax_id ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      payment_terms_days: supplier.payment_terms_days ? String(supplier.payment_terms_days) : '',
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
        tax_id: editForm.tax_id || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        payment_terms_days: editForm.payment_terms_days ? Number(editForm.payment_terms_days) : undefined,
      });
      setEditSupplier(null);
      load();
      if (selectedId === editSupplier.id) {
        api.get<SupplierFiche>(`/suppliers/${editSupplier.id}`).then(setFiche);
      }
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
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Tiers' }, { label: 'Fournisseurs' }]} />
      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <div className="catalog-stage">
        <div className="catalog-main">
          <div className="catalog-heading">
            <div>
              <h1>Fournisseurs</h1>
              <p>
                {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''} référencé
                {suppliers.length > 1 ? 's' : ''}
              </p>
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + Nouveau fournisseur
              </button>
            )}
          </div>

          <div className="catalog-stats">
            <div className="catalog-stat">
              <span className="label">Fournisseurs</span>
              <span className="value num">{filtered.length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Avec téléphone</span>
              <span className="value num">{filtered.filter((s) => s.phone).length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Avec e-mail</span>
              <span className="value num">{filtered.filter((s) => s.email).length}</span>
            </div>
          </div>

          <section className="catalog-history">
            <h2>Annuaire</h2>
            <div className="list-toolbar">
              <input
                type="text"
                placeholder="Rechercher un fournisseur…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="table-wrap table-scroll cards-sm">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th>Adresse</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr className="empty-row">
                      <td colSpan={4}>Chargement…</td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={4}>Aucun fournisseur pour le moment.</td>
                    </tr>
                  )}
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className={selectedId === s.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <td data-label="Nom">{s.name}</td>
                      <td data-label="Téléphone">{s.phone ?? '—'}</td>
                      <td data-label="Email">{s.email ?? '—'}</td>
                      <td data-label="Adresse">{s.address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="catalog-aside">
          <h2>Fiche fournisseur</h2>
          {selected ? (
            <>
              <div className="catalog-aside-product">
                <div className="catalog-row-avatar letter">{initials(selected.name)}</div>
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.phone || 'Pas de téléphone'}</span>
                </div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">NINEA / identifiant fiscal</span>
                <div className="catalog-aside-box">{selected.tax_id || '—'}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Adresse</span>
                <div className="catalog-aside-box">{selected.address || '—'}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Email</span>
                <div className="catalog-aside-box">{selected.email || '—'}</div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Conditions de paiement</span>
                  <span>{paymentTermsLabel(selected.payment_terms_days)}</span>
                </div>
                <div className="total">
                  <span>{fiche?.consolidated ? 'Solde dû — toutes boutiques' : 'Solde dû — cette boutique'}</span>
                  <span>{ficheLoading ? '…' : formatMoney(fiche?.total_debt ?? 0)}</span>
                </div>
              </div>
              {fiche && fiche.debts.length > 0 && (
                <div className="catalog-aside-block">
                  <span className="label">Dernières dettes</span>
                  <div className="catalog-aside-box" style={{ display: 'grid', gap: 6 }}>
                    {fiche.debts.slice(0, 5).map((d) => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{formatMoney(d.amount)}</span>
                        <span className={`badge ${d.status === 'paid' ? 'ok' : d.status === 'partial' ? 'warn' : 'bad'}`}>
                          reste {formatMoney(d.remaining)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {canManage && (
                <button type="button" className="btn btn-primary" onClick={() => openEdit(selected)}>
                  Modifier
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                  disabled={deletingId === selected.id}
                  onClick={() => handleDelete(selected)}
                >
                  {deletingId === selected.id ? 'Suppression…' : 'Supprimer'}
                </button>
              )}
            </>
          ) : (
            <p className="catalog-empty">Sélectionne un fournisseur pour voir sa fiche.</p>
          )}
        </aside>
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
                <label htmlFor="sup-tax-id">NINEA / identifiant fiscal</label>
                <input id="sup-tax-id" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
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
              <div className="field">
                <label htmlFor="sup-terms">Conditions de paiement (jours, 0 = comptant)</label>
                <input
                  id="sup-terms"
                  type="number"
                  min={0}
                  max={365}
                  value={form.payment_terms_days}
                  onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                />
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
                <label htmlFor="esup-tax-id">NINEA / identifiant fiscal</label>
                <input
                  id="esup-tax-id"
                  value={editForm.tax_id}
                  onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
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
              <div className="field">
                <label htmlFor="esup-terms">Conditions de paiement (jours, 0 = comptant)</label>
                <input
                  id="esup-terms"
                  type="number"
                  min={0}
                  max={365}
                  value={editForm.payment_terms_days}
                  onChange={(e) => setEditForm({ ...editForm, payment_terms_days: e.target.value })}
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
