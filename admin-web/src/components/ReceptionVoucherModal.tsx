import type { ProductBatch, Shop } from '../api/types';
import { Modal } from './Modal';
import { ReceptionVoucher } from './ReceptionVoucher';

export function ReceptionVoucherModal({
  batch,
  shop,
  onClose,
}: {
  batch: ProductBatch;
  shop: Shop | null;
  onClose: () => void;
}) {
  return (
    <Modal title="Bon de réception" onClose={onClose}>
      <ReceptionVoucher batch={batch} shop={shop} />
      <div className="form-actions" style={{ marginTop: 16, justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          🖨️ Imprimer
        </button>
      </div>
    </Modal>
  );
}
