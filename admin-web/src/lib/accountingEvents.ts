import type { AccountingEvent } from '../api/types';

export const ACCOUNTING_EVENT_LABEL: Record<AccountingEvent, string> = {
  sale: 'Vente',
  expense: 'Dépense',
  supplier_debt_created: 'Dette fournisseur créée',
  supplier_debt_payment: 'Paiement dette fournisseur',
  client_debt_created: 'Créance client créée',
  client_debt_payment: 'Encaissement créance client',
};

export const ACCOUNTING_EVENTS = Object.keys(ACCOUNTING_EVENT_LABEL) as AccountingEvent[];
