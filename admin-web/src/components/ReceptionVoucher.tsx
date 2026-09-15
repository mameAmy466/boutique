import type { ProductBatch, Shop } from '../api/types';
import { formatDate, formatMoney } from '../lib/format';

export function ReceptionVoucher({ batch, shop }: { batch: ProductBatch; shop: Shop | null }) {
  const totalCost = Number(batch.purchase_cost) * batch.quantity_received + Number(batch.additional_costs);

  return (
    <div className="receipt">
      <div className="receipt-head">
        <div className="receipt-brand">Bon de réception</div>
        {shop && (
          <div className="receipt-shop">
            <strong>{shop.name}</strong>
            {shop.address && <div>{shop.address}</div>}
            {shop.phone && <div>{shop.phone}</div>}
          </div>
        )}
      </div>

      <div className="receipt-meta">
        <div>
          Lot <strong className="mono">{batch.batch_code}</strong>
        </div>
        <div>{formatDate(batch.received_at)}</div>
        <div>Fournisseur : {batch.supplier?.name ?? 'Non renseigné'}</div>
        {batch.supplier?.phone && <div>Tél. fournisseur : {batch.supplier.phone}</div>}
        <div>Reçu par : {batch.received_by_user?.name ?? `#${batch.received_by ?? '—'}`}</div>
      </div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Article</th>
            <th>Qté</th>
            <th>PU achat</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{batch.product?.name ?? `Produit #${batch.product_id}`}</td>
            <td className="num">{batch.quantity_received}</td>
            <td className="num">{formatMoney(batch.purchase_cost)}</td>
            <td className="num">{formatMoney(Number(batch.purchase_cost) * batch.quantity_received)}</td>
          </tr>
        </tbody>
      </table>

      <div className="receipt-totals">
        <div>
          <span>Frais associés</span>
          <span className="num">{formatMoney(batch.additional_costs)}</span>
        </div>
        <div className="receipt-total-line">
          <span>Coût total du lot</span>
          <span className="num">{formatMoney(totalCost)}</span>
        </div>
        <div>
          <span>Coût de revient unitaire</span>
          <span className="num">{formatMoney(batch.cost_price)}</span>
        </div>
        <div>
          <span>Prix minimum de vente</span>
          <span className="num">{formatMoney(batch.min_price)}</span>
        </div>
      </div>

      <p className="receipt-footer">Document interne — pour audit et inventaire.</p>
    </div>
  );
}
