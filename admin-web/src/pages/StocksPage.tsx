import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Product, ProductBatch, Shop, Supplier } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { BatchCodeModal } from '../components/BatchCodeModal';
import { ReceptionVoucherModal } from '../components/ReceptionVoucherModal';
import { Breadcrumb } from '../components/Breadcrumb';
import { Pager } from '../components/Pager';
import { exportToCsv } from '../lib/csv';
import { formatDate, formatMoney, mediaUrl } from '../lib/format';
import {
  IconBox,
  IconBarcode,
  IconReceipt,
  IconClipboard,
  IconPencil,
  IconTrash,
  IconCamera,
} from '../components/DashboardIcons';

const PAGE_SIZE = 20;

function emptyForm(defaultShopId: string) {
  return {
    product_id: '',
    shop_id: defaultShopId,
    supplier_id: '',
    purchase_cost: '',
    additional_costs: '0',
    min_profit_amount: '',
    quantity: '',
  };
}

function emptyEditForm(batch: ProductBatch) {
  return {
    purchase_cost: batch.purchase_cost,
    additional_costs: batch.additional_costs,
    min_profit_amount: batch.min_profit_amount,
  };
}

export function StocksPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const canReceive = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';

  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showReceive, setShowReceive] = useState(false);
  const [codeBatch, setCodeBatch] = useState<ProductBatch | null>(null);
  const [voucherBatch, setVoucherBatch] = useState<ProductBatch | null>(null);
  const [form, setForm] = useState(() => emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editBatch, setEditBatch] = useState<ProductBatch | null>(null);
  const [editForm, setEditForm] = useState({ purchase_cost: '', additional_costs: '', min_profit_amount: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [adjustBatch, setAdjustBatch] = useState<ProductBatch | null>(null);
  const [adjustForm, setAdjustForm] = useState({ physical_quantity: '', reason: '' });
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [imageTargetId, setImageTargetId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.get<ProductBatch[]>('/stocks'),
      api.get<Product[]>('/products'),
      api.get<Shop[]>('/shops'),
      api.get<Supplier[]>('/suppliers'),
    ])
      .then(([b, p, s, sup]) => {
        setBatches(b);
        setProducts(p);
        setShops(s);
        setSuppliers(sup);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  const preview = useMemo(() => {
    const cost = Number(form.purchase_cost || 0) + Number(form.additional_costs || 0);
    const min = cost + Number(form.min_profit_amount || 0);
    return { cost, min };
  }, [form.purchase_cost, form.additional_costs, form.min_profit_amount]);

  async function handleReceive(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/stocks', {
        product_id: Number(form.product_id),
        shop_id: Number(form.shop_id),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
        purchase_cost: Number(form.purchase_cost),
        additional_costs: Number(form.additional_costs || 0),
        min_profit_amount: Number(form.min_profit_amount),
        quantity: Number(form.quantity),
      });
      setShowReceive(false);
      setForm(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
      loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  const editPreview = useMemo(() => {
    const cost = Number(editForm.purchase_cost || 0) + Number(editForm.additional_costs || 0);
    const min = cost + Number(editForm.min_profit_amount || 0);
    return { cost, min };
  }, [editForm.purchase_cost, editForm.additional_costs, editForm.min_profit_amount]);

  function openEdit(batch: ProductBatch) {
    setEditError(null);
    setEditForm(emptyEditForm(batch));
    setEditBatch(batch);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editBatch) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/stocks/${editBatch.id}`, {
        purchase_cost: Number(editForm.purchase_cost),
        additional_costs: Number(editForm.additional_costs || 0),
        min_profit_amount: Number(editForm.min_profit_amount),
      });
      setEditBatch(null);
      loadAll();
    } catch (err) {
      setEditError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setEditSubmitting(false);
    }
  }

  function openAdjust(batch: ProductBatch) {
    setAdjustError(null);
    setAdjustForm({ physical_quantity: String(batch.quantity_available), reason: '' });
    setAdjustBatch(batch);
  }

  async function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adjustBatch) return;
    setAdjustError(null);
    setAdjustSubmitting(true);
    try {
      await api.post(`/stocks/${adjustBatch.id}/adjust`, {
        physical_quantity: Number(adjustForm.physical_quantity),
        reason: adjustForm.reason,
      });
      setAdjustBatch(null);
      loadAll();
    } catch (err) {
      setAdjustError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setAdjustSubmitting(false);
    }
  }

  async function handleDelete(batch: ProductBatch) {
    setDeleteError(null);
    if (!window.confirm(`Supprimer définitivement le lot ${batch.batch_code} ?`)) return;
    setDeletingId(batch.id);
    try {
      await api.delete(`/stocks/${batch.id}`);
      loadAll();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setDeletingId(null);
    }
  }

  function pickProductImage(productId: number) {
    setImageTargetId(productId);
    imageInputRef.current?.click();
  }

  async function handleProductImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const productId = imageTargetId;
    e.target.value = '';
    if (!file || !productId) return;
    setDeleteError(null);
    const body = new FormData();
    body.append('image', file);
    try {
      await api.post(`/products/${productId}/image`, body);
      loadAll();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Impossible d'enregistrer l'image.");
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (
        needle &&
        !b.batch_code.toLowerCase().includes(needle) &&
        !(b.product?.name ?? '').toLowerCase().includes(needle)
      )
        return false;
      if (shopFilter && String(b.shop_id) !== shopFilter) return false;
      if (statusFilter === 'rupture' && b.quantity_available !== 0) return false;
      if (statusFilter === 'faible' && !(b.quantity_available > 0 && b.quantity_available <= 5)) return false;
      return true;
    });
  }, [batches, search, shopFilter, statusFilter]);

  const productCards = useMemo(() => {
    const map = new Map<
      number,
      { product: Product | undefined; batches: ProductBatch[]; qty: number }
    >();
    for (const batch of filtered) {
      const current = map.get(batch.product_id) ?? { product: batch.product, batches: [], qty: 0 };
      current.batches.push(batch);
      current.qty += batch.quantity_available;
      if (!current.product && batch.product) current.product = batch.product;
        map.set(batch.product_id, current);
    }
    return [...map.entries()].map(([productId, value]) => ({
      productId,
      ...value,
      minPrice: Math.min(...value.batches.map((batch) => Number(batch.min_price))),
    }));
  }, [filtered]);

  const selectedProduct = productCards.find((card) => card.productId === selectedProductId) ?? null;
  const catalogProduct = products.find((p) => p.id === selectedProductId) ?? selectedProduct?.product ?? null;

  const visibleLots = useMemo(() => {
    if (!selectedProductId) return filtered;
    return filtered.filter((batch) => batch.product_id === selectedProductId);
  }, [filtered, selectedProductId]);

  const lastPage = Math.max(1, Math.ceil(visibleLots.length / PAGE_SIZE));
  const pageItems = visibleLots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, shopFilter, statusFilter, selectedProductId]);

  useEffect(() => {
    if (productCards.length === 0) {
      if (selectedProductId !== null) setSelectedProductId(null);
      return;
    }
    if (!productCards.some((card) => card.productId === selectedProductId)) {
      setSelectedProductId(productCards[0].productId);
    }
  }, [productCards, selectedProductId]);

  function handleExport() {
    exportToCsv(
      'stock.csv',
      filtered.map((b) => ({
        code_lot: b.batch_code,
        produit: b.product?.name ?? '',
        boutique: b.shop?.name ?? '',
        fournisseur: b.supplier?.name ?? '',
        cout_de_revient: b.cost_price,
        prix_minimum: b.min_price,
        disponible: b.quantity_available,
        recu_le: b.received_at,
        recu_par: b.received_by_user?.name ?? '',
      })),
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Stocks & Produits' }, { label: 'Stock' }]} />
      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleProductImage}
      />

      <div className="catalog-stage">
        <div className="catalog-main">
          <div className="catalog-heading">
            <div>
              <h1>Stock</h1>
              <p>{batches.length} lot{batches.length > 1 ? 's' : ''} en circulation</p>
            </div>
            {canReceive && (
              <button className="btn btn-primary" onClick={() => setShowReceive(true)}>
                + Réceptionner un lot
              </button>
            )}
          </div>

          {loading && <div className="spinner-line">Chargement…</div>}

          <div className="catalog-stats">
            <div className="catalog-stat">
              <span className="label">Lots</span>
              <span className="value num">{filtered.length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Produits</span>
              <span className="value num">{productCards.length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Rupture</span>
              <span className="value num">{filtered.filter((b) => b.quantity_available === 0).length}</span>
            </div>
          </div>

          <section className="catalog-history">
            <h2>Lots en stock</h2>
            <div className="list-toolbar">
              <input
                type="text"
                placeholder="Rechercher un lot…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {isSuperAdmin && (
                <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
                  <option value="">Toutes les boutiques</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous statuts</option>
                <option value="rupture">En rupture</option>
                <option value="faible">Stock faible</option>
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filtered.length === 0}>
                ⬇️ CSV
              </button>
            </div>

            <div className="table-wrap table-scroll cards-sm">
              <table>
                <thead>
                  <tr>
                    <th>Code lot</th>
                    <th>Produit</th>
                    {isSuperAdmin && <th>Boutique</th>}
                    <th>Fournisseur</th>
                    <th>Coût</th>
                    <th>Prix min.</th>
                    <th>Dispo</th>
                    <th>Reçu le</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && visibleLots.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={isSuperAdmin ? 9 : 8}>Aucun lot ne correspond.</td>
                    </tr>
                  )}
                  {pageItems.map((b) => (
                    <tr
                      key={b.id}
                      className={selectedProductId === b.product_id ? 'is-selected' : undefined}
                      onClick={() => setSelectedProductId(b.product_id)}
                    >
                      <td className="mono" data-label="Code lot">{b.batch_code}</td>
                      <td data-label="Produit">{b.product?.name ?? `#${b.product_id}`}</td>
                      {isSuperAdmin && <td data-label="Boutique">{b.shop?.name ?? `#${b.shop_id}`}</td>}
                      <td data-label="Fournisseur">{b.supplier?.name ?? '—'}</td>
                      <td className="num" data-label="Coût">{formatMoney(b.cost_price)}</td>
                      <td className="num" data-label="Prix min.">{formatMoney(b.min_price)}</td>
                      <td data-label="Dispo">
                        <span className={`badge ${b.quantity_available === 0 ? 'bad' : b.quantity_available <= 5 ? 'warn' : 'ok'}`}>
                          {b.quantity_available}
                        </span>
                      </td>
                      <td data-label="Reçu le">{formatDate(b.received_at)}</td>
                      <td data-label="Actions" className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn btn-icon" onClick={() => setCodeBatch(b)} title="Code-barres" aria-label="Code-barres">
                          <IconBarcode />
                        </button>
                        <button type="button" className="btn btn-icon" onClick={() => setVoucherBatch(b)} title="Bon de réception" aria-label="Bon de réception">
                          <IconReceipt />
                        </button>
                        {canReceive && (
                          <>
                            <button type="button" className="btn btn-icon" onClick={() => openAdjust(b)} title="Ajuster" aria-label="Ajuster">
                              <IconClipboard />
                            </button>
                            <button type="button" className="btn btn-icon" onClick={() => openEdit(b)} title="Modifier" aria-label="Modifier">
                              <IconPencil />
                            </button>
                            <button
                              type="button"
                              className="btn btn-icon danger"
                              disabled={deletingId === b.id}
                              onClick={() => handleDelete(b)}
                              title={deletingId === b.id ? 'Suppression…' : 'Supprimer'}
                              aria-label={deletingId === b.id ? 'Suppression…' : 'Supprimer'}
                            >
                              <IconTrash />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} lastPage={lastPage} total={visibleLots.length} onChange={setPage} />
          </section>
        </div>

        <aside className="catalog-aside">
          <h2>Fiche produit</h2>
          {selectedProduct ? (
            <>
              <div className="catalog-aside-block">
                <span className="label">Référence</span>
                <div className="catalog-aside-box">{catalogProduct?.reference ?? 'Sans référence'}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Catégorie</span>
                <div className="catalog-aside-box">
                  {catalogProduct?.category?.name ?? '—'}
                  {catalogProduct?.brand ? ` · ${catalogProduct.brand}` : ''}
                </div>
              </div>
              <div className="catalog-aside-product">
                <div className="catalog-aside-thumb">
                  {mediaUrl(selectedProduct.product?.image_url) ? (
                    <img
                      src={mediaUrl(selectedProduct.product?.image_url) ?? ''}
                      alt={selectedProduct.product?.name ?? 'Produit'}
                    />
                  ) : (
                    <div className="stock-card-placeholder">
                      <IconBox />
                    </div>
                  )}
                  {canReceive && (
                    <button
                      type="button"
                      className="stock-card-photo"
                      title="Photo du produit"
                      aria-label="Photo du produit"
                      onClick={() => pickProductImage(selectedProduct.productId)}
                    >
                      <IconCamera />
                    </button>
                  )}
                </div>
                <div>
                  <strong>{selectedProduct.product?.name ?? `Produit #${selectedProduct.productId}`}</strong>
                  <span>
                    {selectedProduct.batches.length} lot{selectedProduct.batches.length > 1 ? 's' : ''} · {catalogProduct?.unit ?? 'unité'}
                  </span>
                </div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Stock total</span>
                  <span className="num">{selectedProduct.qty}</span>
                </div>
                <div>
                  <span>Seuil min.</span>
                  <span className="num">{catalogProduct?.min_stock ?? '—'}</span>
                </div>
                <div className="total">
                  <span>Prix min.</span>
                  <span className="num">{Number.isFinite(selectedProduct.minPrice) ? formatMoney(selectedProduct.minPrice) : '—'}</span>
                </div>
              </div>
              {canReceive && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setForm((current) => ({ ...current, product_id: String(selectedProduct.productId) }));
                    setShowReceive(true);
                  }}
                >
                  Réceptionner
                </button>
              )}
            </>
          ) : (
            <p className="catalog-empty">Sélectionne un produit pour voir sa fiche.</p>
          )}
        </aside>
      </div>

      {showReceive && (
        <Modal title="Réceptionner un lot" onClose={() => setShowReceive(false)}>
          <form onSubmit={handleReceive}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="s-product">Produit</label>
                <select
                  id="s-product"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  required
                >
                  <option value="">— choisir —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.reference})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-shop">Boutique</label>
                <select
                  id="s-shop"
                  value={form.shop_id}
                  onChange={(e) => setForm({ ...form, shop_id: e.target.value })}
                  disabled={!isSuperAdmin}
                  required
                >
                  <option value="">— choisir —</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-supplier">Fournisseur</label>
                <select
                  id="s-supplier"
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                >
                  <option value="">— non renseigné —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-cost">Prix d'achat unitaire</label>
                <input
                  id="s-cost"
                  type="number"
                  min={0}
                  value={form.purchase_cost}
                  onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="s-extra">Frais associés (transport…)</label>
                <input
                  id="s-extra"
                  type="number"
                  min={0}
                  value={form.additional_costs}
                  onChange={(e) => setForm({ ...form, additional_costs: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="s-profit">Bénéfice minimum unitaire</label>
                <input
                  id="s-profit"
                  type="number"
                  min={0}
                  value={form.min_profit_amount}
                  onChange={(e) => setForm({ ...form, min_profit_amount: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="s-qty">Quantité reçue</label>
                <input
                  id="s-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="alert success" style={{ marginTop: 14 }}>
              Coût de revient calculé : <strong className="num">{formatMoney(preview.cost)}</strong> · Prix minimum de
              vente : <strong className="num">{formatMoney(preview.min)}</strong>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowReceive(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Enregistrement…' : 'Réceptionner'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {codeBatch && <BatchCodeModal batch={codeBatch} onClose={() => setCodeBatch(null)} />}

      {voucherBatch && (
        <ReceptionVoucherModal batch={voucherBatch} shop={voucherBatch.shop ?? null} onClose={() => setVoucherBatch(null)} />
      )}

      {editBatch && (
        <Modal title={`Modifier le lot ${editBatch.batch_code}`} onClose={() => setEditBatch(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert error">{editError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="e-cost">Prix d'achat unitaire</label>
                <input
                  id="e-cost"
                  type="number"
                  min={0}
                  value={editForm.purchase_cost}
                  onChange={(e) => setEditForm({ ...editForm, purchase_cost: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="e-extra">Frais associés (transport…)</label>
                <input
                  id="e-extra"
                  type="number"
                  min={0}
                  value={editForm.additional_costs}
                  onChange={(e) => setEditForm({ ...editForm, additional_costs: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="e-profit">Bénéfice minimum unitaire</label>
                <input
                  id="e-profit"
                  type="number"
                  min={0}
                  value={editForm.min_profit_amount}
                  onChange={(e) => setEditForm({ ...editForm, min_profit_amount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="alert success" style={{ marginTop: 14 }}>
              Coût de revient calculé : <strong className="num">{formatMoney(editPreview.cost)}</strong> · Prix minimum
              de vente : <strong className="num">{formatMoney(editPreview.min)}</strong>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Cette correction ne change pas la quantité disponible ({editBatch.quantity_available}).
            </p>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditBatch(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                {editSubmitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {adjustBatch && (
        <Modal title={`Ajuster le lot ${adjustBatch.batch_code}`} onClose={() => setAdjustBatch(null)}>
          <form onSubmit={handleAdjustSubmit}>
            {adjustError && <div className="alert error">{adjustError}</div>}
            <p className="hint" style={{ marginBottom: 12 }}>
              À utiliser après un comptage physique du stock. Quantité système actuelle :{' '}
              <strong>{adjustBatch.quantity_available}</strong>.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="a-qty">Quantité physique comptée</label>
                <input
                  id="a-qty"
                  type="number"
                  min={0}
                  value={adjustForm.physical_quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, physical_quantity: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="a-reason">Motif de la correction</label>
                <input
                  id="a-reason"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="Ex : erreur de comptage à la réception"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAdjustBatch(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={adjustSubmitting}>
                {adjustSubmitting ? 'Enregistrement…' : 'Ajuster le stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
