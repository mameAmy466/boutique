<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\ClientDebt;
use App\Models\Customer;
use App\Models\JournalEntry;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\SupplierDebt;
use App\Models\User;
use App\Services\AccountingEntryService;
use App\Services\SaleService;
use Database\Seeders\AccountingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingEngineTest extends TestCase
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

    private function assertBalanced(JournalEntry $entry): void
    {
        $entry->load('lines');
        $this->assertSame(
            round((float) $entry->lines->sum('debit'), 2),
            round((float) $entry->lines->sum('credit'), 2),
            'A journal entry must always balance: total debit must equal total credit.',
        );
    }

    public function test_a_cash_sale_posts_a_balanced_entry_debiting_caisse_and_crediting_ventes(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 2, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        $entry = JournalEntry::with('lines.account', 'journal')
            ->where('source_type', Sale::class)->where('source_id', $sale->id)->first();

        $this->assertNotNull($entry);
        $this->assertSame('VE', $entry->journal->code);
        $this->assertBalanced($entry);

        $debitLine = $entry->lines->firstWhere('debit', '>', 0);
        $creditLine = $entry->lines->firstWhere('credit', '>', 0);
        $this->assertSame('571', $debitLine->account->code);
        $this->assertSame('701', $creditLine->account->code);
        $this->assertEquals(3000.0, (float) $debitLine->debit);
    }

    public function test_a_card_sale_debits_banque_instead_of_caisse(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'card',
        );

        $entry = JournalEntry::with('lines.account')
            ->where('source_type', Sale::class)->where('source_id', $sale->id)->first();

        $debitLine = $entry->lines->firstWhere('debit', '>', 0);
        $this->assertSame('512', $debitLine->account->code);
    }

    public function test_cancelling_a_sale_posts_a_reversing_entry(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        app(SaleService::class)->cancelSale($sale, $admin, 'Erreur de saisie');

        $entries = JournalEntry::with('lines.account')
            ->where('source_type', Sale::class)->where('source_id', $sale->id)
            ->orderBy('id')->get();

        $this->assertCount(2, $entries);
        $this->assertBalanced($entries[0]);
        $this->assertBalanced($entries[1]);

        // The reversal swaps debit and credit on each account versus the original.
        $original = $entries[0]->lines->keyBy('account_id');
        $reversal = $entries[1]->lines->keyBy('account_id');
        foreach ($original as $accountId => $line) {
            $this->assertEquals((float) $line->debit, (float) $reversal[$accountId]->credit);
            $this->assertEquals((float) $line->credit, (float) $reversal[$accountId]->debit);
        }
    }

    public function test_an_expense_debits_its_categorys_charge_account_and_credits_treasury(): void
    {
        $this->seed(AccountingSeeder::class);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'electricite', 'amount' => 45000,
            'payment_method' => 'transfer', 'expense_date' => now()->toDateString(),
        ]);
        $response->assertCreated();

        $entry = JournalEntry::with('lines.account', 'journal')
            ->where('source_type', \App\Models\Expense::class)->where('source_id', $response->json('id'))->first();

        $this->assertNotNull($entry);
        $this->assertSame('BQ', $entry->journal->code);
        $this->assertBalanced($entry);
        $debitLine = $entry->lines->firstWhere('debit', '>', 0);
        $creditLine = $entry->lines->firstWhere('credit', '>', 0);
        $this->assertSame('6052', $debitLine->account->code);
        $this->assertSame('512', $creditLine->account->code);
    }

    public function test_a_supplier_debt_posts_a_static_entry_in_the_od_journal(): void
    {
        $this->seed(AccountingSeeder::class);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shop->id, 'supplier_id' => $supplier->id, 'amount' => 200000,
        ]);

        $entry = JournalEntry::with('lines.account', 'journal')
            ->where('source_type', SupplierDebt::class)->where('source_id', $response->json('id'))->first();

        $this->assertNotNull($entry);
        $this->assertSame('OD', $entry->journal->code);
        $this->assertBalanced($entry);
        $debitLine = $entry->lines->firstWhere('debit', '>', 0);
        $creditLine = $entry->lines->firstWhere('credit', '>', 0);
        $this->assertSame('601', $debitLine->account->code);
        $this->assertSame('401', $creditLine->account->code);

        // Paying it back debits Fournisseurs and credits treasury (cash by default).
        $payment = $this->actingAs($admin, 'sanctum')->postJson("/api/supplier-debts/{$response->json('id')}/payments", [
            'amount' => 80000, 'paid_at' => now()->toDateString(),
        ]);
        $payment->assertOk();

        $paymentEntry = JournalEntry::with('lines.account', 'journal')
            ->where('source_type', \App\Models\SupplierDebtPayment::class)->latest('id')->first();
        $this->assertNotNull($paymentEntry);
        $this->assertSame('CA', $paymentEntry->journal->code);
        $this->assertBalanced($paymentEntry);
        $debitLine = $paymentEntry->lines->firstWhere('debit', '>', 0);
        $creditLine = $paymentEntry->lines->firstWhere('credit', '>', 0);
        $this->assertSame('401', $debitLine->account->code);
        $this->assertSame('571', $creditLine->account->code);
    }

    public function test_a_client_debt_posts_a_static_entry_and_its_payment_credits_clients(): void
    {
        $this->seed(AccountingSeeder::class);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Restaurant Le Baobab']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 90000,
        ]);

        $entry = JournalEntry::with('lines.account', 'journal')
            ->where('source_type', ClientDebt::class)->where('source_id', $response->json('id'))->first();

        $debitLine = $entry->lines->firstWhere('debit', '>', 0);
        $creditLine = $entry->lines->firstWhere('credit', '>', 0);
        $this->assertSame('411', $debitLine->account->code);
        $this->assertSame('701', $creditLine->account->code);
        $this->assertSame('OD', $entry->journal->code);

        $payment = $this->actingAs($admin, 'sanctum')->postJson("/api/client-debts/{$response->json('id')}/payments", [
            'amount' => 30000, 'paid_at' => now()->toDateString(), 'payment_method' => 'cash',
        ]);
        $payment->assertOk();

        $paymentEntry = JournalEntry::with('lines.account', 'journal')
            ->where('source_type', \App\Models\ClientDebtPayment::class)->latest('id')->first();
        $this->assertSame('CA', $paymentEntry->journal->code);
        $debitLine = $paymentEntry->lines->firstWhere('debit', '>', 0);
        $creditLine = $paymentEntry->lines->firstWhere('credit', '>', 0);
        $this->assertSame('571', $debitLine->account->code);
        $this->assertSame('411', $creditLine->account->code);
    }

    public function test_recording_never_throws_when_the_plan_comptable_is_not_configured(): void
    {
        // The seed_default_accounting_chart migration seeds a default plan
        // comptable on every migrate, so simulate "not configured" (e.g. an
        // admin cleared the rules) by removing them after migrating.
        \App\Models\AccountingRule::query()->delete();
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch, 'session' => $session] = $this->makeShopWithBatch();

        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $admin, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        $this->assertSame('completed', $sale->status);
        $this->assertSame(0, JournalEntry::count());

        $result = app(AccountingEntryService::class)->recordSale($sale);
        $this->assertNull($result);
    }

    public function test_only_super_admin_can_manage_the_plan_comptable(): void
    {
        $this->seed(AccountingSeeder::class);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $adminRole = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $shopAdmin = User::factory()->create(['role_id' => $adminRole->id, 'shop_id' => $shop->id]);
        $superRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $superAdmin = User::factory()->create(['role_id' => $superRole->id]);

        $this->actingAs($shopAdmin, 'sanctum')->postJson('/api/accounts', [
            'code' => '9999', 'name' => 'Test', 'type' => 'charge',
        ])->assertForbidden();

        // A shop admin may still read the chart of accounts (e.g. to pick one
        // on their own grand livre), just not create/update/delete it.
        $this->actingAs($shopAdmin, 'sanctum')->getJson('/api/accounts')->assertOk();

        $this->actingAs($superAdmin, 'sanctum')->postJson('/api/accounts', [
            'code' => '9999', 'name' => 'Test', 'type' => 'charge',
        ])->assertCreated();

        $this->actingAs($shopAdmin, 'sanctum')->getJson('/api/accounting-rules')->assertForbidden();
        $this->actingAs($superAdmin, 'sanctum')->getJson('/api/accounting-rules')->assertOk();
    }

    public function test_an_account_referenced_by_a_rule_cannot_be_deleted(): void
    {
        $this->seed(AccountingSeeder::class);
        $superRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $superAdmin = User::factory()->create(['role_id' => $superRole->id]);

        $account = Account::where('code', '701')->firstOrFail();

        $this->actingAs($superAdmin, 'sanctum')->deleteJson("/api/accounts/{$account->id}")->assertStatus(422);
        $this->assertDatabaseHas('accounts', ['id' => $account->id]);
    }

    public function test_a_shop_admin_only_sees_their_own_shops_journal_entries(): void
    {
        $this->seed(AccountingSeeder::class);
        ['shop' => $shopA, 'admin' => $adminA, 'batch' => $batchA, 'session' => $sessionA] = $this->makeShopWithBatch();

        app(SaleService::class)->createSale(
            shop: $shopA, cashier: $adminA, cashSession: $sessionA,
            items: [['product_batch_id' => $batchA->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $roleB = Role::where('slug', Role::ADMIN_BOUTIQUE)->first();
        $adminB = User::factory()->create(['role_id' => $roleB->id, 'shop_id' => $shopB->id]);

        $response = $this->actingAs($adminB, 'sanctum')->getJson('/api/journal-entries');
        $response->assertOk();
        $this->assertCount(0, $response->json());

        $responseA = $this->actingAs($adminA, 'sanctum')->getJson('/api/journal-entries');
        $this->assertCount(1, $responseA->json());
    }
}
