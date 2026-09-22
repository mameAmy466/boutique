<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use Database\Seeders\AccountingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialStatementsTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopWithBatch(): array
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $product = Product::create(['name' => 'Sac', 'reference' => 'REF-1', 'unit' => 'pcs', 'min_stock' => 1]);
        $batch = ProductBatch::create([
            'batch_code' => 'BTA-2026-000001', 'product_id' => $product->id, 'shop_id' => $shop->id,
            'purchase_cost' => 1000, 'additional_costs' => 0, 'cost_price' => 1000,
            'min_profit_amount' => 500, 'min_price' => 1500,
            'quantity_received' => 100, 'quantity_available' => 100, 'received_at' => now(),
        ]);
        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id, 'user_id' => $admin->id,
            'opening_amount' => 0, 'opened_at' => now(), 'status' => CashSession::STATUS_OPEN,
        ]);

        return compact('shop', 'admin', 'batch', 'session');
    }

    public function test_the_income_statement_nets_produits_and_charges_to_a_result(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        // Sale of 5 * 1500 = 7500 (tax-exempt, so the produit account carries the full amount).
        app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 5, 'unit_price' => 1500]],
            paymentMethod: 'cash', taxRate: 0,
        );

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'electricite', 'amount' => 3000,
            'payment_method' => 'cash', 'expense_date' => now()->toDateString(),
        ])->assertCreated();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/accounting/income-statement');
        $response->assertOk();

        $this->assertEquals(7500.0, $response->json('total_produits'));
        $this->assertEquals(3000.0, $response->json('total_charges'));
        $this->assertEquals(4500.0, $response->json('net_result'));
    }

    public function test_the_balance_sheet_keeps_actif_equal_to_passif_plus_net_result(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 3, 'unit_price' => 1500]],
            paymentMethod: 'cash', taxRate: 0,
        );

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'electricite', 'amount' => 1000,
            'payment_method' => 'transfer', 'expense_date' => now()->toDateString(),
        ])->assertCreated();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/accounting/balance-sheet');
        $response->assertOk();

        $this->assertEquals($response->json('total_actif'), $response->json('total_passif'));
        $this->assertGreaterThan(0, $response->json('total_actif'));
    }

    public function test_a_cashier_cannot_view_financial_statements(): void
    {
        $this->seed(AccountingSeeder::class);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::CAISSIER], ['name' => Role::CAISSIER]);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $this->actingAs($cashier, 'sanctum')->getJson('/api/accounting/income-statement')->assertForbidden();
        $this->actingAs($cashier, 'sanctum')->getJson('/api/accounting/balance-sheet')->assertForbidden();
    }
}
