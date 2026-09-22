<?php

namespace Tests\Feature;

use App\Models\Account;
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

class AccountingReportsTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopWithBatch(string $code = 'BTA'): array
    {
        $shop = Shop::create(['name' => "Boutique {$code}", 'code' => $code]);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $product = Product::create(['name' => 'Sac', 'reference' => "REF-{$code}", 'unit' => 'pcs', 'min_stock' => 1]);
        $batch = ProductBatch::create([
            'batch_code' => "{$code}-2026-000001", 'product_id' => $product->id, 'shop_id' => $shop->id,
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

    public function test_the_ledger_computes_an_opening_balance_and_a_running_balance(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        // First sale happens "before" the report window, second one "inside" it.
        \Illuminate\Support\Carbon::setTestNow('2026-01-10');
        app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        \Illuminate\Support\Carbon::setTestNow('2026-02-05');
        app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 2, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );
        \Illuminate\Support\Carbon::setTestNow();

        $caisse = Account::where('code', '571')->firstOrFail();

        $response = $this->actingAs($admin, 'sanctum')->getJson(
            "/api/accounting/ledger/{$caisse->id}?from=2026-02-01&to=2026-02-28"
        );
        $response->assertOk();

        $this->assertEquals(1500.0, $response->json('opening_balance'));
        $this->assertCount(1, $response->json('movements'));
        $this->assertEquals(3000.0, $response->json('movements.0.debit'));
        $this->assertEquals(4500.0, $response->json('closing_balance'));
    }

    public function test_the_trial_balance_always_keeps_total_debit_equal_to_total_credit(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 3, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'electricite', 'amount' => 20000,
            'payment_method' => 'cash', 'expense_date' => now()->toDateString(),
        ])->assertCreated();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/accounting/balance');
        $response->assertOk();

        $totals = $response->json('totals');
        $this->assertEquals($totals['debit'], $totals['credit']);
        $this->assertGreaterThan(0, $totals['debit']);
    }

    public function test_reports_are_scoped_to_the_shop_admins_own_shop(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shopA, 'admin' => $adminA, 'batch' => $batchA, 'session' => $sessionA] = $this->makeShopWithBatch('BTA');
        ['shop' => $shopB, 'admin' => $adminB, 'batch' => $batchB, 'session' => $sessionB] = $this->makeShopWithBatch('BTB');

        app(SaleService::class)->createSale(
            shop: $shopA, cashier: $adminA, cashSession: $sessionA,
            items: [['product_batch_id' => $batchA->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );
        app(SaleService::class)->createSale(
            shop: $shopB, cashier: $adminB, cashSession: $sessionB,
            items: [['product_batch_id' => $batchB->id, 'quantity' => 5, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        $caisse = Account::where('code', '571')->firstOrFail();

        $responseA = $this->actingAs($adminA, 'sanctum')->getJson("/api/accounting/ledger/{$caisse->id}");
        $this->assertEquals(1500.0, $responseA->json('closing_balance'));

        $balanceA = $this->actingAs($adminA, 'sanctum')->getJson('/api/accounting/balance');
        $caisseRowA = collect($balanceA->json('rows'))->firstWhere('account.code', '571');
        $this->assertEquals(1500.0, $caisseRowA['debit']);
    }
}
