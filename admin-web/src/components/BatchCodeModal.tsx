import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Modal } from './Modal';
import type { ProductBatch } from '../api/types';

export function BatchCodeModal({ batch, onClose }: { batch: ProductBatch; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    JsBarcode(svgRef.current, batch.batch_code, {
      format: 'CODE128',
      width: 2,
      height: 80,
      margin: 8,
      fontSize: 14,
    });
  }, [batch.batch_code]);

  return (
    <Modal title="Étiquette du lot" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <svg ref={svgRef} aria-label={`Code-barres ${batch.batch_code}`} />
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>
          {batch.product?.name ?? 'Produit'} — {batch.shop?.name ?? ''}
          <br />
          Scanne ce code-barres avec l'écran « Nouvelle vente » (bouton 📷 Scanner), ou imprime-le comme étiquette
          sur l'article.
        </p>
        <button type="button" className="btn" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>
    </Modal>
  );
}
