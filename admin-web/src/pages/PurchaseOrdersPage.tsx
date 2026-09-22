import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Product, PurchaseOrder, Shop, Supplier } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconSend } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';

const STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  ordered: 'Commandée',
  partially_received: 'Partiellement reçue',
  received: 'Reçue',
  cancelled: 'Annulée',
};
const STATUS_BADGE: Record<PurchaseOrder['status'], string> = {
  ordered: 'neutral',
  partially_received: 'warn',
  received: 'ok',
  cancelled: 'bad',
};

interface OrderLine {
  product_id: string;
  quantity: string;
  unit_cost: string;
}

function emptyLine(): OrderLine {
  return { product_id: '', quantity: '1', unit_cost: '' };
}

function orderTotal(order: PurchaseOrder): number {
  return (order.items ?? []).reduce((sum, i) => sum + Number(i.unit_cost) * i.quantity_ordered, 0);
}

export function PurchaseOrdersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [shopId, setShopId] = useState(user?.shop_id ? String(user.shop_id) : '');
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<Record<number, { quantity: string; min_profit_amount: string }>>({});
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    if (statusFilter) params.set('status', statusFilter);
    api
      .get<PurchaseOrder[]>(`/purchase-orders?${params.toString()}`)
      .then(setOrders)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shopFilter, statusFilter, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
    api.get<Supplier[]>('/suppliers').then(setSuppliers);
    api.get<Product[]>('/products').then(setProducts);
  }, [isSuperAdmin]);

  function updateLine(i: number, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/purchase-orders', {
        shop_id: Number(shopId),
        supplier_id: Number(supplierId),
        expected_date: expectedDate || undefined,
        note: note || undefined,
        items: lines
          .filter((l) => l.product_id)
          .map((l) => ({
            product_id: Number(l.product_id),
            quantity: Number(l.quantity),
            unit_cost: Number(l.unit_cost),
          })),
      });
      setShowCreate(false);
      setSupplierId('');
      setExpectedDate('');
      setNote('');
      setLines([emptyLine()]);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function openReceive(order: PurchaseOrder) {
    setReceiveError(null);
    const inputs: Record<number, { quantity: string; min_profit_amount: string }> = {};
    for (const item of order.items ?? []) {
      inputs[item.id] = { quantity: String(item.remaining_quantity), min_profit_amount: '' };
    }
    setReceiveInputs(inputs);
    setReceivingOrder(order);
  }

  async function handleReceiveSubmit(e: FormEvent) {
    e.preventDefault();
    if (!receivingOrder) return;
    setReceiveError(null);
    setReceiveSubmitting(true);
    try {
      const items = Object.entries(receiveInputs)
        .filter(([, v]) => Number(v.quantity) > 0)
        .map(([itemId, v]) => ({
          purchase_order_item_id: Number(itemId),
          quantity: Number(v.quantity),
          min_profit_amount: v.min_profit_amount ? Number(v.min_profit_amount) : undefined,
        }));
      await api.post(`/purchase-orders/${receivingOrder.id}/receive`, { items });
      setReceivingOrder(null);
      load();
    } catch (err) {
      setReceiveError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setReceiveSubmitting(false);
    }
  }

  async function handleCancel(order: PurchaseOrder) {
    setActionError(null);
    if (!window.confirm(`Annuler la commande ${order.reference} ?`)) return;
    try {
      await api.post(`/purchase-orders/${order.id}/cancel`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    }
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Achats' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconSend />
          </div>
          <div>
            <h1>Bons de commande</h1>
            <p>Commande fournisseur → réception → stock, distinct de la réception directe</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvelle commande
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {actionError && <div className="alert error">{actionError}</div>}

      <div className="list-toolbar">
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
          {(Object.keys(STATUS_LABEL) as PurchaseOrder['status'][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Fournisseur</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Montant estimé</th>
              <th>Statut</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 7 : 6}>Chargement…</td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 7 : 6}>Aucun bon de commande.</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="mono" data-label="Référence">{o.reference}</td>
                <td data-label="Fournisseur">{o.supplier?.name ?? `#${o.supplier_id}`}</td>
                {isSuperAdmin && <td data-label="Boutique">{o.shop?.name ?? `#${o.shop_id}`}</td>}
                <td className="num" data-label="Montant estimé">{formatMoney(orderTotal(o))}</td>
                <td data-label="Statut">
                  <span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </td>
                <td data-label="Date">{formatDate(o.created_at)}</td>
                <td data-label="" className="row-actions">
                  {(o.status === 'ordered' || o.status === 'partially_received') && (
                    <>
                      <button type="button" className="btn btn-sm" onClick={() => openReceive(o)}>
                        Réceptionner
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleCancel(o)}>
                        Annuler
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle commande fournisseur" onClose={() => setShowCreate(false)} className="modal-wide">
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="po-shop">Boutique</label>
                  <select id="po-shop" value={shopId} onChange={(e) => setShopId(e.target.value)} required>
                    <option value="">— choisir —</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="po-supplier">Fournisseur</label>
                <select id="po-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                  <option value="">— choisir —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="po-date">Date de livraison prévue (optionnel)</label>
                <input id="po-date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="po-note">Note (optionnel)</label>
                <input id="po-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div className="section-title">Articles commandés</div>
            {lines.map((line, i) => (
              <div className="form-grid" key={i} style={{ marginBottom: 8 }}>
                <div className="field">
                  <label>Produit</label>
                  <select value={line.product_id} onChange={(e) => updateLine(i, { product_id: e.target.value })} required>
                    <option value="">— choisir —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Quantité</label>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Coût unitaire estimé</label>
                  <input
                    type="number"
                    min={0}
                    value={line.unit_cost}
                    onChange={(e) => updateLine(i, { unit_cost: e.target.value })}
                    required
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    style={{ alignSelf: 'end' }}
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕ Retirer
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              + Ajouter un article
            </button>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Envoi…' : 'Envoyer la commande'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {receivingOrder && (
        <Modal title={`Réceptionner — ${receivingOrder.reference}`} onClose={() => setReceivingOrder(null)} className="modal-wide">
          <form onSubmit={handleReceiveSubmit}>
            {receiveError && <div className="alert error">{receiveError}</div>}
            {(receivingOrder.items ?? []).map((item) => (
              <div className="form-grid" key={item.id} style={{ marginBottom: 8 }}>
                <div className="field">
                  <label>{item.product?.name ?? `Produit #${item.product_id}`}</label>
                  <p className="hint">
                    Commandé {item.quantity_ordered} — déjà reçu {item.quantity_received} — reste {item.remaining_quantity}
                  </p>
                </div>
                <div className="field">
                  <label>Quantité reçue maintenant</label>
                  <input
                    type="number"
                    min={0}
                    max={item.remaining_quantity}
                    value={receiveInputs[item.id]?.quantity ?? '0'}
                    onChange={(e) =>
                      setReceiveInputs((prev) => ({ ...prev, [item.id]: { ...prev[item.id], quantity: e.target.value } }))
                    }
                  />
                </div>
                <div className="field">
                  <label>Marge minimale (optionnel)</label>
                  <input
                    type="number"
                    min={0}
                    value={receiveInputs[item.id]?.min_profit_amount ?? ''}
                    onChange={(e) =>
                      setReceiveInputs((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], min_profit_amount: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setReceivingOrder(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={receiveSubmitting}>
                {receiveSubmitting ? 'Réception…' : 'Confirmer la réception'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
