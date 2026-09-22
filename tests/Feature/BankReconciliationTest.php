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
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BankReconciliationTest extends TestCase
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

    public function test_importing_a_csv_creates_statement_lines(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithBatch();
        $bank = Account::where('code', '512')->firstOrFail();

        $csv = "2026-09-01,Virement client,15000\n2026-09-02,Frais bancaires,-2500\n";
        $file = UploadedFile::fake()->createWithContent('releve.csv', $csv);

        $response = $this->actingAs($admin, 'sanctum')->post('/api/bank-statement-lines/import', [
            'shop_id' => $shop->id,
            'account_id' => $bank->id,
            'file' => $file,
        ]);

        $response->assertOk();
        $this->assertSame(2, $response->json('imported'));
        $this->assertDatabaseHas('bank_statement_lines', ['label' => 'Virement client', 'amount' => 15000]);
    }

    public function test_matching_a_statement_line_to_a_journal_entry_line_marks_it_reconciled(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();
        $bank = Account::where('code', '512')->firstOrFail();

        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'card', taxRate: 0,
        );

        $unmatched = $this->actingAs($admin, 'sanctum')->getJson("/api/bank-statement-lines/unmatched-entries?account_id={$bank->id}");
        $unmatched->assertOk();
        $this->assertCount(1, $unmatched->json());
        $lineId = $unmatched->json('0.id');

        $statementLine = $this->actingAs($admin, 'sanctum')->postJson('/api/bank-statement-lines', [
            'shop_id' => $shop->id, 'account_id' => $bank->id,
            'statement_date' => now()->toDateString(), 'label' => 'Vente carte', 'amount' => 1500,
        ])->json();

        $match = $this->actingAs($admin, 'sanctum')->postJson("/api/bank-statement-lines/{$statementLine['id']}/match", [
            'journal_entry_line_id' => $lineId,
        ]);
        $match->assertOk();
        $this->assertTrue($match->json('reconciled'));

        // Now that it's matched, it no longer shows up as unmatched.
        $afterMatch = $this->actingAs($admin, 'sanctum')->getJson("/api/bank-statement-lines/unmatched-entries?account_id={$bank->id}");
        $this->assertCount(0, $afterMatch->json());
    }

    public function test_a_cashier_cannot_import_or_match_statement_lines(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithBatch();
        $role = Role::firstOrCreate(['slug' => Role::CAISSIER], ['name' => Role::CAISSIER]);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);
        $bank = Account::where('code', '512')->first() ?? Account::create(['code' => '512', 'name' => 'Banques', 'type' => 'tresorerie']);

        $this->actingAs($cashier, 'sanctum')->postJson('/api/bank-statement-lines', [
            'shop_id' => $shop->id, 'account_id' => $bank->id,
            'statement_date' => now()->toDateString(), 'label' => 'Test', 'amount' => 1000,
        ])->assertForbidden();
    }
}
