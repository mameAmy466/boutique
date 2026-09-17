import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { DashboardFigures, Paginated, Sale, StockMovement } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';
import { STOCK_MOVEMENT_LABEL } from '../lib/stockMovements';
import { SalesTrendChart } from '../components/charts/SalesTrendChart';
import { TopProductsChart } from '../components/charts/TopProductsChart';
import { ShopComparisonChart } from '../components/charts/ShopComparisonChart';
import {
  IconAlert,
  IconBag,
  IconBank,
  IconBox,
  IconCard,
  IconRegister,
  IconSend,
  IconShop,
  IconSpark,
  IconTrend,
} from '../components/DashboardIcons';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
];

function formatDashWhen(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return `Aujourd'hui, ${time}`;
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${time}`;
}

function compactDashMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M FCFA`;
  return formatMoney(value);
}

function ProgressRing({ pct }: { pct: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg className="dash-ring" viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke="#9fe1c8"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="53" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">
        {clamped}%
      </text>
    </svg>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const canSeeActivity = user?.role?.slug === 'super_admin' || user?.role?.slug === 'admin_boutique';
  const [data, setData] = useState<DashboardFigures | null>(null);
  const [activity, setActivity] = useState<StockMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => {
    const path = user?.role?.slug === 'super_admin' ? '/dashboard/general' : `/dashboard/shop/${user?.shop_id}`;

    if (!user?.shop_id && user?.role?.slug !== 'super_admin') {
      setLoading(false);
      return;
    }

    api
      .get<DashboardFigures>(path)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger le tableau de bord.'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!canSeeActivity) return;
    api
      .get<Paginated<StockMovement>>('/stocks/movements')
      .then((page) => setActivity(page.data.slice(0, 8)))
      .catch(() => {});
  }, [canSeeActivity]);

  useEffect(() => {
    api
      .get<Paginated<Sale>>('/sales?page=1')
      .then((page) => setSales(page.data.slice(0, 4)))
      .catch(() => {});
  }, []);

  const shopLabel = data?.shop?.name ?? 'Boutique';
  const year = new Date().getFullYear();

  const periodValue = data
    ? { day: data.revenue.today, week: data.revenue.this_week, month: data.revenue.this_month, year: data.revenue.this_year }[
        period
      ]
    : 0;

  const monthProgress = useMemo(() => {
    if (!data) return 0;
    const monthIndex = new Date().getMonth() + 1;
    const expected = data.revenue.this_year / monthIndex;
    if (expected <= 0) return data.revenue.this_month > 0 ? 100 : 0;
    return (data.revenue.this_month / expected) * 100;
  }, [data]);

  const transfers = activity.filter((m) => m.type === 'transfer_in' || m.type === 'transfer_out').slice(0, 4);
  const fallbackMoves = activity.filter((m) => m.type !== 'transfer_in' && m.type !== 'transfer_out').slice(0, 4);
  const transferRows = transfers.length > 0 ? transfers : fallbackMoves;

  const cardCode = (data?.shop?.code ?? 'ADMIN').replace(/(.{4})/g, '$1 ').trim();

  return (
    <div className="dash">
      {error && <div className="alert error">{error}</div>}
      {loading && <div className="spinner-line">Chargement…</div>}

      {!loading && !error && !data && (
        <div className="alert error">Aucune boutique n'est rattachée à ton compte.</div>
      )}

      {data && (
        <>
          <div className="dash-grid">
            <Link to="/sales" className="dash-kpi">
              <span className="dash-kpi-icon">
                <IconCard />
              </span>
              <span className="dash-kpi-label">Ventes du jour</span>
              <span className="dash-kpi-value">{formatMoney(data.revenue.today)}</span>
            </Link>

            <Link to="/sales" className="dash-kpi">
              <span className="dash-kpi-icon">
                <IconBank />
              </span>
              <span className="dash-kpi-label">Cette semaine</span>
              <span className="dash-kpi-value">{formatMoney(data.revenue.this_week)}</span>
            </Link>

            <Link to="/sales" className="dash-kpi">
              <span className="dash-kpi-icon">
                <IconSend />
              </span>
              <span className="dash-kpi-label">Ce mois</span>
              <span className="dash-kpi-value">{formatMoney(data.revenue.this_month)}</span>
            </Link>

            <section className="dash-card dash-chart">
              <div className="dash-chart-head">
                <div>
                  <p className="dash-kpi-label">CA {PERIODS.find((p) => p.id === period)?.label.toLowerCase()}</p>
                  <div className="dash-chart-value">{compactDashMoney(periodValue)}</div>
                </div>
                <div className="dash-period" role="tablist" aria-label="Période">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={period === p.id}
                      className={period === p.id ? 'active' : ''}
                      onClick={() => setPeriod(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <SalesTrendChart data={data.sales_trend} variant="wave" />
            </section>

            <section className="dash-card dash-promo">
              <div className="dash-promo-copy">
                <h2>Atteignez vos objectifs plus vite</h2>
                <p>
                  Suivez le chiffre d'affaires de {shopLabel}, le stock et les transferts sans frais cachés. Vendez,
                  recevez et pilotez en un coup d'œil.
                </p>
                <Link to="/sales" className="dash-pill-btn">
                  <IconSpark /> Voir les ventes
                </Link>
              </div>
              <div className="dash-shop-card">
                <div className="dash-shop-card-top">
                  <span>Carte boutique</span>
                  <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
                    <path d="M14 4.5c2.4 1.6 2.4 7.4 0 9" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" />
                    <path d="M16.6 2.2c3.6 2.4 3.6 11.2 0 13.6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
                    <path d="M11.6 6.6c1.3.9 1.3 4 0 4.9" stroke="#fff" strokeWidth="1.6" />
                  </svg>
                </div>
                <div className="dash-shop-card-code">{cardCode}</div>
                <div className="dash-shop-card-foot">
                  <span>{user?.name ?? shopLabel}</span>
                  <span>12/{String(year).slice(-2)}</span>
                </div>
              </div>
            </section>

            <section className="dash-card dash-sales">
              <div className="dash-card-title">
                <h3>Vos ventes</h3>
                <Link to="/sales">Tout voir</Link>
              </div>
              {sales.length === 0 && <p className="hint">Aucune vente récente.</p>}
              <div className="dash-list">
                {sales.map((sale) => (
                  <Link to="/sales" key={sale.id} className="dash-list-row">
                    <span className="dash-list-icon">
                      <IconBag />
                    </span>
                    <span className="dash-list-copy">
                      <strong>{sale.customer_name || sale.sale_number}</strong>
                      <em>{formatDashWhen(sale.created_at)}</em>
                    </span>
                    <span className="dash-amt in">+{formatMoney(Number(sale.total))}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="dash-card dash-transfers">
              <div className="dash-card-title">
                <h3>{transfers.length > 0 ? 'Vos transferts' : 'Dernières activités'}</h3>
                <Link to={canSeeActivity ? '/audit' : '/stocks'}>Tout voir</Link>
              </div>
              {transferRows.length === 0 && <p className="hint">Aucun mouvement récent.</p>}
              <div className="dash-list">
                {transferRows.map((m) => {
                  const incoming = m.type === 'transfer_in' || m.type === 'entry' || m.type === 'return';
                  return (
                    <Link to={canSeeActivity ? '/audit' : '/stocks'} key={m.id} className="dash-list-row">
                      <span className={`dash-list-icon${incoming ? '' : ' out'}`}>
                        {incoming ? <IconSend /> : <IconBox />}
                      </span>
                      <span className="dash-list-copy">
                        <strong>{m.user?.name ?? m.product_batch?.product?.name ?? STOCK_MOVEMENT_LABEL[m.type]}</strong>
                        <em>
                          {STOCK_MOVEMENT_LABEL[m.type]} · {formatDashWhen(m.created_at)}
                        </em>
                      </span>
                      <span className={`dash-amt ${incoming ? 'in' : 'out'}`}>
                        {incoming ? '+' : '−'}
                        {m.quantity}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="dash-goal">
              <div>
                <p className="dash-goal-kicker">Plan {year}</p>
                <h3>{monthProgress >= 100 ? 'Atteint' : 'En cours'}</h3>
                <p className="dash-goal-meta">
                  {formatMoney(data.revenue.this_month)} ce mois
                  {data.stock.out_of_stock_batches > 0 && ` · ${data.stock.out_of_stock_batches} lots en rupture`}
                </p>
              </div>
              <ProgressRing pct={monthProgress} />
            </section>
          </div>

          <div className="dash-metrics">
            <Link to="/sales" className="dash-metric">
              <IconTrend />
              <span>Bénéfice brut</span>
              <strong>{formatMoney(data.gross_profit)}</strong>
            </Link>
            <Link to="/stocks" className="dash-metric">
              <IconBox />
              <span>Valeur du stock</span>
              <strong>{formatMoney(data.stock.value)}</strong>
            </Link>
            <Link to="/stocks" className={`dash-metric${data.alerts.low_stock > 0 ? ' warn' : ''}`}>
              <IconAlert />
              <span>Alertes stock</span>
              <strong>{data.alerts.low_stock}</strong>
            </Link>
            <Link to="/sales" className="dash-metric">
              <IconRegister />
              <span>Caisses ouvertes</span>
              <strong>{data.cash_sessions.open}</strong>
            </Link>
            {data.shops && (
              <Link to="/shops" className="dash-metric">
                <IconShop />
                <span>Boutiques actives</span>
                <strong>
                  {data.shops.active}
                  <em> / {data.shops.total}</em>
                </strong>
              </Link>
            )}
          </div>

          <div className="dash-secondary">
            <section className="dash-card">
              <div className="dash-card-title">
                <h3>Top produits</h3>
                <Link to="/products">Voir tout</Link>
              </div>
              <TopProductsChart data={data.top_products} />
            </section>
            {data.shops_comparison && (
              <section className="dash-card">
                <div className="dash-card-title">
                  <h3>Comparaison des boutiques</h3>
                  <Link to="/shops">Voir tout</Link>
                </div>
                <ShopComparisonChart data={data.shops_comparison} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
