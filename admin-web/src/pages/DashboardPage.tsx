import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { DashboardFigures } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';
import { SalesTrendChart } from '../components/charts/SalesTrendChart';
import { TopProductsChart } from '../components/charts/TopProductsChart';
import { ShopComparisonChart } from '../components/charts/ShopComparisonChart';
import { IconAlert, IconBox, IconCoin, IconGrid, IconRegister, IconShop, IconTrend } from '../components/DashboardIcons';

const TODAY_LABEL = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardFigures | null>(null);
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
            <div className="tile hero accent">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Aujourd'hui</div>
              <div className="value">{formatMoney(data.revenue.today)}</div>
            </div>
            <div className="tile">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Cette semaine</div>
              <div className="value">{formatMoney(data.revenue.this_week)}</div>
            </div>
            <div className="tile">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Ce mois</div>
              <div className="value">{formatMoney(data.revenue.this_month)}</div>
            </div>
            <div className="tile">
              <div className="tile-icon">
                <IconCoin />
              </div>
              <div className="label">Cette année</div>
              <div className="value">{formatMoney(data.revenue.this_year)}</div>
            </div>
          </div>

          <div className="section-title">Performance &amp; stock</div>
          <div className="tile-grid">
            <div className="tile accent">
              <div className="tile-icon">
                <IconTrend />
              </div>
              <div className="label">Bénéfice brut</div>
              <div className="value">{formatMoney(data.gross_profit)}</div>
            </div>
            <div className="tile">
              <div className="tile-icon">
                <IconBox />
              </div>
              <div className="label">Valeur du stock</div>
              <div className="value">{formatMoney(data.stock.value)}</div>
            </div>
            <div className={`tile${data.stock.out_of_stock_batches > 0 ? ' danger' : ''}`}>
              <div className="tile-icon">
                <IconAlert />
              </div>
              <div className="label">Lots en rupture</div>
              <div className="value">{data.stock.out_of_stock_batches}</div>
            </div>
            <div className="tile">
              <div className="tile-icon">
                <IconRegister />
              </div>
              <div className="label">Caisses ouvertes</div>
              <div className="value">{data.cash_sessions.open}</div>
            </div>
            {data.shops && (
              <div className="tile">
                <div className="tile-icon">
                  <IconShop />
                </div>
                <div className="label">Boutiques actives</div>
                <div className="value">
                  {data.shops.active}
                  <span className="sub"> / {data.shops.total}</span>
                </div>
              </div>
            )}
            <div className={`tile${data.alerts.low_stock > 0 ? ' warning' : ''}`}>
              <div className="tile-icon">
                <IconAlert />
              </div>
              <div className="label">Alertes stock faible</div>
              <div className="value">{data.alerts.low_stock}</div>
            </div>
          </div>

          <div className="section-title">Tendances</div>
          <div className="chart-grid-2">
            <div className="chart-card">
              <h3>
                <IconTrend /> Ventes des 14 derniers jours
              </h3>
              <SalesTrendChart data={data.sales_trend} />
            </div>
            <div className="chart-card">
              <h3>
                <IconBox /> Top produits (chiffre d'affaires)
              </h3>
              <TopProductsChart data={data.top_products} />
            </div>
          </div>

          {data.shops_comparison && (
            <div className="chart-card" style={{ marginBottom: 24 }}>
              <h3>
                <IconShop /> Comparaison des boutiques — mois en cours
              </h3>
              <ShopComparisonChart data={data.shops_comparison} />
            </div>
          )}
        </>
      )}
    </>
  );
}
