import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Expense, ExpenseCategory, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconReceipt } from '../components/DashboardIcons';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL } from '../lib/expenseCategories';
import { exportToCsv } from '../lib/csv';
import { formatDate, formatMoney } from '../lib/format';

function emptyForm(shopId: string) {
  return { shop_id: shopId, category: 'loyer' as ExpenseCategory, label: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), note: '' };
}

export function ExpensesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shopFilter, setShopFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState(emptyForm(''));
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);
    api
      .get<Expense[]>(`/expenses?${params.toString()}`)
      .then(setExpenses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shopFilter, categoryFilter, fromFilter, toFilter]);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  const total = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses]);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  function handleExport() {
    exportToCsv(
      'depenses.csv',
      expenses.map((e) => ({
        date: e.expense_date,
        categorie: EXPENSE_CATEGORY_LABEL[e.category],
        libelle: e.label ?? '',
        montant: e.amount,
        note: e.note ?? '',
      })),
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/expenses', {
        shop_id: Number(form.shop_id),
        category: form.category,
        label: form.label || undefined,
        amount: Number(form.amount),
        expense_date: form.expense_date,
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

  function openEdit(expense: Expense) {
    setEditError(null);
    setEditForm({
      shop_id: String(expense.shop_id),
      category: expense.category,
      label: expense.label ?? '',
      amount: expense.amount,
      expense_date: expense.expense_date.slice(0, 10),
      note: expense.note ?? '',
    });
    setEditExpense(expense);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editExpense) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/expenses/${editExpense.id}`, {
        category: editForm.category,
        label: editForm.label || undefined,
        amount: Number(editForm.amount),
        expense_date: editForm.expense_date,
        note: editForm.note || undefined,
      });
      setEditExpense(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(expense: Expense) {
    setDeleteError(null);
    if (!window.confirm('Supprimer cette dépense ?')) return;
    setDeletingId(expense.id);
    try {
      await api.delete(`/expenses/${expense.id}`);
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
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Dépenses' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconReceipt />
          </div>
          <div>
            <h1>Dépenses</h1>
            <p>Loyer, électricité, eau, salaires… par boutique</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvelle dépense
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <div className="catalog-stats" style={{ marginBottom: 16 }}>
        <div className="catalog-stat">
          <span className="label">Total ({expenses.length})</span>
          <span className="value num">{formatMoney(total)}</span>
        </div>
        {byCategory.slice(0, 3).map(([cat, amount]) => (
          <div className="catalog-stat" key={cat}>
            <span className="label">{EXPENSE_CATEGORY_LABEL[cat as ExpenseCategory]}</span>
            <span className="value num">{formatMoney(amount)}</span>
          </div>
        ))}
      </div>

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
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Toutes catégories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input type="date" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} aria-label="Du" />
        <input type="date" value={toFilter} onChange={(e) => setToFilter(e.target.value)} aria-label="Au" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport} disabled={expenses.length === 0}>
          ⬇️ Exporter CSV
        </button>
      </div>

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Catégorie</th>
              <th>Libellé</th>
              <th>Montant</th>
              <th>Enregistré par</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 7 : 6}>Chargement…</td>
              </tr>
            )}
            {!loading && expenses.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 7 : 6}>Aucune dépense ne correspond.</td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id}>
                <td data-label="Date">{formatDate(e.expense_date)}</td>
                {isSuperAdmin && (
                  <td data-label="Boutique">{shops.find((s) => s.id === e.shop_id)?.name ?? `#${e.shop_id}`}</td>
                )}
                <td data-label="Catégorie">
                  <span className="badge neutral">{EXPENSE_CATEGORY_LABEL[e.category]}</span>
                </td>
                <td data-label="Libellé">{e.label || '—'}</td>
                <td className="num" data-label="Montant">{formatMoney(e.amount)}</td>
                <td data-label="Enregistré par">{e.created_by_user?.name ?? '—'}</td>
                <td data-label="" className="row-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(e)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={deletingId === e.id}
                    onClick={() => handleDelete(e)}
                  >
                    {deletingId === e.id ? '…' : 'Supprimer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle dépense" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="exp-shop">Boutique</label>
                  <select id="exp-shop" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })} required>
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
                <label htmlFor="exp-category">Catégorie</label>
                <select
                  id="exp-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="exp-amount">Montant</label>
                <input
                  id="exp-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="exp-date">Date</label>
                <input
                  id="exp-date"
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="exp-label">Libellé (optionnel)</label>
                <input id="exp-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="exp-note">Note (optionnel)</label>
                <input id="exp-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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

      {editExpense && (
        <Modal title="Modifier la dépense" onClose={() => setEditExpense(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert error">{editError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="eexp-category">Catégorie</label>
                <select
                  id="eexp-category"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ExpenseCategory })}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="eexp-amount">Montant</label>
                <input
                  id="eexp-amount"
                  type="number"
                  min={0}
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="eexp-date">Date</label>
                <input
                  id="eexp-date"
                  type="date"
                  value={editForm.expense_date}
                  onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="eexp-label">Libellé (optionnel)</label>
                <input id="eexp-label" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="eexp-note">Note (optionnel)</label>
                <input id="eexp-note" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditExpense(null)}>
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
