import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Product, ProductBatch, Shop, Supplier } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { BatchCodeModal } from '../components/BatchCodeModal';
import { ReceptionVoucherModal } from '../components/ReceptionVoucherModal';
import { formatDate, formatMoney } from '../lib/format';
import { IconBox } from '../components/DashboardIcons';

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

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon">
            <IconBox />
          </div>
          <div>
            <h1>Stock</h1>
            <p>{batches.length} lot{batches.length > 1 ? 's' : ''} en circulation</p>
          </div>
        </div>
        {canReceive && (
          <button className="btn btn-primary" onClick={() => setShowReceive(true)}>
            + Réceptionner un lot
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Code lot</th>
              <th>Produit</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Fournisseur</th>
              <th>Coût de revient</th>
              <th>Prix minimum</th>
              <th>Disponible</th>
              <th>Reçu le</th>
              <th>Reçu par</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 10 : 9}>Chargement…</td>
              </tr>
            )}
            {!loading && batches.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 10 : 9}>Aucun lot en stock pour le moment.</td>
              </tr>
            )}
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="mono" data-label="Code lot">{b.batch_code}</td>
                <td data-label="Produit">{b.product?.name ?? `#${b.product_id}`}</td>
                {isSuperAdmin && <td data-label="Boutique">{b.shop?.name ?? `#${b.shop_id}`}</td>}
                <td data-label="Fournisseur">{b.supplier?.name ?? '—'}</td>
                <td className="num" data-label="Coût de revient">{formatMoney(b.cost_price)}</td>
                <td className="num" data-label="Prix minimum">{formatMoney(b.min_price)}</td>
                <td data-label="Disponible">
                  <span className={`badge ${b.quantity_available === 0 ? 'bad' : b.quantity_available <= 5 ? 'warn' : 'ok'}`}>
                    {b.quantity_available}
                  </span>
                </td>
                <td data-label="Reçu le">{formatDate(b.received_at)}</td>
                <td data-label="Reçu par">{b.received_by_user?.name ?? '—'}</td>
                <td data-label="" className="row-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCodeBatch(b)}>
                    🏷️ Code
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setVoucherBatch(b)}>
                    🧾 Bon
                  </button>
                  {canReceive && (
                    <>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => openAdjust(b)}>
                        📋 Ajuster
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(b)}>
                        ✏️ Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost danger"
                        disabled={deletingId === b.id}
                        onClick={() => handleDelete(b)}
                      >
                        🗑️ {deletingId === b.id ? '…' : 'Supprimer'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
