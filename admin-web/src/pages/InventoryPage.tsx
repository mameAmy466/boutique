import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ProductBatch } from '../api/types';
import { formatMoney } from '../lib/format';
import { Breadcrumb } from '../components/Breadcrumb';
import { IconClipboard } from '../components/DashboardIcons';

interface ShopSummary {
  shopId: number;
  shopName: string;
  lots: number;
  quantity: number;
  costValue: number;
  retailValue: number;
}

interface ProductSummary {
  productId: number;
  productName: string;
  lots: number;
  quantity: number;
  costValue: number;
  retailValue: number;
}

export function InventoryPage() {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<ProductBatch[]>('/stocks')
      .then(setBatches)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erreur de chargement.'))
      .finally(() => setLoading(false));
  }, []);

  const byShop = useMemo(() => {
    const map = new Map<number, ShopSummary>();
    for (const b of batches) {
      const entry = map.get(b.shop_id) ?? {
        shopId: b.shop_id,
        shopName: b.shop?.name ?? `Boutique #${b.shop_id}`,
        lots: 0,
        quantity: 0,
        costValue: 0,
        retailValue: 0,
      };
      entry.lots += 1;
      entry.quantity += b.quantity_available;
      entry.costValue += Number(b.cost_price) * b.quantity_available;
      entry.retailValue += Number(b.min_price) * b.quantity_available;
      map.set(b.shop_id, entry);
    }
    return [...map.values()].sort((a, b) => a.shopName.localeCompare(b.shopName));
  }, [batches]);

  const byProduct = useMemo(() => {
    const map = new Map<number, ProductSummary>();
    for (const b of batches) {
      const entry = map.get(b.product_id) ?? {
        productId: b.product_id,
        productName: b.product?.name ?? `Produit #${b.product_id}`,
        lots: 0,
        quantity: 0,
        costValue: 0,
        retailValue: 0,
      };
      entry.lots += 1;
      entry.quantity += b.quantity_available;
      entry.costValue += Number(b.cost_price) * b.quantity_available;
      entry.retailValue += Number(b.min_price) * b.quantity_available;
      map.set(b.product_id, entry);
    }
    return [...map.values()].sort((a, b) => b.quantity - a.quantity);
  }, [batches]);

  const grandTotal = useMemo(
    () =>
      byShop.reduce(
        (acc, s) => ({
          lots: acc.lots + s.lots,
          quantity: acc.quantity + s.quantity,
          costValue: acc.costValue + s.costValue,
          retailValue: acc.retailValue + s.retailValue,
        }),
        { lots: 0, quantity: 0, costValue: 0, retailValue: 0 },
      ),
    [byShop],
  );

  return (
    <>
      <Breadcrumb items={[{ label: 'Tableau de bord', to: '/' }, { label: 'Administration' }, { label: 'Inventaire' }]} />
      <div className="page-header">
        <div className="page-header-title">
          <div className="page-icon cat-aqua">
            <IconClipboard />
          </div>
          <div>
            <h1>Inventaire</h1>
            <p>Vue consolidée du stock sur l'ensemble des boutiques</p>
          </div>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <div className="spinner-line">Chargement…</div>}

      {!loading && !error && (
        <>
          <div className="tile-grid">
            <div className="tile hero accent">
              <div className="label">Valeur totale du stock (coût)</div>
              <div className="value">{formatMoney(grandTotal.costValue)}</div>
              <div className="sub">Valeur potentielle à la vente : {formatMoney(grandTotal.retailValue)}</div>
            </div>
            <div className="tile">
              <div className="label">Quantité totale disponible</div>
              <div className="value">{grandTotal.quantity}</div>
            </div>
            <div className="tile">
              <div className="label">Lots actifs</div>
              <div className="value">{grandTotal.lots}</div>
            </div>
          </div>

          <div className="section-title">Par boutique</div>
          <div className="table-wrap table-scroll cards-sm" style={{ marginBottom: 28 }}>
            <table>
              <thead>
                <tr>
                  <th>Boutique</th>
                  <th>Lots</th>
                  <th>Quantité</th>
                  <th>Valeur (coût)</th>
                  <th>Valeur potentielle</th>
                </tr>
              </thead>
              <tbody>
                {byShop.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>Aucun stock enregistré.</td>
                  </tr>
                )}
                {byShop.map((s) => (
                  <tr key={s.shopId}>
                    <td data-label="Boutique">{s.shopName}</td>
                    <td className="num" data-label="Lots">{s.lots}</td>
                    <td className="num" data-label="Quantité">{s.quantity}</td>
                    <td className="num" data-label="Valeur (coût)">{formatMoney(s.costValue)}</td>
                    <td className="num" data-label="Valeur potentielle">{formatMoney(s.retailValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title">Par produit</div>
          <div className="table-wrap table-scroll cards-sm">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Lots</th>
                  <th>Quantité</th>
                  <th>Valeur (coût)</th>
                  <th>Valeur potentielle</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>Aucun stock enregistré.</td>
                  </tr>
                )}
                {byProduct.map((p) => (
                  <tr key={p.productId}>
                    <td data-label="Produit">{p.productName}</td>
                    <td className="num" data-label="Lots">{p.lots}</td>
                    <td className="num" data-label="Quantité">{p.quantity}</td>
                    <td className="num" data-label="Valeur (coût)">{formatMoney(p.costValue)}</td>
                    <td className="num" data-label="Valeur potentielle">{formatMoney(p.retailValue)}</td>
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
