import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { DashboardFigures, Paginated, StockMovement } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney } from '../lib/format';
import { STOCK_MOVEMENT_BADGE, STOCK_MOVEMENT_LABEL } from '../lib/stockMovements';
import { SalesTrendChart } from '../components/charts/SalesTrendChart';
import { TopProductsChart } from '../components/charts/TopProductsChart';
import { ShopComparisonChart } from '../components/charts/ShopComparisonChart';
import { IconAlert, IconAudit, IconBox, IconCoin, IconGrid, IconRegister, IconShop, IconTrend } from '../components/DashboardIcons';

const TODAY_LABEL = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function DashboardPage() {
  const { user } = useAuth();
  const canSeeActivity = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';
  const [data, setData] = useState<DashboardFigures | null>(null);
  const [activity, setActivity] = useState<StockMovement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = user?.role?.slug === 'super_admin' ? '/dashboard/general' : `/dashboard/shop/${user?.shop_id}`;

    if (!user?.shop_id && user?.role?.slug !== 'super_admin') {
      setLoading(false);
      return;
    }

    api
      .get<DashboardFigures>(path)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger le tableau de bord."))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!canSeeActivity) return;
    api
      .get<Paginated<StockMovement>>('/stocks/movements')
      .then((page) => setActivity(page.data.slice(0, 6)))
      .catch(() => {});
  }, [canSeeActivity]);

  const title = data?.shop ? `Boutique ${data.shop.name}` : 'Complexe commercial';

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon">
            <IconGrid />
          </div>
          <div>
            <h1>Tableau de bord</h1>
            <p>
              {title} · {TODAY_LABEL}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <div className="spinner-line">Chargement…</div>}

      {!loading && !error && !data && (
        <div className="alert error">Aucune boutique n'est rattachée à ton compte.</div>
      )}

      {data && (
        <>
          <div className="section-title">Chiffre d'affaires</div>
          <div className="tile-grid">
            <Link to="/sales" className="tile hero accent">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Aujourd'hui</div>
              <div className="value">{formatMoney(data.revenue.today)}</div>
            </Link>
            <Link to="/sales" className="tile cat-blue">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Cette semaine</div>
              <div className="value">{formatMoney(data.revenue.this_week)}</div>
            </Link>
            <Link to="/sales" className="tile cat-blue">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Ce mois</div>
              <div className="value">{formatMoney(data.revenue.this_month)}</div>
            </Link>
            <Link to="/sales" className="tile cat-blue">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Cette année</div>
              <div className="value">{formatMoney(data.revenue.this_year)}</div>
            </Link>
          </div>

          <div className="section-title">Performance &amp; stock</div>
          <div className="tile-grid">
            <Link to="/sales" className="tile accent">
              <div className="tile-icon">
                <IconTrend />
              </div>
              <div className="label">Bénéfice brut</div>
              <div className="value">{formatMoney(data.gross_profit)}</div>
            </Link>
            <Link to="/stocks" className="tile cat-aqua">
              <div className="tile-icon">
                <IconBox />
              </div>
              <div className="label">Valeur du stock</div>
              <div className="value">{formatMoney(data.stock.value)}</div>
            </Link>
            <Link to="/stocks" className={`tile${data.stock.out_of_stock_batches > 0 ? ' danger' : ''}`}>
              <div className="tile-icon">
                <IconAlert />
              </div>
              <div className="label">Lots en rupture</div>
              <div className="value">{data.stock.out_of_stock_batches}</div>
            </Link>
            <Link to="/sales" className="tile cat-blue">
              <div className="tile-icon">
                <IconRegister />
              </div>
              <div className="label">Caisses ouvertes</div>
              <div className="value">{data.cash_sessions.open}</div>
            </Link>
            {data.shops && (
              <Link to="/shops" className="tile cat-violet">
                <div className="tile-icon">
                  <IconShop />
                </div>
                <div className="label">Boutiques actives</div>
                <div className="value">
                  {data.shops.active}
                  <span className="sub"> / {data.shops.total}</span>
                </div>
              </Link>
            )}
            <Link to="/stocks" className={`tile${data.alerts.low_stock > 0 ? ' warning' : ''}`}>
              <div className="tile-icon">
                <IconAlert />
              </div>
              <div className="label">Alertes stock faible</div>
              <div className="value">{data.alerts.low_stock}</div>
            </Link>
          </div>

          <div className="section-title">Tendances</div>
          <div className="chart-grid-2">
            <div className="chart-card">
              <h3>
                <IconTrend /> Ventes des 14 derniers jours
                <Link to="/sales" className="card-link">
                  Voir tout →
                </Link>
              </h3>
              <SalesTrendChart data={data.sales_trend} />
            </div>
            <div className="chart-card">
              <h3>
                <IconBox /> Top produits (chiffre d'affaires)
                <Link to="/products" className="card-link">
                  Voir tout →
                </Link>
              </h3>
              <TopProductsChart data={data.top_products} />
            </div>
          </div>

          {data.shops_comparison && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <h3>
                <IconShop /> Comparaison des boutiques — mois en cours
                <Link to="/shops" className="card-link">
                  Voir tout →
                </Link>
              </h3>
              <ShopComparisonChart data={data.shops_comparison} />
            </div>
          )}

          {canSeeActivity && (
            <div className="chart-card">
              <h3>
                <IconAudit /> Dernières activités
                <Link to="/audit" className="card-link">
                  Voir tout →
                </Link>
              </h3>
              {activity.length === 0 && <p className="hint">Aucune activité récente.</p>}
              {activity.length > 0 && (
                <div className="activity-feed">
                  {activity.map((m) => (
                    <Link to="/audit" key={m.id} className="activity-row">
                      <span className={`badge ${STOCK_MOVEMENT_BADGE[m.type]}`}>{STOCK_MOVEMENT_LABEL[m.type] ?? m.type}</span>
                      <span className="activity-desc">
                        {m.product_batch?.product?.name ?? 'Produit'} · {m.product_batch?.batch_code ?? `#${m.product_batch_id}`}
                        {m.user?.name && <span className="activity-user"> — {m.user.name}</span>}
                      </span>
                      <span className="activity-date">{formatDate(m.created_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
