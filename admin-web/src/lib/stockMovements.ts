import type { StockMovementType } from '../api/types';

export const STOCK_MOVEMENT_LABEL: Record<StockMovementType, string> = {
  entry: 'Réception',
  sale: 'Vente',
  transfer_out: 'Transfert sortant',
  transfer_in: 'Transfert entrant',
  damage: 'Casse',
  loss: 'Perte',
  theft: 'Vol',
  expiration: 'Péremption',
  adjustment: 'Ajustement (inventaire)',
  return: 'Retour',
  price_correction: 'Correction de prix',
  deletion: 'Suppression de lot',
};

export const STOCK_MOVEMENT_BADGE: Record<StockMovementType, string> = {
  entry: 'ok',
  sale: 'neutral',
  transfer_out: 'neutral',
  transfer_in: 'neutral',
  damage: 'bad',
  loss: 'bad',
  theft: 'bad',
  expiration: 'bad',
  adjustment: 'warn',
  return: 'neutral',
  price_correction: 'warn',
  deletion: 'bad',
};
