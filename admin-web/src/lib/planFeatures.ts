import type { PublicPlan } from '../api/types';

/**
 * Turns a plan's raw feature_key/feature_value rows into a short, ordered
 * list of French bullet points for the pricing page — so the presentation
 * page always reflects whatever the plans table actually holds (see
 * PlanController) instead of a second hardcoded copy of the pricing grid.
 */
const FEATURE_ORDER: string[] = [
  'max_shops',
  'max_users',
  'max_registers',
  'max_products',
  'budget_enabled',
  'multi_shop_dashboard',
  'advanced_reports_enabled',
  'risk_analysis_advanced',
  'excel_export',
  'transfers_enabled',
];

function quotaLabel(value: string, unit: string): string {
  return value === 'unlimited' ? `${unit} illimités` : `Jusqu'à ${value} ${unit}`;
}

const FEATURE_LABEL: Record<string, (value: string) => string | null> = {
  max_shops: (v) => quotaLabel(v, 'boutique' + (v !== '1' ? 's' : '')),
  max_users: (v) => quotaLabel(v, v === '1' ? 'utilisateur' : 'utilisateurs'),
  max_registers: (v) => quotaLabel(v, v === '1' ? 'caisse' : 'caisses'),
  max_products: (v) => quotaLabel(v, v === '1' ? 'article' : 'articles'),
  budget_enabled: (v) => (v === 'true' ? 'Gestion des dépenses et budgets' : null),
  multi_shop_dashboard: (v) => (v === 'true' ? 'Tableau de bord multi-boutiques' : null),
  advanced_reports_enabled: (v) => (v === 'true' ? 'Rapports financiers détaillés' : null),
  risk_analysis_advanced: (v) => (v === 'true' ? 'Détection avancée des risques de perte' : null),
  excel_export: (v) => (v === 'true' ? 'Exports Excel/PDF' : null),
  transfers_enabled: (v) => (v === 'true' ? 'Transferts entre boutiques' : null),
};

export function planFeatureBullets(plan: PublicPlan): string[] {
  return FEATURE_ORDER.map((key) => {
    const value = plan.features[key];
    if (value === undefined) return null;
    return FEATURE_LABEL[key]?.(value) ?? null;
  }).filter((label): label is string => label !== null);
}
