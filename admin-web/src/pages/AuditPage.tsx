import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Paginated, Shop, StockMovement } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/format';
import { STOCK_MOVEMENT_BADGE as TYPE_BADGE, STOCK_MOVEMENT_LABEL as TYPE_LABEL } from '../lib/stockMovements';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconAudit } from '../components/DashboardIcons';

export function AuditPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';

  const [page, setPage] = useState<Paginated<StockMovement> | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get<Shop[]>('/shops').then(setShops).catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageNumber) });
    if (shopFilter) params.set('shop_id', shopFilter);
    api
      .get<Paginated<StockMovement>>(`/stocks/movements?${params.toString()}`)
      .then(setPage)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, [pageNumber, shopFilter]);

  const movements = page?.data ?? [];

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Audit' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-violet">
            <IconAudit />
          </div>
          <div>
            <h1>Audit</h1>
            <p>Historique des mouvements de stock, boutique par boutique</p>
          </div>
        </div>
        {isSuperAdmin && (
          <select
            value={shopFilter}
            onChange={(e) => {
              setShopFilter(e.target.value);
              setPageNumber(1);
            }}
            style={{ minWidth: 180 }}
          >
            <option value="">Toutes les boutiques</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap table-scroll cards-sm">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Lot</th>
              <th>Produit</th>
              {isSuperAdmin && <th>Boutique</th>}
              <th>Quantité</th>
              <th>Utilisateur</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Chargement…</td>
              </tr>
            )}
            {!loading && movements.length === 0 && (
              <tr className="empty-row">
                <td colSpan={isSuperAdmin ? 8 : 7}>Aucun mouvement enregistré pour le moment.</td>
              </tr>
            )}
            {movements.map((m) => (
              <tr key={m.id}>
                <td data-label="Date">{formatDate(m.created_at)}</td>
                <td data-label="Type">
                  <span className={`badge ${TYPE_BADGE[m.type]}`}>{TYPE_LABEL[m.type] ?? m.type}</span>
                </td>
                <td className="mono" data-label="Lot">{m.product_batch?.batch_code ?? `#${m.product_batch_id}`}</td>
                <td data-label="Produit">{m.product_batch?.product?.name ?? '—'}</td>
                {isSuperAdmin && <td data-label="Boutique">{m.shop?.name ?? `#${m.shop_id}`}</td>}
                <td className="num" data-label="Quantité">
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </td>
                <td data-label="Utilisateur">{m.user?.name ?? '—'}</td>
                <td data-label="Note">{m.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page && page.last_page > 1 && (
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => p - 1)}
          >
            ← Précédent
          </button>
          <span className="hint">
            Page {page.current_page} / {page.last_page} · {page.total} mouvements
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pageNumber >= page.last_page}
            onClick={() => setPageNumber((p) => p + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </>
  );
}
