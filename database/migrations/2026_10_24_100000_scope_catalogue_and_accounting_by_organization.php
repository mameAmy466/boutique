<?php

use App\Models\Organization;
use Database\Seeders\AccountingSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Products, categories, suppliers and the chart of accounts used to be
 * global: every client saw (and could edit) the same catalogue and plan
 * comptable. Each row now belongs to one organization.
 *
 * Existing rows are attributed to the organization that actually uses them
 * (through the shops holding their stock or debts), falling back to the
 * oldest organization; every other organization gets its own copy of the
 * default chart of accounts.
 */
return new class extends Migration
{
    private const TABLES = ['categories', 'suppliers', 'products', 'accounts', 'accounting_journals', 'accounting_rules'];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('organization_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            });
        }

        $firstOrganizationId = DB::table('organizations')->min('id');

        $this->attribute('products', fn () => DB::table('product_batches')
            ->join('shops', 'shops.id', '=', 'product_batches.shop_id')
            ->whereColumn('product_batches.product_id', 'products.id')
            ->select('shops.organization_id')->limit(1));

        $this->attribute('suppliers', fn () => DB::table('products')
            ->whereColumn('products.supplier_id', 'suppliers.id')
            ->whereNotNull('products.organization_id')
            ->select('products.organization_id')->limit(1));
        $this->attribute('suppliers', fn () => DB::table('supplier_debts')
            ->join('shops', 'shops.id', '=', 'supplier_debts.shop_id')
            ->whereColumn('supplier_debts.supplier_id', 'suppliers.id')
            ->select('shops.organization_id')->limit(1));

        $this->attribute('categories', fn () => DB::table('products')
            ->whereColumn('products.category_id', 'categories.id')
            ->whereNotNull('products.organization_id')
            ->select('products.organization_id')->limit(1));

        foreach (self::TABLES as $tableName) {
            if ($firstOrganizationId) {
                DB::table($tableName)->whereNull('organization_id')->update(['organization_id' => $firstOrganizationId]);
            } else {
                // Fresh install: the default chart seeded before organizations
                // existed has no owner; each organization gets its own copy
                // when it is created.
                DB::table($tableName)->whereNull('organization_id')->delete();
            }
        }

        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['reference']);
            $table->unique(['organization_id', 'reference']);
        });
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->unique(['organization_id', 'code']);
        });
        Schema::table('accounting_journals', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->unique(['organization_id', 'code']);
        });

        foreach (Organization::query()->pluck('id') as $organizationId) {
            (new AccountingSeeder())->installFor($organizationId);
        }
    }

    public function down(): void
    {
        // Intentionally left as a no-op: merging every client's catalogue and
        // chart of accounts back into one shared set would mix their data.
    }

    private function attribute(string $table, Closure $organizationOf): void
    {
        $subquery = $organizationOf();

        DB::table($table)->whereNull('organization_id')->update([
            'organization_id' => DB::raw('('.$subquery->toSql().')'),
        ]);
    }
};
