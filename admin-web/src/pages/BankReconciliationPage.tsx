import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Account, BankStatementLine, Shop, UnmatchedJournalEntryLine } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconBank } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';

export function BankReconciliationPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [shops, setShops] = useState<Shop[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [shopId, setShopId] = useState(user?.shop_id ? String(user.shop_id) : '');
  const [accountId, setAccountId] = useState('');

  const [statementLines, setStatementLines] = useState<BankStatementLine[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedJournalEntryLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  const [manualDate, setManualDate] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
    api.get<Account[]>('/accounts').then((all) => setAccounts(all.filter((a) => a.type === 'tresorerie')));
  }, [isSuperAdmin]);

  function load() {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ account_id: accountId });
    if (isSuperAdmin && shopId) params.set('shop_id', shopId);
    Promise.all([
      api.get<BankStatementLine[]>(`/bank-statement-lines?${params.toString()}`),
      api.get<UnmatchedJournalEntryLine[]>(`/bank-statement-lines/unmatched-entries?${params.toString()}`),
    ])
      .then(([lines, entries]) => {
        setStatementLines(lines);
        setUnmatched(entries);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [accountId, shopId, isSuperAdmin]);

  const reconciled = statementLines.filter((l) => l.reconciled);
  const statementTotal = statementLines.reduce((sum, l) => sum + Number(l.amount), 0);

  async function handleMatch() {
    if (!selectedLineId || !selectedEntryId) return;
    setMatchError(null);
    setMatching(true);
    try {
      await api.post(`/bank-statement-lines/${selectedLineId}/match`, { journal_entry_line_id: selectedEntryId });
      setSelectedLineId(null);
      setSelectedEntryId(null);
      load();
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setMatching(false);
    }
  }

  async function handleUnmatch(line: BankStatementLine) {
    try {
      await api.post(`/bank-statement-lines/${line.id}/unmatch`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    }
  }

  async function handleDelete(line: BankStatementLine) {
    if (!window.confirm('Supprimer cette ligne de relevé ?')) return;
    try {
      await api.delete(`/bank-statement-lines/${line.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    }
  }

  async function handleManualAdd(e: FormEvent) {
    e.preventDefault();
    setManualError(null);
    setManualSubmitting(true);
    try {
      await api.post('/bank-statement-lines', {
        shop_id: Number(shopId || user?.shop_id),
        account_id: Number(accountId),
        statement_date: manualDate,
        label: manualLabel,
        amount: Number(manualAmount),
      });
      setManualDate('');
      setManualLabel('');
      setManualAmount('');
      load();
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setManualSubmitting(false);
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setImportError(null);
    setImportMessage(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setImportError('Choisissez un fichier CSV.');
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('shop_id', String(shopId || user?.shop_id));
      form.append('account_id', accountId);
      form.append('file', file);
      const res = await api.post<{ imported: number; skipped: number }>('/bank-statement-lines/import', form);
      setImportMessage(`${res.imported} ligne(s) importée(s)${res.skipped ? `, ${res.skipped} ignorée(s)` : ''}.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Erreur inattendue.');
    } finally {
      setImporting(false);
    }
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Rapprochement bancaire' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-aqua">
            <IconBank />
          </div>
          <div>
            <h1>Rapprochement bancaire</h1>
            <p>Pointe le relevé importé avec les écritures comptables du compte</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="list-toolbar">
        {isSuperAdmin && (
          <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">— boutique —</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— compte de trésorerie —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </div>

      {accountId && (
        <>
          <div className="catalog-stats" style={{ marginBottom: 16 }}>
            <div className="catalog-stat">
              <span className="label">Solde du relevé importé</span>
              <span className="value num">{formatMoney(statementTotal)}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Lignes pointées</span>
              <span className="value num">{reconciled.length} / {statementLines.length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Écritures non pointées</span>
              <span className="value num">{unmatched.length}</span>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 16 }}>
            <form onSubmit={handleImport} className="field">
              <label>Importer un relevé (CSV : date, libellé, montant)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" />
                <button type="submit" className="btn btn-sm" disabled={importing}>
                  {importing ? 'Import…' : 'Importer'}
                </button>
              </div>
              {importError && <div className="alert error" style={{ marginTop: 6 }}>{importError}</div>}
              {importMessage && <p className="hint">{importMessage}</p>}
            </form>

            <form onSubmit={handleManualAdd} className="field">
              <label>Ajouter une ligne manuellement</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} required />
                <input placeholder="Libellé" value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} required />
                <input
                  type="number"
                  placeholder="Montant"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  required
                  style={{ width: 120 }}
                />
                <button type="submit" className="btn btn-sm" disabled={manualSubmitting}>
                  {manualSubmitting ? '…' : '+ Ajouter'}
                </button>
              </div>
              {manualError && <div className="alert error" style={{ marginTop: 6 }}>{manualError}</div>}
            </form>
          </div>

          {matchError && <div className="alert error">{matchError}</div>}
          <div className="form-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={!selectedLineId || !selectedEntryId || matching} onClick={handleMatch}>
              {matching ? 'Pointage…' : '🔗 Pointer la sélection'}
            </button>
          </div>

          <div className="two-col-stage">
            <section className="catalog-history">
              <h2>Relevé bancaire</h2>
              <div className="table-wrap table-scroll cards-sm">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Date</th>
                      <th>Libellé</th>
                      <th>Montant</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr className="empty-row">
                        <td colSpan={5}>Chargement…</td>
                      </tr>
                    )}
                    {!loading && statementLines.length === 0 && (
                      <tr className="empty-row">
                        <td colSpan={5}>Aucune ligne importée.</td>
                      </tr>
                    )}
                    {statementLines.map((l) => (
                      <tr key={l.id} className={selectedLineId === l.id ? 'is-selected' : undefined}>
                        <td data-label="">
                          {!l.reconciled && (
                            <input
                              type="radio"
                              name="stline"
                              checked={selectedLineId === l.id}
                              onChange={() => setSelectedLineId(l.id)}
                            />
                          )}
                        </td>
                        <td data-label="Date">{formatDate(l.statement_date)}</td>
                        <td data-label="Libellé">{l.label}</td>
                        <td className="num" data-label="Montant">{formatMoney(l.amount)}</td>
                        <td data-label="" className="row-actions">
                          {l.reconciled ? (
                            <>
                              <span className="badge ok">Pointée</span>
                              <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleUnmatch(l)}>
                                Dépointer
                              </button>
                            </>
                          ) : (
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleDelete(l)}>
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="catalog-history">
              <h2>Écritures non pointées</h2>
              <div className="table-wrap table-scroll cards-sm">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Date</th>
                      <th>Pièce</th>
                      <th>Débit</th>
                      <th>Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr className="empty-row">
                        <td colSpan={5}>Chargement…</td>
                      </tr>
                    )}
                    {!loading && unmatched.length === 0 && (
                      <tr className="empty-row">
                        <td colSpan={5}>Tout est pointé.</td>
                      </tr>
                    )}
                    {unmatched.map((e) => (
                      <tr key={e.id} className={selectedEntryId === e.id ? 'is-selected' : undefined}>
                        <td data-label="">
                          <input
                            type="radio"
                            name="entryline"
                            checked={selectedEntryId === e.id}
                            onChange={() => setSelectedEntryId(e.id)}
                          />
                        </td>
                        <td data-label="Date">{e.journal_entry ? formatDate(e.journal_entry.entry_date) : '—'}</td>
                        <td className="mono" data-label="Pièce">{e.journal_entry?.reference ?? '—'}</td>
                        <td className="num" data-label="Débit">{Number(e.debit) > 0 ? formatMoney(e.debit) : ''}</td>
                        <td className="num" data-label="Crédit">{Number(e.credit) > 0 ? formatMoney(e.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
