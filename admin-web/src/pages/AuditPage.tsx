import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Paginated, Shop, StockMovement } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { formatDate, initials } from '../lib/format';
import { STOCK_MOVEMENT_BADGE as TYPE_BADGE, STOCK_MOVEMENT_LABEL as TYPE_LABEL } from '../lib/stockMovements';
import { Breadcrumb } from '../components/Breadcrumb';
import { Pager } from '../components/Pager';

export function AuditPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role?.slug === 'super_admin';

  const [page, setPage] = useState<Paginated<StockMovement> | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopFilter, setShopFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
  const selected = movements.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    if (movements.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!movements.some((m) => m.id === selectedId)) {
      setSelectedId(movements[0].id);
    }
  }, [movements, selectedId]);

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Audit' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-stage">
        <div className="catalog-main">
          <div className="catalog-heading">
            <div>
              <h1>Audit</h1>
              <p>Historique des mouvements de stock, boutique par boutique</p>
            </div>
          </div>

          <div className="catalog-stats">
            <div className="catalog-stat">
              <span className="label">Mouvements</span>
              <span className="value num">{page?.total ?? 0}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Entrées</span>
              <span className="value num">{movements.filter((m) => m.quantity > 0).length}</span>
            </div>
            <div className="catalog-stat">
              <span className="label">Sorties</span>
              <span className="value num">{movements.filter((m) => m.quantity < 0).length}</span>
            </div>
          </div>

          <section className="catalog-history">
            <h2>Mouvements</h2>
            {isSuperAdmin && (
              <div className="list-toolbar">
                <select
                  value={shopFilter}
                  onChange={(e) => {
                    setShopFilter(e.target.value);
                    setPageNumber(1);
                  }}
                >
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
                    <th>Date</th>
                    <th>Type</th>
                    <th>Lot</th>
                    <th>Produit</th>
                    {isSuperAdmin && <th>Boutique</th>}
                    <th>Quantité</th>
                    <th>Utilisateur</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr className="empty-row">
                      <td colSpan={isSuperAdmin ? 7 : 6}>Chargement…</td>
                    </tr>
                  )}
                  {!loading && movements.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={isSuperAdmin ? 7 : 6}>Aucun mouvement enregistré pour le moment.</td>
                    </tr>
                  )}
                  {movements.map((m) => (
                    <tr
                      key={m.id}
                      className={selectedId === m.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(m.id)}
                    >
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page && (
              <Pager
                page={page.current_page}
                lastPage={page.last_page}
                total={page.total}
                onChange={setPageNumber}
              />
            )}
          </section>
        </div>

        <aside className="catalog-aside">
          <h2>Détail du mouvement</h2>
          {selected ? (
            <>
              <div className="catalog-aside-block">
                <span className="label">Type</span>
                <div className="catalog-aside-box">
                  <span className={`badge ${TYPE_BADGE[selected.type]}`}>{TYPE_LABEL[selected.type] ?? selected.type}</span>
                </div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Note</span>
                <div className="catalog-aside-box">{selected.note || '—'}</div>
              </div>
              <div className="catalog-aside-product">
                <div className="catalog-row-avatar letter">
                  {initials(selected.product_batch?.product?.name || selected.user?.name)}
                </div>
                <div>
                  <strong>{selected.product_batch?.product?.name ?? 'Produit'}</strong>
                  <span>{selected.product_batch?.batch_code ?? `Lot #${selected.product_batch_id}`}</span>
                </div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Date</span>
                  <span>{formatDate(selected.created_at)}</span>
                </div>
                <div>
                  <span>Utilisateur</span>
                  <span>{selected.user?.name ?? '—'}</span>
                </div>
                {isSuperAdmin && (
                  <div>
                    <span>Boutique</span>
                    <span>{selected.shop?.name ?? `#${selected.shop_id}`}</span>
                  </div>
                )}
                <div className="total">
                  <span>Quantité</span>
                  <span className="num">
                    {selected.quantity > 0 ? `+${selected.quantity}` : selected.quantity}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="catalog-empty">Sélectionne un mouvement pour voir le détail.</p>
          )}
        </aside>
      </div>
    </>
  );
}
