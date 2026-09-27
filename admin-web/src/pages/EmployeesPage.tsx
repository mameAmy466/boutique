import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Employee, EmployeeFiche, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconUsers } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';

const STATUS_LABEL = { active: 'Actif', inactive: 'Inactif' } as const;
const STATUS_BADGE = { active: 'ok', inactive: 'neutral' } as const;

function emptyForm(shopId: string) {
  return { shop_id: shopId, name: '', position: '', phone: '', address: '', hire_date: '', base_salary: '', note: '' };
}

export function EmployeesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState(emptyForm(''));
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [ficheEmployee, setFicheEmployee] = useState<EmployeeFiche | null>(null);
  const [ficheLoading, setFicheLoading] = useState(false);
  const [ficheError, setFicheError] = useState<string | null>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    if (statusFilter) params.set('status', statusFilter);
    api
      .get<Employee[]>(`/employees?${params.toString()}`)
      .then(setEmployees)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shopFilter, statusFilter, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  function closeCreateModal() {
    setShowCreate(false);
    setForm(emptyForm(user?.shop_id ? String(user.shop_id) : ''));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/employees', {
        shop_id: Number(form.shop_id),
        name: form.name,
        position: form.position || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        hire_date: form.hire_date || undefined,
        base_salary: form.base_salary ? Number(form.base_salary) : undefined,
        note: form.note || undefined,
      });
      closeCreateModal();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(employee: Employee) {
    setEditError(null);
    setEditForm({
      shop_id: String(employee.shop_id),
      name: employee.name,
      position: employee.position ?? '',
      phone: employee.phone ?? '',
      address: employee.address ?? '',
      hire_date: employee.hire_date ?? '',
      base_salary: employee.base_salary ?? '',
      note: employee.note ?? '',
    });
    setEditingEmployee(employee);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/employees/${editingEmployee.id}`, {
        name: editForm.name,
        position: editForm.position || undefined,
        phone: editForm.phone || undefined,
        address: editForm.address || undefined,
        hire_date: editForm.hire_date || undefined,
        base_salary: editForm.base_salary ? Number(editForm.base_salary) : undefined,
        note: editForm.note || undefined,
      });
      setEditingEmployee(null);
      load();
      if (ficheEmployee?.id === editingEmployee.id) openFiche(editingEmployee.id);
    } catch (err) {
      setEditError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function toggleStatus(employee: Employee) {
    try {
      await api.put(`/employees/${employee.id}`, { status: employee.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    }
  }

  async function handleDelete(employee: Employee) {
    setDeleteError(null);
    if (!window.confirm(`Supprimer ${employee.name} ?`)) return;
    setDeletingId(employee.id);
    try {
      await api.delete(`/employees/${employee.id}`);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setDeletingId(null);
    }
  }

  function openFiche(employeeId: number) {
    setFicheError(null);
    setFicheLoading(true);
    setFicheEmployee(null);
    api
      .get<EmployeeFiche>(`/employees/${employeeId}`)
      .then(setFicheEmployee)
      .catch((err) => setFicheError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setFicheLoading(false));
  }

  function openPayment() {
    setPayError(null);
    setPayAmount(ficheEmployee?.base_salary ?? '');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote('');
    setShowPayment(true);
  }

  async function handlePaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!ficheEmployee) return;
    setPayError(null);
    setPaySubmitting(true);
    try {
      await api.post('/expenses', {
        shop_id: ficheEmployee.shop_id,
        category: 'salaires',
        employee_id: ficheEmployee.id,
        label: `Salaire — ${ficheEmployee.name}`,
        amount: Number(payAmount),
        expense_date: payDate,
        note: payNote || undefined,
      });
      setShowPayment(false);
      openFiche(ficheEmployee.id);
    } catch (err) {
      setPayError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setPaySubmitting(false);
    }
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Tiers' }, { label: 'Employés' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconUsers />
          </div>
          <div>
            <h1>Employés</h1>
            <p>Personnel de la boutique et paiements de salaire</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvel employé
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

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
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </select>
      </div>

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Poste</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Téléphone</th>
              <th>Salaire de base</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 7 : 6}>Chargement…</td>
              </tr>
            )}
            {!loading && employees.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 7 : 6}>Aucun employé enregistré.</td>
              </tr>
            )}
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td data-label="Nom">
                  <button type="button" className="link-button" onClick={() => openFiche(emp.id)}>
                    {emp.name}
                  </button>
                </td>
                <td data-label="Poste">{emp.position || '—'}</td>
                {isSuperAdmin && (
                  <td data-label="Boutique">{shops.find((s) => s.id === emp.shop_id)?.name ?? `#${emp.shop_id}`}</td>
                )}
                <td data-label="Téléphone">{emp.phone || '—'}</td>
                <td className="num" data-label="Salaire de base">{emp.base_salary ? formatMoney(emp.base_salary) : '—'}</td>
                <td data-label="Statut">
                  <span className={`badge ${STATUS_BADGE[emp.status]}`}>{STATUS_LABEL[emp.status]}</span>
                </td>
                <td data-label="" className="row-actions">
                  <button type="button" className="btn btn-sm" onClick={() => openEdit(emp)}>
                    Modifier
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleStatus(emp)}>
                    {emp.status === 'active' ? 'Désactiver' : 'Réactiver'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={deletingId === emp.id}
                    onClick={() => handleDelete(emp)}
                  >
                    {deletingId === emp.id ? '…' : 'Supprimer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvel employé" onClose={closeCreateModal}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="emp-shop">Boutique</label>
                  <select id="emp-shop" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })} required>
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
                <label htmlFor="emp-name">Nom complet</label>
                <input id="emp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="emp-position">Poste (optionnel)</label>
                <input id="emp-position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="emp-phone">Téléphone (optionnel)</label>
                <input id="emp-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="emp-address">Adresse (optionnel)</label>
                <input id="emp-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="emp-hire">Date d'embauche (optionnel)</label>
                <input id="emp-hire" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="emp-salary">Salaire de base (optionnel)</label>
                <input
                  id="emp-salary"
                  type="number"
                  min={0}
                  value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="emp-note">Note (optionnel)</label>
                <input id="emp-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={closeCreateModal}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingEmployee && (
        <Modal title={`Modifier ${editingEmployee.name}`} onClose={() => setEditingEmployee(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert error">{editError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="eemp-name">Nom complet</label>
                <input id="eemp-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="eemp-position">Poste</label>
                <input id="eemp-position" value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="eemp-phone">Téléphone</label>
                <input id="eemp-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="eemp-address">Adresse</label>
                <input id="eemp-address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="eemp-hire">Date d'embauche</label>
                <input id="eemp-hire" type="date" value={editForm.hire_date} onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="eemp-salary">Salaire de base</label>
                <input
                  id="eemp-salary"
                  type="number"
                  min={0}
                  value={editForm.base_salary}
                  onChange={(e) => setEditForm({ ...editForm, base_salary: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="eemp-note">Note</label>
                <input id="eemp-note" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingEmployee(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                {editSubmitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {(ficheLoading || ficheEmployee || ficheError) && (
        <Modal title={ficheEmployee ? `Fiche employé — ${ficheEmployee.name}` : 'Fiche employé'} onClose={() => setFicheEmployee(null)}>
          {ficheLoading && <p>Chargement…</p>}
          {ficheError && <div className="alert error">{ficheError}</div>}
          {ficheEmployee && (
            <>
              <div className="catalog-aside-block">
                <span className="label">Poste</span>
                <div className="catalog-aside-box">{ficheEmployee.position || '—'}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Téléphone</span>
                <div className="catalog-aside-box">{ficheEmployee.phone || '—'}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Adresse</span>
                <div className="catalog-aside-box">{ficheEmployee.address || '—'}</div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Date d'embauche</span>
                  <span>{ficheEmployee.hire_date ? formatDate(ficheEmployee.hire_date) : '—'}</span>
                </div>
                <div>
                  <span>Salaire de base</span>
                  <span>{ficheEmployee.base_salary ? formatMoney(ficheEmployee.base_salary) : '—'}</span>
                </div>
                <div className="total">
                  <span>Payé cette année</span>
                  <span>{formatMoney(ficheEmployee.total_paid_this_year)}</span>
                </div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Historique des paiements de salaire</span>
                <div className="catalog-aside-box" style={{ display: 'grid', gap: 6 }}>
                  {ficheEmployee.salary_payments.length === 0 && <span className="hint">Aucun paiement enregistré.</span>}
                  {ficheEmployee.salary_payments.map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{formatDate(p.expense_date)} {p.note ? `— ${p.note}` : ''}</span>
                      <span className="num">{formatMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setFicheEmployee(null)}>
                  Fermer
                </button>
                <button type="button" className="btn btn-primary" onClick={openPayment}>
                  + Paiement de salaire
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {showPayment && ficheEmployee && (
        <Modal title={`Paiement de salaire — ${ficheEmployee.name}`} onClose={() => setShowPayment(false)}>
          <form onSubmit={handlePaySubmit}>
            {payError && <div className="alert error">{payError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="pay-amount">Montant</label>
                <input
                  id="pay-amount"
                  type="number"
                  min={0}
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
              <button type="button" className="btn btn-ghost" onClick={() => setShowPayment(false)}>
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
