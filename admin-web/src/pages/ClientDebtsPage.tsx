import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { ClientDebt, Customer, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconBag } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';

const STATUS_LABEL: Record<ClientDebt['status'], string> = {
  pending: 'À recevoir',
  partial: 'Partiel',
  paid: 'Soldée',
};
const STATUS_BADGE: Record<ClientDebt['status'], string> = {
  pending: 'bad',
  partial: 'warn',
  paid: 'ok',
};

function emptyForm(shopId: string) {
  return { shop_id: shopId, customer_id: '', amount: '', due_date: '', note: '' };
}

function emptyCustomerForm(shopId: string) {
  return { shop_id: shopId, name: '', phone: '' };
}

export function ClientDebtsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [debts, setDebts] = useState<ClientDebt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm(user?.shop_id ? String(user.shop_id) : ''));
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerSubmitting, setCustomerSubmitting] = useState(false);

  const [payingDebt, setPayingDebt] = useState<ClientDebt | null>(null);
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
      .get<ClientDebt[]>(`/client-debts?${params.toString()}`)
      .then(setDebts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  function loadCustomers() {
    const params = new URLSearchParams();
    if (isSuperAdmin && form.shop_id) params.set('shop_id', form.shop_id);
    api.get<Customer[]>(`/customers?${params.toString()}`).then(setCustomers);
  }

  useEffect(load, [shopFilter, isSuperAdmin]);

  useEffect(() => {
    loadCustomers();
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, form.shop_id]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/client-debts', {
        shop_id: Number(form.shop_id),
        customer_id: Number(form.customer_id),
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

  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    setCustomerError(null);
    setCustomerSubmitting(true);
    try {
      const customer = await api.post<Customer>('/customers', {
        shop_id: Number(customerForm.shop_id),
        name: customerForm.name,
        phone: customerForm.phone || undefined,
      });
      setCustomers((prev) => [...prev, customer]);
      setForm((f) => ({ ...f, customer_id: String(customer.id) }));
      setShowNewCustomer(false);
      setCustomerForm(emptyCustomerForm(user?.shop_id ? String(user.shop_id) : ''));
    } catch (err) {
      setCustomerError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setCustomerSubmitting(false);
    }
  }

  function openPayment(debt: ClientDebt) {
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
      await api.post(`/client-debts/${payingDebt.id}/payments`, {
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

  async function handleDelete(debt: ClientDebt) {
    setDeleteError(null);
    if (!window.confirm('Supprimer cette créance ?')) return;
    setDeletingId(debt.id);
    try {
      await api.delete(`/client-debts/${debt.id}`);
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
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Créances clients' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconBag />
          </div>
          <div>
            <h1>Créances clients</h1>
            <p>Ventes en gros à crédit — ce que les clients doivent, et les paiements reçus</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvelle créance
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
              <th>Client</th>
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
                <td colSpan={isSuperAdmin ? 8 : 7}>Aucune créance client enregistrée.</td>
              </tr>
            )}
            {debts.map((d) => (
              <tr key={d.id}>
                <td data-label="Client">
                  {d.customer?.name ?? `#${d.customer_id}`}
                  {d.customer?.phone && <span className="hint" style={{ display: 'block' }}>{d.customer.phone}</span>}
                </td>
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
        <Modal title="Nouvelle créance client" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="cd-shop">Boutique</label>
                  <select
                    id="cd-shop"
                    value={form.shop_id}
                    onChange={(e) => setForm({ ...form, shop_id: e.target.value, customer_id: '' })}
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
              )}
              <div className="field">
                <label htmlFor="cd-customer">Client</label>
                <select
                  id="cd-customer"
                  value={form.customer_id}
                  onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                  required
                >
                  <option value="">— choisir —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `— ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setShowNewCustomer(true)}>
                  + Nouveau client
                </button>
              </div>
              <div className="field">
                <label htmlFor="cd-amount">Montant dû</label>
                <input
                  id="cd-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cd-due">Échéance (optionnel)</label>
                <input id="cd-due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="cd-note">Note (optionnel)</label>
                <input id="cd-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showNewCustomer && (
        <Modal title="Nouveau client" onClose={() => setShowNewCustomer(false)}>
          <form onSubmit={handleCreateCustomer}>
            {customerError && <div className="alert error">{customerError}</div>}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="nc-shop">Boutique</label>
                  <select
                    id="nc-shop"
                    value={customerForm.shop_id}
                    onChange={(e) => setCustomerForm({ ...customerForm, shop_id: e.target.value })}
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
              )}
              <div className="field">
                <label htmlFor="nc-name">Nom</label>
                <input
                  id="nc-name"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="nc-phone">Téléphone (optionnel)</label>
                <input
                  id="nc-phone"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowNewCustomer(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={customerSubmitting}>
                {customerSubmitting ? 'Création…' : 'Créer le client'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payingDebt && (
        <Modal title={`Paiement — ${payingDebt.customer?.name ?? ''}`} onClose={() => setPayingDebt(null)}>
          <form onSubmit={handlePaySubmit}>
            {payError && <div className="alert error">{payError}</div>}
            <p className="hint" style={{ marginBottom: 12 }}>
              Reste à recevoir : <strong>{formatMoney(payingDebt.remaining)}</strong>
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pay-amount">Montant reçu</label>
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
