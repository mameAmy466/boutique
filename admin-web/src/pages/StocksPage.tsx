import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Product, ProductBatch, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { BatchCodeModal } from '../components/BatchCodeModal';
import { formatDate, formatMoney } from '../lib/format';
import { IconBox } from '../components/DashboardIcons';

function emptyForm(defaultShopId: string) {
  return {
    product_id: '',
    shop_id: defaultShopId,
    purchase_cost: '',
    additional_costs: '0',
    min_profit_amount: '',
    quantity: '',
  };
}

export function StocksPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const canReceive = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';

  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showReceive, setShowReceive] = useState(false);
  const [codeBatch, setCodeBatch] = useState<ProductBatch | null>(null);
  const [form, setForm] = useState(() => emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([api.get<ProductBatch[]>('/stocks'), api.get<Product[]>('/products'), api.get<Shop[]>('/shops')])
      .then(([b, p, s]) => {
        setBatches(b);
        setProducts(p);
        setShops(s);
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

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Code lot</th>
              <th>Produit</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Coût de revient</th>
              <th>Prix minimum</th>
              <th>Disponible</th>
              <th>Reçu le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Chargement…</td>
              </tr>
            )}
            {!loading && batches.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Aucun lot en stock pour le moment.</td>
              </tr>
            )}
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="mono" data-label="Code lot">{b.batch_code}</td>
                <td data-label="Produit">{b.product?.name ?? `#${b.product_id}`}</td>
                {isSuperAdmin && <td data-label="Boutique">{b.shop?.name ?? `#${b.shop_id}`}</td>}
                <td className="num" data-label="Coût de revient">{formatMoney(b.cost_price)}</td>
                <td className="num" data-label="Prix minimum">{formatMoney(b.min_price)}</td>
                <td data-label="Disponible">
                  <span className={`badge ${b.quantity_available === 0 ? 'bad' : b.quantity_available <= 5 ? 'warn' : 'ok'}`}>
                    {b.quantity_available}
                  </span>
                </td>
                <td data-label="Reçu le">{formatDate(b.received_at)}</td>
                <td data-label="">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCodeBatch(b)}>
                    🏷️ Code
                  </button>
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
    </>
  );
}
