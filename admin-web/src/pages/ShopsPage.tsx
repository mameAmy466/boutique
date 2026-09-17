import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError, firstValidationError } from '../api/client';
import type { DashboardFigures, Shop } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Drawer } from '../components/Drawer';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatMoney, initials } from '../lib/format';
import { SalesTrendChart } from '../components/charts/SalesTrendChart';
import { TopProductsChart } from '../components/charts/TopProductsChart';

const STATUS_BADGE: Record<Shop['status'], string> = {
  active: 'ok',
  suspended: 'warn',
  closed: 'bad',
  archived: 'neutral',
};

const STATUS_LABEL: Record<Shop['status'], string> = {
  active: 'Active',
  suspended: 'Suspendue',
  closed: 'Fermée',
  archived: 'Archivée',
};

function emptyForm() {
  return {
    name: '',
    code: '',
    description: '',
    manager_name: '',
    address: '',
    phone: '',
    email: '',
    category: '',
    monthly_budget: '',
  };
}

export function ShopsPage() {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [figures, setFigures] = useState<DashboardFigures | null>(null);
  const [figuresLoading, setFiguresLoading] = useState(false);

  const canCreate = user?.role?.slug === 'super_admin';

  function load() {
    setLoading(true);
    api
      .get<Shop[]>('/shops')
      .then(setShops)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return shops;
    return shops.filter(
      (shop) =>
        shop.name.toLowerCase().includes(needle) ||
        shop.code.toLowerCase().includes(needle) ||
        (shop.manager_name ?? '').toLowerCase().includes(needle),
    );
  }, [shops, search]);

  const selected = shops.find((shop) => shop.id === selectedId) ?? null;

  useEffect(() => {
    if (shops.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!shops.some((shop) => shop.id === selectedId)) {
      setSelectedId(shops[0].id);
    }
  }, [shops, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setFigures(null);
      return;
    }
    setFiguresLoading(true);
    api
      .get<DashboardFigures>(`/dashboard/shop/${selectedId}`)
      .then(setFigures)
      .catch(() => setFigures(null))
      .finally(() => setFiguresLoading(false));
  }, [selectedId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/shops', {
        ...form,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : undefined,
      });
      setShowCreate(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(firstValidationError(err.body) ?? err.message);
      } else {
        setFormError('Erreur inattendue.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function pickShop(id: number) {
    setSelectedId(id);
    setShowPicker(false);
    setSearch('');
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Boutiques' }]} />
      {error && <div className="alert error">{error}</div>}

      <div className="catalog-heading">
        <div>
          <h1>Boutiques</h1>
          <p>{selected ? `${selected.name} · ${selected.code}` : 'Choisis une boutique'}</p>
        </div>
        <div className="shops-heading-actions">
          <button type="button" className="btn" onClick={() => setShowPicker(true)}>
            Filtrer la boutique
          </button>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Nouvelle boutique
            </button>
          )}
        </div>
      </div>

      <div className="catalog-stats four">
        <div className="catalog-stat">
          <span className="label">Ventes du jour</span>
          <span className="value num">{figuresLoading ? '…' : formatMoney(figures?.revenue.today ?? 0)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Stock</span>
          <span className="value num">{figuresLoading ? '…' : formatMoney(figures?.stock.value ?? 0)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Produits en rupture</span>
          <span className="value num">{figuresLoading ? '…' : (figures?.alerts.out_of_stock ?? 0)}</span>
        </div>
        <div className="catalog-stat">
          <span className="label">Chiffre d’affaires</span>
          <span className="value num">{figuresLoading ? '…' : formatMoney(figures?.revenue.this_month ?? 0)}</span>
        </div>
      </div>

      <div className="shops-panels">
        <aside className="catalog-aside shops-detail">
          <h2>Fiche boutique</h2>
          {loading && <p className="catalog-empty">Chargement…</p>}
          {!loading && selected ? (
            <>
              {selected.description && (
                <div className="catalog-aside-block">
                  <span className="label">Description</span>
                  <div className="catalog-aside-box">{selected.description}</div>
                </div>
              )}
              <div className="catalog-aside-block">
                <span className="label">Adresse</span>
                <div className="catalog-aside-box">{selected.address || '—'}</div>
              </div>
              <div className="catalog-aside-block">
                <span className="label">Contact</span>
                <div className="catalog-aside-box">
                  {selected.phone || '—'}
                  {selected.email ? ` · ${selected.email}` : ''}
                </div>
              </div>
              <div className="catalog-aside-product">
                <div className="catalog-row-avatar letter">{initials(selected.name)}</div>
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.code}</span>
                </div>
              </div>
              <div className="catalog-totals">
                <div>
                  <span>Responsable</span>
                  <span>{selected.manager_name || '—'}</span>
                </div>
                <div>
                  <span>Catégorie</span>
                  <span>{selected.category || '—'}</span>
                </div>
                <div>
                  <span>Statut</span>
                  <span>{STATUS_LABEL[selected.status]}</span>
                </div>
                <div className="total">
                  <span>Budget</span>
                  <span className="num">{formatMoney(selected.monthly_budget)}</span>
                </div>
              </div>
            </>
          ) : (
            !loading && <p className="catalog-empty">Choisis une boutique dans le filtre.</p>
          )}
        </aside>

        <section className="catalog-aside shops-charts">
          <h2>Activité</h2>
          {figuresLoading && <p className="catalog-empty">Chargement…</p>}
          {!figuresLoading && !figures && (
            <p className="catalog-empty">Choisis une boutique pour voir ses diagrammes.</p>
          )}
          {!figuresLoading && figures && (
            <>
              <div className="shops-charts-block shops-charts-trend">
                <h3>Évolution des ventes · 14 jours</h3>
                <SalesTrendChart data={figures.sales_trend} variant="wave" />
              </div>
              <div className="shops-charts-block">
                <h3>Top produits</h3>
                <TopProductsChart data={figures.top_products} />
              </div>
            </>
          )}
        </section>
      </div>

      {showPicker && (
        <Drawer title="Choisir une boutique" onClose={() => setShowPicker(false)}>
          <div className="list-toolbar">
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filtered.length === 0 && <p className="catalog-empty">Aucune boutique.</p>}
          {filtered.map((shop) => (
            <button
              key={shop.id}
              type="button"
              className={`shop-picker-row${selectedId === shop.id ? ' is-selected' : ''}`}
              onClick={() => pickShop(shop.id)}
            >
              <span className="catalog-row-avatar letter">{initials(shop.name)}</span>
              <span className="catalog-row-copy">
                <strong>{shop.name}</strong>
                <span>
                  {shop.code}
                  {shop.manager_name ? ` · ${shop.manager_name}` : ''}
                </span>
              </span>
              <span className={`badge ${STATUS_BADGE[shop.status]}`}>{STATUS_LABEL[shop.status]}</span>
            </button>
          ))}
        </Drawer>
      )}

      {showCreate && (
        <Modal title="Nouvelle boutique" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {formError && <div className="alert error">{formError}</div>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="shop-name">Nom</label>
                <input
                  id="shop-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="shop-code">Code</label>
                <input
                  id="shop-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="BT01"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="shop-manager">Responsable</label>
                <input
                  id="shop-manager"
                  value={form.manager_name}
                  onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="shop-phone">Téléphone</label>
                <input id="shop-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="shop-address">Adresse</label>
                <input
                  id="shop-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="shop-budget">Budget mensuel (FCFA)</label>
                <input
                  id="shop-budget"
                  type="number"
                  min={0}
                  value={form.monthly_budget}
                  onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer la boutique'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
