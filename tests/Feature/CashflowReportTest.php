<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CashflowReportTest extends TestCase
{
    use RefreshDatabase;

    private function makeShop(): array
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

    public function test_entrees_and_sorties_are_bucketed_correctly_by_month(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShop();

        Carbon::setTestNow('2026-09-15 10:00:00');

        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 2, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );
        $this->assertSame('3000.00', $sale->total);

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'loyer', 'amount' => 1000, 'expense_date' => '2026-09-10',
        ])->assertCreated();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/accounting/cashflow?group_by=month');
        $response->assertOk();

        $septBucket = collect($response->json())->firstWhere('period', '2026-09-01');
        $this->assertNotNull($septBucket, 'Expected a September 2026 bucket in the response.');
        $this->assertEquals(3000.0, $septBucket['entrees']);
        $this->assertEquals(1000.0, $septBucket['sorties']);
        $this->assertEquals(2000.0, $septBucket['net']);

        Carbon::setTestNow();
    }

    public function test_a_shop_admin_only_sees_their_own_shops_cashflow(): void
    {
        ['shop' => $shopA, 'admin' => $adminA, 'batch' => $batchA, 'session' => $sessionA] = $this->makeShop();

        app(SaleService::class)->createSale(
            shop: $shopA, cashier: $adminA, cashSession: $sessionA,
            items: [['product_batch_id' => $batchA->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $roleB = Role::where('slug', Role::ADMIN_BOUTIQUE)->first();
        $adminB = User::factory()->create(['role_id' => $roleB->id, 'shop_id' => $shopB->id]);
        $this->actingAs($adminB, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shopB->id, 'category' => 'loyer', 'amount' => 99999, 'expense_date' => now()->toDateString(),
        ])->assertCreated();

        $response = $this->actingAs($adminA, 'sanctum')->getJson('/api/accounting/cashflow?group_by=day');
        $totalSorties = collect($response->json())->sum('sorties');
        $this->assertEquals(0.0, $totalSorties, "Shop A admin must not see shop B's expenses.");
    }

    public function test_a_cashier_cannot_view_the_cashflow_report(): void
    {
        ['admin' => $admin] = $this->makeShop();
        $cashierRole = Role::firstOrCreate(['slug' => Role::CAISSIER], ['name' => Role::CAISSIER]);
        $cashier = User::factory()->create(['role_id' => $cashierRole->id, 'shop_id' => $admin->shop_id]);

        $this->actingAs($cashier, 'sanctum')->getJson('/api/accounting/cashflow')->assertForbidden();
    }
}
