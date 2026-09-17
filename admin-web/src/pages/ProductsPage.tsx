import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Category, Product, Supplier } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { Pager } from '../components/Pager';
import { exportToCsv } from '../lib/csv';
import { mediaUrl } from '../lib/format';
import { IconBox, IconCamera } from '../components/DashboardIcons';

const PAGE_SIZE = 12;

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
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
      if (imageFile) {
        const body = new FormData();
        body.append('name', form.name);
        body.append('reference', form.reference);
        if (form.category_id) body.append('category_id', form.category_id);
        if (form.supplier_id) body.append('supplier_id', form.supplier_id);
        if (form.brand) body.append('brand', form.brand);
        if (form.unit) body.append('unit', form.unit);
        if (form.min_stock) body.append('min_stock', form.min_stock);
        if (form.max_stock) body.append('max_stock', form.max_stock);
        body.append('image', imageFile);
        await api.post('/products', body);
      } else {
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
      }
      setShowCreate(false);
      setForm(emptyForm());
      setImageFile(null);
      loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? '—';
  const supplierName = (id: number | null) => suppliers.find((s) => s.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((p) => {
      if (needle && !p.name.toLowerCase().includes(needle) && !p.reference.toLowerCase().includes(needle)) return false;
      if (categoryFilter && String(p.category_id) !== categoryFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedProductId !== null) setSelectedProductId(null);
      return;
    }
    if (!filtered.some((p) => p.id === selectedProductId)) {
      setSelectedProductId(filtered[0].id);
    }
  }, [filtered, selectedProductId]);

  function pickProductImage() {
    if (!selectedProductId) return;
    imageInputRef.current?.click();
  }

  async function handleProductImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const productId = selectedProductId;
    e.target.value = '';
    if (!file || !productId) return;
    setImageError(null);
    const body = new FormData();
    body.append('image', file);
    try {
      await api.post(`/products/${productId}/image`, body);
      loadAll();
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Impossible d'enregistrer l'image.");
    }
  }

  function handleExport() {
    exportToCsv(
      'produits.csv',
      filtered.map((p) => ({
        reference: p.reference,
        nom: p.name,
        marque: p.brand ?? '',
        categorie: p.category?.name ?? categoryName(p.category_id),
        fournisseur: p.supplier?.name ?? supplierName(p.supplier_id),
        unite: p.unit,
        seuil_min: p.min_stock,
        statut: p.status,
      })),
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Stocks & Produits' }, { label: 'Produits' }]} />
      {error && <div className="alert error">{error}</div>}
      {imageError && <div className="alert error">{imageError}</div>}

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleProductImage} />

      <div className="catalog-stage">
        <div className="catalog-main">
          <div className="catalog-heading">
            <div>
              <h1>Produits</h1>
              <p>{products.length} article{products.length > 1 ? 's' : ''} au catalogue</p>
            </div>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + Nouveau produit
              </button>
            )}
          </div>

          {loading && <div className="spinner-line">Chargement…</div>}

          <div className="catalog-stats">
            <div className="catalog-stat">
              <span className="label">Produits</span>
              <span className="value num">{filtered.length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Actifs</span>
              <span className="value num">{filtered.filter((p) => p.status === 'active').length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Inactifs</span>
              <span className="value num">{filtered.filter((p) => p.status === 'inactive').length}</span>
            </div>
          </div>

          <section className="catalog-history">
            <h2>Liste des produits</h2>
            <div className="list-toolbar">
              <input
                type="text"
                placeholder="Rechercher un produit…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Toutes catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filtered.length === 0}>
                ⬇️ CSV
              </button>
            </div>

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
                  {!loading && filtered.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>Aucun produit ne correspond.</td>
                    </tr>
                  )}
                  {pageItems.map((p) => (
                    <tr
                      key={p.id}
                      className={selectedProductId === p.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedProductId(p.id)}
                    >
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
            <Pager page={page} lastPage={lastPage} total={filtered.length} onChange={setPage} />
          </section>
        </div>

        <aside className="catalog-aside">
          <h2>Fiche produit</h2>
          {selectedProduct ? (
            <>
              <div className="catalog-aside-block">
                <span className="label">Référence</span>
                <div className="catalog-aside-box">{selectedProduct.reference}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Catégorie</span>
                <div className="catalog-aside-box">
                  {selectedProduct.category?.name ?? categoryName(selectedProduct.category_id)}
                  {selectedProduct.brand ? ` · ${selectedProduct.brand}` : ''}
                </div>
              </div>
              <div className="catalog-aside-product">
                <div className="catalog-aside-thumb">
                  {mediaUrl(selectedProduct.image_url) ? (
                    <img src={mediaUrl(selectedProduct.image_url) ?? ''} alt={selectedProduct.name} />
                  ) : (
                    <div className="stock-card-placeholder">
                      <IconBox />
                    </div>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="stock-card-photo"
                      title="Photo du produit"
                      aria-label="Photo du produit"
                      onClick={pickProductImage}
                    >
                      <IconCamera />
                    </button>
                  )}
                </div>
                <div>
                  <strong>{selectedProduct.name}</strong>
                  <span>
                    {selectedProduct.unit}
                    {selectedProduct.supplier?.name ? ` · ${selectedProduct.supplier.name}` : ''}
                  </span>
                </div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Fournisseur</span>
                  <span>{selectedProduct.supplier?.name ?? supplierName(selectedProduct.supplier_id)}</span>
                </div>
                <div>
                  <span>Seuil min.</span>
                  <span className="num">{selectedProduct.min_stock}</span>
                </div>
                <div className="total">
                  <span>Statut</span>
                  <span>{selectedProduct.status === 'active' ? 'Actif' : 'Inactif'}</span>
                </div>
              </div>
              {canManage && (
                <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  Nouveau produit
                </button>
              )}
            </>
          ) : (
            <p className="catalog-empty">Sélectionne un produit pour voir sa fiche.</p>
          )}
        </aside>
      </div>

      {showCreate && (
        <Modal title="Nouveau produit" onClose={() => { setShowCreate(false); setImageFile(null); }}>
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
              <div className="field">
                <label htmlFor="p-image">Photo</label>
                <input
                  id="p-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
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
              <button type="button" className="btn btn-ghost" onClick={() => { setShowCreate(false); setImageFile(null); }}>
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
