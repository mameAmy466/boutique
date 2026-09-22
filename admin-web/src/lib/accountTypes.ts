import type { AccountType } from '../api/types';

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  actif: 'Actif',
  passif: 'Passif',
  tresorerie: 'Trésorerie',
  charge: 'Charge',
  produit: 'Produit',
};

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[];
