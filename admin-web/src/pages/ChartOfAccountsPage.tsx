import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Account, AccountType } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconClipboard } from '../components/DashboardIcons';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL } from '../lib/accountTypes';

function emptyForm() {
  return { code: '', name: '', type: 'charge' as AccountType };
}

export function ChartOfAccountsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get<Account[]>('/accounts')
      .then(setAccounts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/accounts', form);
      setShowCreate(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(account: Account) {
    setEditError(null);
    setEditForm({ code: account.code, name: account.name, type: account.type });
    setEditAccount(account);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editAccount) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/accounts/${editAccount.id}`, editForm);
      setEditAccount(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(account: Account) {
    setDeleteError(null);
    if (!window.confirm(`Supprimer le compte ${account.code} — ${account.name} ?`)) return;
    setDeletingId(account.id);
    try {
      await api.delete(`/accounts/${account.id}`);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Plan comptable' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-blue">
            <IconClipboard />
          </div>
          <div>
            <h1>Plan comptable</h1>
            <p>Comptes disponibles pour les écritures — base SYSCOHADA à faire valider par un comptable</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouveau compte
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={4}>Chargement…</td>
              </tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr className="empty-row">
                <td colSpan={4}>Aucun compte pour le moment.</td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="mono" data-label="Code">{a.code}</td>
                <td data-label="Libellé">{a.name}</td>
                <td data-label="Type">
                  <span className="badge neutral">{ACCOUNT_TYPE_LABEL[a.type]}</span>
                </td>
                <td data-label="" className="row-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(a)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={deletingId === a.id}
                    onClick={() => handleDelete(a)}
                  >
                    {deletingId === a.id ? '…' : 'Supprimer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouveau compte" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="acc-code">Code</label>
                <input id="acc-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="acc-name">Libellé</label>
                <input id="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="acc-type">Type</label>
                <select id="acc-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editAccount && (
        <Modal title={`Modifier ${editAccount.code}`} onClose={() => setEditAccount(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert error">{editError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="eacc-code">Code</label>
                <input id="eacc-code" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="eacc-name">Libellé</label>
                <input id="eacc-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="eacc-type">Type</label>
                <select
                  id="eacc-type"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as AccountType })}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOUNT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditAccount(null)}>
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
