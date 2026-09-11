import type { Sale, Shop } from '../api/types';
import { formatDate, formatMoney } from '../lib/format';

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  transfer: 'Virement',
  other: 'Autre',
};

export function InvoiceReceipt({ sale, shop }: { sale: Sale; shop: Shop | null }) {
  return (
    <div className="receipt">
      <div className="receipt-head">
        <div className="receipt-brand">Boutique</div>
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
          Facture <strong>{sale.invoice?.invoice_number ?? '—'}</strong>
        </div>
        <div>Vente {sale.sale_number}</div>
        <div>{formatDate(sale.created_at)}</div>
        <div>Vendeur : {sale.user?.name ?? `#${sale.user_id}`}</div>
        {sale.customer_name && <div>Client : {sale.customer_name}</div>}
      </div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Article</th>
            <th>Qté</th>
            <th>PU</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items?.map((item) => (
            <tr key={item.id}>
              <td>{item.product_batch?.product?.name ?? `Lot #${item.product_batch_id}`}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatMoney(item.unit_price)}</td>
              <td className="num">{formatMoney(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-totals">
        <div>
          <span>Sous-total</span>
          <span className="num">{formatMoney(sale.subtotal)}</span>
        </div>
        {Number(sale.discount) > 0 && (
          <div>
            <span>Remise</span>
            <span className="num">-{formatMoney(sale.discount)}</span>
          </div>
        )}
        <div className="receipt-total-line">
          <span>Total</span>
          <span className="num">{formatMoney(sale.total)}</span>
        </div>
        <div>
          <span>Paiement</span>
          <span>{PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method}</span>
        </div>
      </div>

      <p className="receipt-footer">Merci de votre achat.</p>
    </div>
  );
}
