import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Account, AccountingJournal, JournalEntry, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconAudit } from '../components/DashboardIcons';
import { exportToCsv } from '../lib/csv';
import { formatDate, formatMoney } from '../lib/format';

interface FlatLine {
  entryId: number;
  entryDate: string;
  reference: string | null;
  label: string;
  journalCode: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

function flatten(entries: JournalEntry[]): FlatLine[] {
  const rows: FlatLine[] = [];
  for (const entry of entries) {
    for (const line of entry.lines ?? []) {
      rows.push({
        entryId: entry.id,
        entryDate: entry.entry_date,
        reference: entry.reference,
        label: entry.label,
        journalCode: entry.journal?.code ?? '—',
        accountCode: line.account?.code ?? '—',
        accountName: line.account?.name ?? '',
        debit: Number(line.debit),
        credit: Number(line.credit),
      });
    }
  }
  return rows;
}

export function JournalEntriesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<AccountingJournal[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [journalFilter, setJournalFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (journalFilter) params.set('journal_id', journalFilter);
    if (accountFilter) params.set('account_id', accountFilter);
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);
    api
      .get<JournalEntry[]>(`/journal-entries?${params.toString()}`)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [journalFilter, accountFilter, shopFilter, fromFilter, toFilter, isSuperAdmin]);

  useEffect(() => {
    api.get<Account[]>('/accounts').then(setAccounts);
    api.get<AccountingJournal[]>('/accounting-journals').then(setJournals);
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  const rows = useMemo(() => flatten(entries), [entries]);
  const totals = useMemo(
    () => rows.reduce((acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }), { debit: 0, credit: 0 }),
    [rows],
  );

  function handleExport() {
    exportToCsv(
      'ecritures.csv',
      rows.map((r) => ({
        date: r.entryDate,
        piece: r.reference ?? '',
        libelle: r.label,
        journal: r.journalCode,
        compte: r.accountCode,
        intitule_compte: r.accountName,
        debit: r.debit,
        credit: r.credit,
      })),
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Écritures' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconAudit />
          </div>
          <div>
            <h1>Écritures comptables</h1>
            <p>Journal et grand livre — générés automatiquement à partir des ventes, dépenses et dettes</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="list-toolbar">
        <select value={journalFilter} onChange={(e) => setJournalFilter(e.target.value)}>
          <option value="">Tous journaux</option>
          {journals.map((j) => (
            <option key={j.id} value={j.id}>
              {j.code} — {j.name}
            </option>
          ))}
        </select>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">Tous comptes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
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
        <input type="date" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} aria-label="Du" />
        <input type="date" value={toFilter} onChange={(e) => setToFilter(e.target.value)} aria-label="Au" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport} disabled={rows.length === 0}>
          ⬇️ Exporter CSV
        </button>
      </div>

      <div className="catalog-stats" style={{ marginBottom: 16 }}>
        <div className="catalog-stat">
          <span className="label">Total débit</span>
          <span className="value num">{formatMoney(totals.debit)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Total crédit</span>
          <span className="value num">{formatMoney(totals.credit)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Écart</span>
          <span className={`value num ${Math.abs(totals.debit - totals.credit) < 0.01 ? '' : 'badge bad'}`}>
            {formatMoney(totals.debit - totals.credit)}
          </span>
        </div>
      </div>

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Pièce</th>
              <th>Libellé</th>
              <th>Journal</th>
              <th>Compte</th>
              <th>Débit</th>
              <th>Crédit</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={7}>Chargement…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>Aucune écriture ne correspond.</td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.entryId}-${i}`}>
                <td data-label="Date">{formatDate(r.entryDate)}</td>
                <td className="mono" data-label="Pièce">{r.reference ?? '—'}</td>
                <td data-label="Libellé">{r.label}</td>
                <td data-label="Journal">
                  <span className="badge neutral">{r.journalCode}</span>
                </td>
                <td data-label="Compte">
                  {r.accountCode} — {r.accountName}
                </td>
                <td className="num" data-label="Débit">{r.debit > 0 ? formatMoney(r.debit) : ''}</td>
                <td className="num" data-label="Crédit">{r.credit > 0 ? formatMoney(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
