import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import type { ProductBatch } from '../api/types';

export function BatchCodeModal({ batch, onClose }: { batch: ProductBatch; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(batch.batch_code, { margin: 1, width: 240 }).then(setQrDataUrl);
  }, [batch.batch_code]);

  return (
    <Modal title="Étiquette du lot" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {qrDataUrl && <img src={qrDataUrl} alt={`QR code ${batch.batch_code}`} width={220} height={220} />}
        <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
          {batch.batch_code}
        </div>
        <p className="hint" style={{ textAlign: 'center', margin: 0 }}>
          {batch.product?.name ?? 'Produit'} — {batch.shop?.name ?? ''}
          <br />
          Scanne ce QR avec l'écran « Nouvelle vente » (bouton 📷 Scanner), ou imprime-le comme étiquette sur
          l'article.
        </p>
        <button type="button" className="btn" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>
    </Modal>
  );
}
