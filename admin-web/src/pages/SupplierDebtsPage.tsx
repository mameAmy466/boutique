import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Shop, Supplier, SupplierDebt } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconTruck } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';

const STATUS_LABEL: Record<SupplierDebt['status'], string> = {
  pending: 'À payer',
  partial: 'Partiel',
  paid: 'Soldée',
};
const STATUS_BADGE: Record<SupplierDebt['status'], string> = {
  pending: 'bad',
  partial: 'warn',
  paid: 'ok',
};

function emptyForm(shopId: string) {
  return { shop_id: shopId, supplier_id: '', amount: '', due_date: '', note: '' };
}

export function SupplierDebtsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [payingDebt, setPayingDebt] = useState<SupplierDebt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    api
      .get<SupplierDebt[]>(`/supplier-debts?${params.toString()}`)
      .then(setDebts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shopFilter, isSuperAdmin]);

  useEffect(() => {
    api.get<Supplier[]>('/suppliers').then(setSuppliers);
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/supplier-debts', {
        shop_id: Number(form.shop_id),
        supplier_id: Number(form.supplier_id),
        amount: Number(form.amount),
        due_date: form.due_date || undefined,
        note: form.note || undefined,
      });
      setShowCreate(false);
      setForm(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function openPayment(debt: SupplierDebt) {
    setPayError(null);
    setPayAmount('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote('');
    setPayingDebt(debt);
  }

  async function handlePaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!payingDebt) return;
    setPayError(null);
    setPaySubmitting(true);
    try {
      await api.post(`/supplier-debts/${payingDebt.id}/payments`, {
        amount: Number(payAmount),
        paid_at: payDate,
        note: payNote || undefined,
      });
      setPayingDebt(null);
      load();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleDelete(debt: SupplierDebt) {
    setDeleteError(null);
    if (!window.confirm('Supprimer cette dette ?')) return;
    setDeletingId(debt.id);
    try {
      await api.delete(`/supplier-debts/${debt.id}`);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Dettes fournisseurs' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-aqua">
            <IconTruck />
          </div>
          <div>
            <h1>Dettes fournisseurs</h1>
            <p>Ce que la boutique doit à ses fournisseurs, et le suivi des paiements</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvelle dette
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      {isSuperAdmin && (
        <div className="list-toolbar">
          <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
            <option value="">Toutes les boutiques</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Fournisseur</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Montant</th>
              <th>Payé</th>
              <th>Reste</th>
              <th>Statut</th>
              <th>Échéance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Chargement…</td>
              </tr>
            )}
            {!loading && debts.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Aucune dette fournisseur enregistrée.</td>
              </tr>
            )}
            {debts.map((d) => (
              <tr key={d.id}>
                <td data-label="Fournisseur">{d.supplier?.name ?? `#${d.supplier_id}`}</td>
                {isSuperAdmin && (
                  <td data-label="Boutique">{shops.find((s) => s.id === d.shop_id)?.name ?? `#${d.shop_id}`}</td>
                )}
                <td className="num" data-label="Montant">{formatMoney(d.amount)}</td>
                <td className="num" data-label="Payé">{formatMoney(d.paid_amount)}</td>
                <td className="num" data-label="Reste">{formatMoney(d.remaining)}</td>
                <td data-label="Statut">
                  <span className={`badge ${STATUS_BADGE[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                </td>
                <td data-label="Échéance">{d.due_date ? formatDate(d.due_date) : '—'}</td>
                <td data-label="" className="row-actions">
                  {d.status !== 'paid' && (
                    <button type="button" className="btn btn-sm" onClick={() => openPayment(d)}>
                      + Paiement
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={deletingId === d.id}
                    onClick={() => handleDelete(d)}
                  >
                    {deletingId === d.id ? '…' : 'Supprimer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle dette fournisseur" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            {suppliers.length === 0 && (
              <p className="hint">Aucun fournisseur enregistré — crée d'abord un fournisseur dans « Tiers ».</p>
            )}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="sd-shop">Boutique</label>
                  <select id="sd-shop" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })} required>
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
                <label htmlFor="sd-supplier">Fournisseur</label>
                <select
                  id="sd-supplier"
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  required
                >
                  <option value="">— choisir —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sd-amount">Montant dû</label>
                <input
                  id="sd-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="sd-due">Échéance (optionnel)</label>
                <input id="sd-due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sd-note">Note (optionnel)</label>
                <input id="sd-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || suppliers.length === 0}>
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payingDebt && (
        <Modal title={`Paiement — ${payingDebt.supplier?.name ?? ''}`} onClose={() => setPayingDebt(null)}>
          <form onSubmit={handlePaySubmit}>
            {payError && <div className="alert error">{payError}</div>}
            <p className="hint" style={{ marginBottom: 12 }}>
              Reste à payer : <strong>{formatMoney(payingDebt.remaining)}</strong>
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pay-amount">Montant payé</label>
                <input
                  id="pay-amount"
                  type="number"
                  min={0}
                  max={payingDebt.remaining}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="pay-date">Date</label>
                <input id="pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="pay-note">Note (optionnel)</label>
                <input id="pay-note" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPayingDebt(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={paySubmitting}>
                {paySubmitting ? 'Enregistrement…' : 'Enregistrer le paiement'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
