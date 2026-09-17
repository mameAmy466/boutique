import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { CashSession } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconAlert } from '../components/DashboardIcons';
import { formatDate, formatMoney } from '../lib/format';
import { CASH_DISCREPANCY_THRESHOLD } from '../lib/cashAlerts';

interface CashierSummary {
  user_id: number;
  name: string;
  shops: Set<string>;
  sessionsClosed: number;
  sessionsWithGap: number;
  cumulativeDifference: number;
  worstDifference: number;
}

function summarize(sessions: CashSession[]): CashierSummary[] {
  const byUser = new Map<number, CashierSummary>();
  for (const s of sessions) {
    if (s.status !== 'closed' || s.difference === null) continue;
    const diff = Number(s.difference);
    const entry = byUser.get(s.user_id) ?? {
      user_id: s.user_id,
      name: s.user?.name ?? `#${s.user_id}`,
      shops: new Set<string>(),
      sessionsClosed: 0,
      sessionsWithGap: 0,
      cumulativeDifference: 0,
      worstDifference: 0,
    };
    if (s.cash_register?.shop?.name) entry.shops.add(s.cash_register.shop.name);
    entry.sessionsClosed += 1;
    if (diff !== 0) entry.sessionsWithGap += 1;
    entry.cumulativeDifference += diff;
    if (Math.abs(diff) > Math.abs(entry.worstDifference)) entry.worstDifference = diff;
    byUser.set(s.user_id, entry);
  }
  return [...byUser.values()].sort((a, b) => Math.abs(b.cumulativeDifference) - Math.abs(a.cumulativeDifference));
}

export function CashDiscrepanciesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    api
      .get<CashSession[]>('/cash-sessions')
      .then(setSessions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const summaries = useMemo(() => summarize(sessions), [sessions]);

  const discrepantSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'closed' && s.difference !== null && Number(s.difference) !== 0)
        .filter((s) => selectedUserId === null || s.user_id === selectedUserId)
        .sort((a, b) => Math.abs(Number(b.difference)) - Math.abs(Number(a.difference))),
    [sessions, selectedUserId],
  );

  function diffBadge(diff: number): string {
    if (diff === 0) return 'ok';
    return Math.abs(diff) >= CASH_DISCREPANCY_THRESHOLD ? 'bad' : 'warn';
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Écarts de caisse' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconAlert />
          </div>
          <div>
            <h1>Écarts de caisse</h1>
            <p>Synthèse des écarts de caisse constatés à la fermeture, par caissier</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="hint">Chargement…</p>}

      {!loading && (
        <>
          <div className="table-wrap table-scroll cards-sm" style={{ marginBottom: 24 }}>
            <table>
              <thead>
                <tr>
                  <th>Caissier</th>
                  <th>Boutique(s)</th>
                  <th>Sessions fermées</th>
                  <th>Sessions avec écart</th>
                  <th>Écart cumulé</th>
                  <th>Pire écart</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>Aucune session de caisse fermée pour le moment.</td>
                  </tr>
                )}
                {summaries.map((sum) => (
                  <tr key={sum.user_id} className={selectedUserId === sum.user_id ? 'row-selected' : ''}>
                    <td data-label="Caissier">{sum.name}</td>
                    <td data-label="Boutique(s)">{[...sum.shops].join(', ') || '—'}</td>
                    <td className="num" data-label="Sessions fermées">{sum.sessionsClosed}</td>
                    <td className="num" data-label="Sessions avec écart">{sum.sessionsWithGap}</td>
                    <td data-label="Écart cumulé">
                      <span className={`badge ${diffBadge(sum.cumulativeDifference)}`}>{formatMoney(sum.cumulativeDifference)}</span>
                    </td>
                    <td data-label="Pire écart">
                      <span className={`badge ${diffBadge(sum.worstDifference)}`}>{formatMoney(sum.worstDifference)}</span>
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setSelectedUserId((id) => (id === sum.user_id ? null : sum.user_id))}
                      >
                        {selectedUserId === sum.user_id ? 'Voir tout' : 'Détail →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title">
            Sessions avec écart {selectedUserId !== null && summaries.find((s) => s.user_id === selectedUserId)
              ? `— ${summaries.find((s) => s.user_id === selectedUserId)?.name}`
              : ''}
          </div>
          <div className="table-wrap table-scroll cards-sm">
            <table>
              <thead>
                <tr>
                  <th>Caissier</th>
                  <th>Boutique</th>
                  <th>Caisse</th>
                  <th>Fermée le</th>
                  <th>Attendu</th>
                  <th>Déclaré</th>
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                {discrepantSessions.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>Aucun écart à afficher.</td>
                  </tr>
                )}
                {discrepantSessions.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Caissier">{s.user?.name ?? `#${s.user_id}`}</td>
                    <td data-label="Boutique">{s.cash_register?.shop?.name ?? '—'}</td>
                    <td data-label="Caisse">{s.cash_register?.name ?? `#${s.cash_register_id}`}</td>
                    <td data-label="Fermée le">{s.closed_at ? formatDate(s.closed_at) : '—'}</td>
                    <td className="num" data-label="Attendu">{formatMoney(s.expected_amount ?? 0)}</td>
                    <td className="num" data-label="Déclaré">{formatMoney(s.closing_amount ?? 0)}</td>
                    <td data-label="Écart">
                      <span className={`badge ${diffBadge(Number(s.difference))}`}>{formatMoney(s.difference ?? 0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
