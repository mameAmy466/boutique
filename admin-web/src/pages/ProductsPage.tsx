import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Category, Product, Supplier } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { IconTag } from '../components/DashboardIcons';

function emptyForm() {
  return {
    name: '',
    reference: '',
    category_id: '',
    supplier_id: '',
    brand: '',
    unit: 'unité',
    min_stock: '0',
    max_stock: '',
  };
}

export function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newCategory, setNewCategory] = useState('');
  const [newSupplier, setNewSupplier] = useState('');

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get<Product[]>('/products'),
      api.get<Category[]>('/categories'),
      api.get<Supplier[]>('/suppliers'),
    ])
      .then(([p, c, s]) => {
        setProducts(p);
        setCategories(c);
        setSuppliers(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  async function handleCreateCategory() {
    if (!newCategory.trim()) return;
    const category = await api.post<Category>('/categories', { name: newCategory.trim() });
    setCategories((prev) => [...prev, category]);
    setForm((f) => ({ ...f, category_id: String(category.id) }));
    setNewCategory('');
  }

  async function handleCreateSupplier() {
    if (!newSupplier.trim()) return;
    const supplier = await api.post<Supplier>('/suppliers', { name: newSupplier.trim() });
    setSuppliers((prev) => [...prev, supplier]);
    setForm((f) => ({ ...f, supplier_id: String(supplier.id) }));
    setNewSupplier('');
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/products', {
        name: form.name,
        reference: form.reference,
        category_id: form.category_id || undefined,
        supplier_id: form.supplier_id || undefined,
        brand: form.brand || undefined,
        unit: form.unit || undefined,
        min_stock: form.min_stock ? Number(form.min_stock) : undefined,
        max_stock: form.max_stock ? Number(form.max_stock) : undefined,
      });
      setShowCreate(false);
      setForm(emptyForm());
      loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? '—';
  const supplierName = (id: number | null) => suppliers.find((s) => s.id === id)?.name ?? '—';

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon">
            <IconTag />
          </div>
          <div>
            <h1>Produits</h1>
            <p>{products.length} article{products.length > 1 ? 's' : ''} au catalogue</p>
          </div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Nouveau produit
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Nom</th>
              <th>Marque</th>
              <th>Catégorie</th>
              <th>Fournisseur</th>
              <th>Unité</th>
              <th>Seuil min.</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={7}>Chargement…</td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>Aucun produit pour le moment.</td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id}>
                <td className="mono" data-label="Référence">{p.reference}</td>
                <td data-label="Nom">{p.name}</td>
                <td data-label="Marque">{p.brand ?? '—'}</td>
                <td data-label="Catégorie">{p.category?.name ?? categoryName(p.category_id)}</td>
                <td data-label="Fournisseur">{p.supplier?.name ?? supplierName(p.supplier_id)}</td>
                <td data-label="Unité">{p.unit}</td>
                <td className="num" data-label="Seuil min.">{p.min_stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouveau produit" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="p-name">Nom</label>
                <input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="p-ref">Référence</label>
                <input
                  id="p-ref"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="REF-001"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="p-brand">Marque</label>
                <input id="p-brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="p-unit">Unité</label>
                <input id="p-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="p-min">Stock minimum</label>
                <input
                  id="p-min"
                  type="number"
                  min={0}
                  value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="p-max">Stock maximum</label>
                <input
                  id="p-max"
                  type="number"
                  min={0}
                  value={form.max_stock}
                  onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="field">
                <label htmlFor="p-cat">Catégorie</label>
                <select id="p-cat" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">— aucune —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input
                    placeholder="Nouvelle catégorie…"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ flex: 1, padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)' }}
                  />
                  <button type="button" className="btn btn-sm" onClick={handleCreateCategory}>
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="p-sup">Fournisseur</label>
                <select id="p-sup" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                  <option value="">— aucun —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input
                    placeholder="Nouveau fournisseur…"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    style={{ flex: 1, padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)' }}
                  />
                  <button type="button" className="btn btn-sm" onClick={handleCreateSupplier}>
                    Ajouter
                  </button>
                </div>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer le produit'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
