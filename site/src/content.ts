export const plans = [
  {
    code: 'simple',
    name: 'Simple',
    monthly: 10000,
    annual: 100000,
    audience: 'Une boutique qui démarre',
    points: ['1 boutique', '2 utilisateurs', '1 caisse', '500 produits', 'Ventes, stock et dépenses'],
  },
  {
    code: 'pro',
    name: 'Pro',
    monthly: 25000,
    annual: 250000,
    audience: 'Une équipe qui grandit',
    points: [
      '1 boutique',
      '10 utilisateurs',
      '3 caisses',
      '5 000 produits',
      'Rapports avancés et export',
    ],
    featured: true,
  },
  {
    code: 'pro_max',
    name: 'Pro Max',
    monthly: 50000,
    annual: 500000,
    audience: 'Plusieurs points de vente',
    points: [
      '5 boutiques',
      '30 utilisateurs',
      '10 caisses',
      'Produits illimités',
      'Tableau de bord multi-boutiques et transferts',
    ],
  },
] as const

export const modules = [
  {
    title: 'Gestion des stocks',
    text: 'Lots, réceptions, seuils et prix minimum calculé sur le coût de revient.',
  },
  {
    title: 'Ventes et caisse',
    text: 'Encaissement, sessions de caisse et factures, sans vendre sous le prix minimum.',
  },
  {
    title: 'Rapports financiers',
    text: 'Dépenses, grand livre, compte de résultat, bilan et rapprochement bancaire.',
  },
  {
    title: 'Gestion multi-boutiques',
    text: 'Plusieurs magasins, équipes et transferts de stock depuis le même compte.',
  },
]

export function formatFcfa(amount: number) {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`
}
