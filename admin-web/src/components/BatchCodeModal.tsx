import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Modal } from './Modal';
import type { ProductBatch } from '../api/types';
import { formatMoney } from '../lib/format';

/**
 * The product's label: its own barcode, the same whatever batch the item
 * comes from, so every reception prints identical labels and the till
 * recognises them all. The batch number is only shown for reference.
 */
export function BatchCodeModal({ batch, onClose }: { batch: ProductBatch; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Older products may still lack one: fall back to the batch code.
  const code = batch.product?.barcode || batch.batch_code;

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, code, {
      format: /^\d{13}$/.test(code) ? 'EAN13' : 'CODE128',
      width: 2,
      height: 80,
      margin: 8,
      fontSize: 14,
    });
  }, [code]);

  const price = Number(batch.product?.selling_price ?? 0) || Number(batch.min_price);

  return (
    <Modal title="Étiquette du produit" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <strong>{batch.product?.name ?? 'Produit'}</strong>
        <svg ref={svgRef} aria-label={`Code-barres ${code}`} />
        <span className="num">{formatMoney(price)}</span>
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>
          Même code-barres pour toutes les réceptions de ce produit : imprime-le une fois et colle-le sur chaque article.
          <br />
          Lot {batch.batch_code}
          {batch.shop?.name ? ` · ${batch.shop.name}` : ''}
        </p>
        <button type="button" className="btn" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>
    </Modal>
  );
}
