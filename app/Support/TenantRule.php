<?php

namespace App\Support;

use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\Rule;

/**
 * Validation rules bypass Eloquent scopes (they query the table directly),
 * so a plain `exists:products,id` would accept another client's id. These
 * variants add the tenant condition back.
 */
class TenantRule
{
    /** Tables carrying their own organization_id column. */
    private const ORGANIZATION_TABLES = [
        'shops', 'products', 'categories', 'suppliers', 'accounts', 'accounting_journals', 'accounting_rules', 'users',
    ];

    /** Tables owned through their shop_id column. */
    private const SHOP_TABLES = [
        'product_batches', 'employees', 'customers', 'cash_registers', 'sales', 'expenses', 'supplier_debts',
        'client_debts', 'journal_entries', 'purchase_orders', 'bank_statement_lines',
    ];

    public static function exists(string $table, string $column = 'id'): Exists
    {
        $rule = Rule::exists($table, $column);
        $organizationId = Tenant::id();

        if ($organizationId === null) {
            return $rule;
        }

        if (in_array($table, self::ORGANIZATION_TABLES, true)) {
            return $rule->where('organization_id', $organizationId);
        }

        if (in_array($table, self::SHOP_TABLES, true)) {
            return $rule->where(fn ($q) => $q->whereIn('shop_id', self::shopIds($organizationId)));
        }

        return match ($table) {
            'cash_sessions' => $rule->where(fn ($q) => $q->whereIn('cash_register_id',
                fn ($sub) => $sub->select('id')->from('cash_registers')->whereIn('shop_id', self::shopIds($organizationId)))),
            'purchase_order_items' => $rule->where(fn ($q) => $q->whereIn('purchase_order_id',
                fn ($sub) => $sub->select('id')->from('purchase_orders')->whereIn('shop_id', self::shopIds($organizationId)))),
            'journal_entry_lines' => $rule->where(fn ($q) => $q->whereIn('journal_entry_id',
                fn ($sub) => $sub->select('id')->from('journal_entries')->whereIn('shop_id', self::shopIds($organizationId)))),
            default => $rule,
        };
    }

    /** A value unique within the current tenant only (product references, account codes...). */
    public static function unique(string $table, string $column): Unique
    {
        $rule = Rule::unique($table, $column);
        $organizationId = Tenant::id();

        return $organizationId === null ? $rule : $rule->where('organization_id', $organizationId);
    }

    private static function shopIds(int $organizationId): \Closure
    {
        return fn ($q) => $q->select('id')->from('shops')->where('organization_id', $organizationId);
    }
}
