import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Account, AccountLedger, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconCoin } from '../components/DashboardIcons';
import { exportToCsv } from '../lib/csv';
import { formatDate, formatMoney } from '../lib/format';

function soldeLabel(balance: number): string {
  if (Math.abs(balance) < 0.01) return formatMoney(0);
  return `${formatMoney(Math.abs(balance))} ${balance > 0 ? 'débiteur' : 'créditeur'}`;
}

export function GrandLivrePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isAdmin = isSuperAdmin || user?.role?.slug === 'admin_boutique';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [accountId, setAccountId] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Account[]>('/accounts').then((list) => {
      setAccounts(list);
      if (list.length > 0) setAccountId(String(list[0].id));
    });
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);
    api
      .get<AccountLedger>(`/accounting/ledger/${accountId}?${params.toString()}`)
      .then(setLedger)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [accountId, shopFilter, fromFilter, toFilter, isSuperAdmin]);

  function handleExport() {
    if (!ledger) return;
    exportToCsv(
      `grand-livre-${ledger.account.code}.csv`,
      [
        { date: ledger.from ?? '', piece: '', libelle: 'Solde d\'ouverture', journal: '', debit: '', credit: '', solde: ledger.opening_balance },
        ...ledger.movements.map((m) => ({
          date: m.entry_date,
          piece: m.reference ?? '',
          libelle: m.label,
          journal: m.journal_code,
          debit: m.debit,
          credit: m.credit,
          solde: m.balance,
        })),
      ],
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Comptabilité' }, { label: 'Grand livre' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-blue">
            <IconCoin />
          </div>
          <div>
            <h1>Grand livre</h1>
            <p>Mouvements et solde progressif d'un compte</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="list-toolbar">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Compte">
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
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport} disabled={!ledger}>
          ⬇️ Exporter CSV
        </button>
      </div>

      {ledger && (
        <div className="catalog-stats" style={{ marginBottom: 16 }}>
          <div className="catalog-stat">
            <span className="label">Solde d'ouverture</span>
            <span className="value num">{soldeLabel(ledger.opening_balance)}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Total débit</span>
            <span className="value num">{formatMoney(ledger.movements.reduce((s, m) => s + m.debit, 0))}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Total crédit</span>
            <span className="value num">{formatMoney(ledger.movements.reduce((s, m) => s + m.credit, 0))}</span>
          </div>
          <div className="catalog-stat">
            <span className="label">Solde de clôture</span>
            <span className="value num">{soldeLabel(ledger.closing_balance)}</span>
          </div>
        </div>
      )}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Pièce</th>
              <th>Libellé</th>
              <th>Journal</th>
              <th>Débit</th>
              <th>Crédit</th>
              <th>Solde</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={7}>Chargement…</td>
              </tr>
            )}
            {!loading && !ledger && (
              <tr className="empty-row">
                <td colSpan={7}>Sélectionnez un compte.</td>
              </tr>
            )}
            {!loading && ledger && (
              <tr>
                <td data-label="Date">{ledger.from ? formatDate(ledger.from) : '—'}</td>
                <td className="mono" data-label="Pièce">—</td>
                <td data-label="Libellé"><em>Solde d'ouverture</em></td>
                <td data-label="Journal">—</td>
                <td className="num" data-label="Débit"></td>
                <td className="num" data-label="Crédit"></td>
                <td className="num" data-label="Solde">{soldeLabel(ledger.opening_balance)}</td>
              </tr>
            )}
            {!loading && ledger && ledger.movements.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>Aucun mouvement sur la période.</td>
              </tr>
            )}
            {!loading &&
              ledger?.movements.map((m, i) => (
                <tr key={`${m.entry_id}-${i}`}>
                  <td data-label="Date">{formatDate(m.entry_date)}</td>
                  <td className="mono" data-label="Pièce">{m.reference ?? '—'}</td>
                  <td data-label="Libellé">{m.label}</td>
                  <td data-label="Journal">
                    <span className="badge neutral">{m.journal_code}</span>
                  </td>
                  <td className="num" data-label="Débit">{m.debit > 0 ? formatMoney(m.debit) : ''}</td>
                  <td className="num" data-label="Crédit">{m.credit > 0 ? formatMoney(m.credit) : ''}</td>
                  <td className="num" data-label="Solde">{soldeLabel(m.balance)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
