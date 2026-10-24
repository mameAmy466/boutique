import type { OrganizationStatus, SubscriptionStatus } from '../api/types';

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "Période d'essai",
  active: 'Actif',
  past_due: 'Paiement en retard',
  expired: 'Expiré',
  cancelled: 'Résilié',
  suspended: 'Suspendu',
};

export const SUBSCRIPTION_STATUS_BADGE: Record<SubscriptionStatus, string> = {
  trial: 'neutral',
  active: 'ok',
  past_due: 'warn',
  expired: 'bad',
  cancelled: 'bad',
  suspended: 'bad',
};

export const ORGANIZATION_STATUS_LABEL: Record<OrganizationStatus, string> = {
  active: 'Active',
  suspended: 'Suspendue',
  closed: 'Fermée',
};

export const ORGANIZATION_STATUS_BADGE: Record<OrganizationStatus, string> = {
  active: 'ok',
  suspended: 'warn',
  closed: 'bad',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  free_money: 'Free Money',
  bank_transfer: 'Virement',
  card: 'Carte',
  other: 'Autre',
};

/**
 * How a client reaches the platform to pay or ask for reactivation.
 * Keep in sync with site/src/config.ts.
 */
export const PLATFORM_CONTACT = {
  phoneDisplay: '+221 77 813 01 32',
  phoneHref: 'tel:+221778130132',
  whatsapp: '221778130132',
  email: 'contact@myboutiqu.com',
};
