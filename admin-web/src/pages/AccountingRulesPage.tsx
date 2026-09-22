import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, firstValidationError } from '../api/client';
import type { Account, AccountingEvent, AccountingJournal, AccountingRule, ExpenseCategory } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconSettings } from '../components/DashboardIcons';
import { ACCOUNTING_EVENTS, ACCOUNTING_EVENT_LABEL } from '../lib/accountingEvents';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL } from '../lib/expenseCategories';

interface RuleForm {
  event: AccountingEvent;
  category: ExpenseCategory | '';
  dynamic_leg: '' | 'debit' | 'credit';
  dynamic_journal: boolean;
  debit_account_id: string;
  credit_account_id: string;
  journal_id: string;
  note: string;
}

function formFromRule(rule: AccountingRule): RuleForm {
  return {
    event: rule.event,
    category: rule.category ?? '',
    dynamic_leg: rule.dynamic_leg ?? '',
    dynamic_journal: rule.dynamic_journal,
    debit_account_id: rule.debit_account_id ? String(rule.debit_account_id) : '',
    credit_account_id: rule.credit_account_id ? String(rule.credit_account_id) : '',
    journal_id: rule.journal_id ? String(rule.journal_id) : '',
    note: rule.note ?? '',
  };
}

function emptyForm(): RuleForm {
  return {
    event: 'sale',
    category: '',
    dynamic_leg: '',
    dynamic_journal: false,
    debit_account_id: '',
    credit_account_id: '',
    journal_id: '',
    note: '',
  };
}

