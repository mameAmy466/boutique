<?php

namespace App\Support;

/**
 * The single list of what a subscription can switch on or limit. The
 * per-plan values live in plan_features (editable from the Super Admin); this
 * registry says which keys exist, what they are called and which part of the
 * application each one opens — the API routes (routes/api.php, `feature:`
 * middleware) and the admin menus (admin-web/src/lib/features.ts) are wired
 * to these same keys.
 *
 * A feature is listed here only once it is actually enforced: a box that
 * would not change anything for the client is worse than no box.
 */
class PlanFeatures
{
    /**
     * Modules every subscription includes: never switched off, so a client
     * always keeps its core till.
     */
    public const CORE = [
        'Tableau de bord',
        'Produits et catégories',
        'Stock et lots',
        'Ventes, caisses et factures',
        'Clients',
        'Fournisseurs',
        'Utilisateurs et boutiques',
    ];

    /**
     * On/off features, with their default for [simple, pro, pro_max].
     *
     * @var array<string, array{label: string, description: string, defaults: array{0: bool, 1: bool, 2: bool}}>
     */
    public const FLAGS = [
        'employees' => [
            'label' => 'Gestion des employés',
            'description' => 'Fiches employés et paiement des salaires.',
            'defaults' => [false, true, true],
        ],
        'budget_enabled' => [
            'label' => 'Dépenses et budget',
            'description' => 'Saisie des dépenses par catégorie (loyer, électricité...).',
            'defaults' => [false, true, true],
        ],
        'debts_enabled' => [
            'label' => 'Dettes fournisseurs et créances clients',
            'description' => 'Achats et ventes à crédit, échéances et remboursements.',
            'defaults' => [true, true, true],
        ],
        'purchase_orders' => [
            'label' => 'Bons de commande',
            'description' => 'Commandes aux fournisseurs et réception en stock.',
            'defaults' => [true, true, true],
        ],
        'advanced_reports_enabled' => [
            'label' => 'Comptabilité et rapports financiers avancés',
            'description' => 'Trésorerie, écritures, grand livre, balance, compte de résultat, bilan, rapprochement bancaire, plan comptable.',
            'defaults' => [false, false, true],
        ],
        'excel_export' => [
            'label' => 'Export des rapports (Excel / CSV)',
            'description' => 'Boutons « Exporter » des listes de ventes, stock, produits et rapports.',
            'defaults' => [false, true, true],
        ],
        'multi_shop_dashboard' => [
            'label' => 'Gestion multi-boutiques',
            'description' => 'Comparaison des boutiques sur le tableau de bord.',
            'defaults' => [false, false, true],
        ],
    ];

    /**
     * Numeric quotas ('unlimited' = no cap), checked by the API on creation.
     *
     * @var array<string, array{label: string}>
     */
    public const LIMITS = [
        'max_shops' => ['label' => 'Boutiques'],
        'max_users' => ['label' => 'Utilisateurs'],
        'max_registers' => ['label' => 'Caisses'],
        'max_products' => ['label' => 'Produits'],
    ];

    public static function isFlag(string $key): bool
    {
        return array_key_exists($key, self::FLAGS);
    }

    public static function label(string $key): string
    {
        return self::FLAGS[$key]['label'] ?? self::LIMITS[$key]['label'] ?? $key;
    }
}
