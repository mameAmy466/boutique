import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { CashRegister, CashSession, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatDate, formatMoney } from '../lib/format';
import { IconRegister } from '../components/DashboardIcons';

export function CashSessionsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';
  const isShopAdmin = user?.role?.slug === 'admin_boutique';

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showOpen, setShowOpen] = useState(false);
  const [openShopId, setOpenShopId] = useState('');
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [registerId, setRegisterId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const [closingSession, setClosingSession] = useState<CashSession | null>(null);
  const [declaredAmount, setDeclaredAmount] = useState('0');
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closedResult, setClosedResult] = useState<CashSession | null>(null);

  function loadSessions() {
    setLoading(true);
    const params = new URLSearchParams();
    if (isSuperAdmin && shopFilter) params.set('shop_id', shopFilter);
    api
      .get<CashSession[]>(`/cash-sessions?${params.toString()}`)
      .then(setSessions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadSessions, [shopFilter]);

  useEffect(() => {
    if (isSuperAdmin) api.get<Shop[]>('/shops').then(setShops);
  }, [isSuperAdmin]);

  const myOpenSession = sessions.find((s) => s.user_id === user?.id && s.status === 'open');

  function canClose(session: CashSession): boolean {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (session.user_id === user.id) return true;
    return isShopAdmin && user.shop_id === session.cash_register?.shop_id;
  }

  function openTheOpenModal() {
    setOpenError(null);
    setRegisterId('');
    setRegisters([]);
    setOpeningAmount('0');
    const shopId = isSuperAdmin ? shopFilter || String(user?.shop_id ?? '') : String(user?.shop_id ?? '');
    setOpenShopId(shopId);
    if (shopId) {
      api.get<CashRegister[]>(`/cash-registers?shop_id=${shopId}`).then(setRegisters);
    }
    setShowOpen(true);
  }

  function handleOpenShopChange(shopId: string) {
    setOpenShopId(shopId);
    setRegisterId('');
    setRegisters([]);
    if (shopId) {
      api.get<CashRegister[]>(`/cash-registers?shop_id=${shopId}`).then(setRegisters);
    }
  }

  async function handleCreateRegister() {
    if (!openShopId) return;
    try {
      const register = await api.post<CashRegister>('/cash-registers', {
        shop_id: Number(openShopId),
        name: `Caisse ${registers.length + 1}`,
      });
      setRegisters((prev) => [...prev, register]);
      setRegisterId(String(register.id));
    } catch (err) {
      setOpenError(err instanceof ApiError ? err.message : 'Impossible de créer la caisse.');
    }
  }

  async function handleOpenSubmit(e: FormEvent) {
    e.preventDefault();
    setOpenError(null);
    if (!registerId) {
      setOpenError('Choisis une caisse.');
      return;
    }
    setOpening(true);
    try {
      await api.post('/cash-sessions/open', {
        cash_register_id: Number(registerId),
        opening_amount: Number(openingAmount || 0),
      });
      setShowOpen(false);
      loadSessions();
    } catch (err) {
      setOpenError(err instanceof ApiError ? err.message : "Impossible d'ouvrir la caisse.");
    } finally {
      setOpening(false);
    }
  }

  function openCloseModal(session: CashSession) {
    setCloseError(null);
    setClosedResult(null);
    setDeclaredAmount('0');
    setClosingSession(session);
  }

  async function handleCloseSubmit(e: FormEvent) {
    e.preventDefault();
    if (!closingSession) return;
    setCloseError(null);
    setClosing(true);
    try {
      const result = await api.post<CashSession>(`/cash-sessions/${closingSession.id}/close`, {
        declared_amount: Number(declaredAmount || 0),
      });
      setClosedResult(result);
      loadSessions();
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : 'Impossible de fermer la caisse.');
    } finally {
      setClosing(false);
    }
  }

  function diffBadge(diff: string | null): string {
    const n = Number(diff ?? 0);
    if (n === 0) return 'ok';
    return n < 0 ? 'bad' : 'warn';
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Ventes & Caisses' }, { label: 'Caisses' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-blue">
            <IconRegister />
          </div>
          <div>
            <h1>Caisses</h1>
            <p>Ouverture, fermeture et rapprochement de chaque session de caisse</p>
          </div>
        </div>
        {!myOpenSession && (
          <button className="btn btn-primary" onClick={openTheOpenModal}>
            + Ouvrir ma caisse
          </button>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      {myOpenSession && (
        <div className="alert success" style={{ marginBottom: 16 }}>
          Tu as une caisse ouverte : <strong>{myOpenSession.cash_register?.name}</strong> depuis{' '}
          {formatDate(myOpenSession.opened_at)}.{' '}
          <button type="button" className="btn btn-sm btn-primary" style={{ marginLeft: 8 }} onClick={() => openCloseModal(myOpenSession)}>
            Fermer ma caisse
          </button>
        </div>
      )}

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
              <th>Caisse</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Utilisateur</th>
              <th>Ouverte le</th>
              <th>Fond de caisse</th>
              <th>Ventes</th>
              <th>Statut</th>
              <th>Montant déclaré</th>
              <th>Écart</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 10 : 9}>Chargement…</td>
              </tr>
            )}
            {!loading && sessions.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 10 : 9}>Aucune session de caisse pour le moment.</td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td data-label="Caisse">{s.cash_register?.name ?? `#${s.cash_register_id}`}</td>
                {isSuperAdmin && <td data-label="Boutique">{s.cash_register?.shop?.name ?? '—'}</td>}
                <td data-label="Utilisateur">{s.user?.name ?? `#${s.user_id}`}</td>
                <td data-label="Ouverte le">{formatDate(s.opened_at)}</td>
                <td className="num" data-label="Fond de caisse">{formatMoney(s.opening_amount)}</td>
                <td data-label="Ventes">
                  {s.sales_count ?? 0} · {formatMoney(s.sales_sum_total ?? 0)}
                </td>
                <td data-label="Statut">
                  <span className={`badge ${s.status === 'open' ? 'ok' : 'neutral'}`}>
                    {s.status === 'open' ? 'Ouverte' : 'Fermée'}
                  </span>
                </td>
                <td className="num" data-label="Montant déclaré">
                  {s.closing_amount !== null ? formatMoney(s.closing_amount) : '—'}
                </td>
                <td data-label="Écart">
                  {s.difference !== null ? (
                    <span className={`badge ${diffBadge(s.difference)}`}>{formatMoney(s.difference)}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label="">
                  {s.status === 'open' && canClose(s) && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openCloseModal(s)}>
                      Fermer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showOpen && (
        <Modal title="Ouvrir une caisse" onClose={() => setShowOpen(false)}>
          <form onSubmit={handleOpenSubmit}>
            {openError && <div className="alert error">{openError}</div>}
            <div className="form-grid">
              {isSuperAdmin && (
                <div className="field">
                  <label htmlFor="cs-shop">Boutique</label>
                  <select id="cs-shop" value={openShopId} onChange={(e) => handleOpenShopChange(e.target.value)} required>
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
                <label htmlFor="cs-register">Caisse</label>
                <select id="cs-register" value={registerId} onChange={(e) => setRegisterId(e.target.value)} required>
                  <option value="">— choisir —</option>
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleCreateRegister}
                    disabled={isSuperAdmin && !openShopId}
                  >
                    + Nouvelle caisse
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="cs-amount">Fond de caisse</label>
                <input
                  id="cs-amount"
                  type="number"
                  min={0}
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={opening}>
                {opening ? 'Ouverture…' : 'Ouvrir la caisse'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {closingSession && (
        <Modal title={`Fermer ${closingSession.cash_register?.name ?? 'la caisse'}`} onClose={() => setClosingSession(null)}>
          {closedResult ? (
            <>
              <div className="alert success">Caisse fermée.</div>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>Montant attendu</label>
                  <input value={formatMoney(closedResult.expected_amount ?? 0)} disabled />
                </div>
                <div className="field">
                  <label>Montant déclaré</label>
                  <input value={formatMoney(closedResult.closing_amount ?? 0)} disabled />
                </div>
                <div className="field">
                  <label>Écart</label>
                  <input value={formatMoney(closedResult.difference ?? 0)} disabled />
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-primary" onClick={() => setClosingSession(null)}>
                  Fermer
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCloseSubmit}>
              {closeError && <div className="alert error">{closeError}</div>}
              <p className="hint" style={{ marginBottom: 12 }}>
                Compte l'argent physiquement présent dans la caisse et déclare le montant. Le montant attendu (fond de
                caisse + ventes en espèces) sera calculé automatiquement et comparé.
              </p>
              <div className="field">
                <label htmlFor="cs-declared">Montant compté dans la caisse</label>
                <input
                  id="cs-declared"
                  type="number"
                  min={0}
                  value={declaredAmount}
                  onChange={(e) => setDeclaredAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setClosingSession(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={closing}>
                  {closing ? 'Fermeture…' : 'Fermer la caisse'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