export function AccountingRulesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';

  const [rules, setRules] = useState<AccountingRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<AccountingJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editRule, setEditRule] = useState<AccountingRule | null>(null);
  const [editForm, setEditForm] = useState<RuleForm>(emptyForm());
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.get<AccountingRule[]>('/accounting-rules'), api.get<Account[]>('/accounts'), api.get<AccountingJournal[]>('/accounting-journals')])
      .then(([r, a, j]) => {
        setRules(r);
        setAccounts(a);
        setJournals(j);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function payload(f: RuleForm) {
    return {
      event: f.event,
      category: f.event === 'expense' ? f.category || null : null,
      dynamic_leg: f.dynamic_leg || null,
      dynamic_journal: f.dynamic_journal,
      debit_account_id: f.dynamic_leg === 'debit' ? null : f.debit_account_id ? Number(f.debit_account_id) : null,
      credit_account_id: f.dynamic_leg === 'credit' ? null : f.credit_account_id ? Number(f.credit_account_id) : null,
      journal_id: f.dynamic_journal ? null : f.journal_id ? Number(f.journal_id) : null,
      note: f.note || undefined,
    };
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/accounting-rules', payload(form));
      setShowCreate(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(rule: AccountingRule) {
    setEditError(null);
    setEditForm(formFromRule(rule));
    setEditRule(rule);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editRule) return;
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.put(`/accounting-rules/${editRule.id}`, payload(editForm));
      setEditRule(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? firstValidationError(err.body) ?? err.message : 'Erreur inattendue.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(rule: AccountingRule) {
    setDeleteError(null);
    if (!window.confirm('Supprimer cette règle comptable ?')) return;
    setDeletingId(rule.id);
    try {
      await api.delete(`/accounting-rules/${rule.id}`);
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setDeletingId(null);
    }
  }

  function accountLabel(id: number | null): string {
    if (!id) return '—';
    const a = accounts.find((acc) => acc.id === id);
    return a ? `${a.code} — ${a.name}` : `#${id}`;
  }

  function journalLabel(id: number | null): string {
    if (!id) return '—';
    const j = journals.find((jr) => jr.id === id);
    return j ? j.code : `#${id}`;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  function ruleFields(f: RuleForm, setF: (f: RuleForm) => void, idPrefix: string) {
    return (
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`${idPrefix}-event`}>Événement</label>
          <select id={`${idPrefix}-event`} value={f.event} onChange={(e) => setF({ ...f, event: e.target.value as AccountingEvent })}>
            {ACCOUNTING_EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ACCOUNTING_EVENT_LABEL[ev]}
              </option>
            ))}
          </select>
        </div>
        {f.event === 'expense' && (
          <div className="field">
            <label htmlFor={`${idPrefix}-category`}>Catégorie de dépense</label>
            <select id={`${idPrefix}-category`} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })}>
              <option value="">— choisir —</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor={`${idPrefix}-leg`}>Côté dynamique (trésorerie selon le mode de paiement)</label>
          <select
            id={`${idPrefix}-leg`}
            value={f.dynamic_leg}
            onChange={(e) => setF({ ...f, dynamic_leg: e.target.value as RuleForm['dynamic_leg'] })}
          >
            <option value="">Aucun — comptes fixes</option>
            <option value="debit">Débit dynamique</option>
            <option value="credit">Crédit dynamique</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-dynjournal`}>
            <input
              id={`${idPrefix}-dynjournal`}
              type="checkbox"
              checked={f.dynamic_journal}
              onChange={(e) => setF({ ...f, dynamic_journal: e.target.checked })}
              style={{ marginRight: 8 }}
            />
            Journal dynamique (Caisse ou Banque selon le paiement)
          </label>
        </div>
        {f.dynamic_leg !== 'debit' && (
          <div className="field">
            <label htmlFor={`${idPrefix}-debit`}>Compte débité</label>
            <select id={`${idPrefix}-debit`} value={f.debit_account_id} onChange={(e) => setF({ ...f, debit_account_id: e.target.value })}>
              <option value="">— choisir —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {f.dynamic_leg !== 'credit' && (
          <div className="field">
            <label htmlFor={`${idPrefix}-credit`}>Compte crédité</label>
            <select id={`${idPrefix}-credit`} value={f.credit_account_id} onChange={(e) => setF({ ...f, credit_account_id: e.target.value })}>
              <option value="">— choisir —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {!f.dynamic_journal && (
          <div className="field">
            <label htmlFor={`${idPrefix}-journal`}>Journal</label>
            <select id={`${idPrefix}-journal`} value={f.journal_id} onChange={(e) => setF({ ...f, journal_id: e.target.value })}>
              <option value="">— choisir —</option>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} — {j.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor={`${idPrefix}-note`}>Note (optionnel)</label>
          <input id={`${idPrefix}-note`} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Règles comptables' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-aqua">
            <IconSettings />
          </div>
          <div>
            <h1>Règles comptables</h1>
            <p>Fait le lien entre chaque opération et les comptes du plan comptable — génère les écritures automatiquement</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nouvelle règle
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {deleteError && <div className="alert error">{deleteError}</div>}

      <div className="section-title" style={{ marginTop: 0 }}>Journaux</div>
      <div className="table-wrap table-scroll cards-sm" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Libellé</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => (
              <tr key={j.id}>
                <td className="mono" data-label="Code">{j.code}</td>
                <td data-label="Libellé">{j.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">Règles de génération des écritures</div>
      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Événement</th>
              <th>Catégorie</th>
              <th>Débit</th>
              <th>Crédit</th>
              <th>Journal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={6}>Chargement…</td>
              </tr>
            )}
            {!loading && rules.length === 0 && (
              <tr className="empty-row">
                <td colSpan={6}>Aucune règle configurée.</td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id}>
                <td data-label="Événement">{ACCOUNTING_EVENT_LABEL[r.event]}</td>
                <td data-label="Catégorie">{r.category ? EXPENSE_CATEGORY_LABEL[r.category] : '—'}</td>
                <td data-label="Débit">
                  {r.dynamic_leg === 'debit' ? <span className="badge neutral">Trésorerie (dynamique)</span> : accountLabel(r.debit_account_id)}
                </td>
                <td data-label="Crédit">
                  {r.dynamic_leg === 'credit' ? <span className="badge neutral">Trésorerie (dynamique)</span> : accountLabel(r.credit_account_id)}
                </td>
                <td data-label="Journal">
                  {r.dynamic_journal ? <span className="badge neutral">Caisse/Banque</span> : journalLabel(r.journal_id)}
                </td>
                <td data-label="" className="row-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(r)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={deletingId === r.id}
                    onClick={() => handleDelete(r)}
                  >
                    {deletingId === r.id ? '…' : 'Supprimer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nouvelle règle comptable" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            {ruleFields(form, setForm, 'nr')}
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

      {editRule && (
        <Modal title="Modifier la règle" onClose={() => setEditRule(null)}>
          <form onSubmit={handleEditSubmit}>
            {editError && <div className="alert error">{editError}</div>}
            {ruleFields(editForm, setEditForm, 'er')}
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditRule(null)}>
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
