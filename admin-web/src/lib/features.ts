import type { FeatureKey } from '../api/types';

/**
 * Which plan feature opens which page. Same keys as the API's `feature:`
 * middleware (App\Support\PlanFeatures): a page whose feature the plan does
 * not include is left out of the menu and cannot be opened by its address.
 */
const ROUTE_FEATURES: [string, FeatureKey][] = [
  ['/employees', 'employees'],
  ['/expenses', 'budget_enabled'],
  ['/supplier-debts', 'debts_enabled'],
  ['/client-debts', 'debts_enabled'],
  ['/purchase-orders', 'purchase_orders'],
  ['/cashflow', 'advanced_reports_enabled'],
  ['/journal-entries', 'advanced_reports_enabled'],
  ['/grand-livre', 'advanced_reports_enabled'],
  ['/balance-comptable', 'advanced_reports_enabled'],
  ['/compte-de-resultat', 'advanced_reports_enabled'],
  ['/bilan', 'advanced_reports_enabled'],
  ['/rapprochement-bancaire', 'advanced_reports_enabled'],
  ['/chart-of-accounts', 'advanced_reports_enabled'],
  ['/accounting-rules', 'advanced_reports_enabled'],
  ['/controle-comptable', 'advanced_reports_enabled'],
];

export function featureForPath(pathname: string): FeatureKey | null {
  const match = ROUTE_FEATURES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match ? match[1] : null;
}
