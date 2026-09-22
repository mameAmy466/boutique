<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AccountingJournal;
use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\AccountingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingRuleRobustnessTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

        return User::factory()->create(['role_id' => $role->id]);
    }

    public function test_a_rule_cannot_use_the_same_account_for_debit_and_credit(): void
    {
        $this->seed(AccountingSeeder::class);
        $superAdmin = $this->superAdmin();
        $account = Account::where('code', '701')->firstOrFail();
        $journal = AccountingJournal::first();

        $this->actingAs($superAdmin, 'sanctum')->postJson('/api/accounting-rules', [
            'event' => 'supplier_debt_created',
            'debit_account_id' => $account->id,
            'credit_account_id' => $account->id,
            'journal_id' => $journal->id,
        ])->assertStatus(422);
    }

    public function test_a_rule_cannot_reference_an_inactive_account(): void
    {
        $this->seed(AccountingSeeder::class);
        $superAdmin = $this->superAdmin();
        $account = Account::where('code', '701')->firstOrFail();
        $account->update(['is_active' => false]);
        $other = Account::where('code', '411')->firstOrFail();
        $journal = AccountingJournal::first();

        $this->actingAs($superAdmin, 'sanctum')->postJson('/api/accounting-rules', [
            'event' => 'supplier_debt_created',
            'debit_account_id' => $other->id,
            'credit_account_id' => $account->id,
            'journal_id' => $journal->id,
        ])->assertStatus(422);
    }

    public function test_a_static_rule_requires_both_accounts_and_a_journal(): void
    {
        $this->seed(AccountingSeeder::class);
        $superAdmin = $this->superAdmin();
        $account = Account::where('code', '701')->firstOrFail();

        $this->actingAs($superAdmin, 'sanctum')->postJson('/api/accounting-rules', [
            'event' => 'supplier_debt_created',
            'debit_account_id' => $account->id,
        ])->assertStatus(422);
    }

    public function test_the_coverage_endpoint_lists_configured_and_missing_events(): void
    {
        $this->seed(AccountingSeeder::class);
        $superAdmin = $this->superAdmin();

        $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/accounting-rules/coverage');
        $response->assertOk();

        $this->assertGreaterThan(0, $response->json('total'));
        $this->assertGreaterThan(0, $response->json('configured_count'));

        $sale = collect($response->json('rows'))->firstWhere('event', 'sale');
        $this->assertTrue($sale['configured']);
    }

    public function test_the_integrity_check_reports_balanced_when_all_entries_balance(): void
    {
        $this->seed(AccountingSeeder::class);
        $superAdmin = $this->superAdmin();
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);

        $journal = AccountingJournal::first();
        $cash = Account::where('code', '571')->firstOrFail();
        $sales = Account::where('code', '701')->firstOrFail();

        $entry = JournalEntry::create([
            'journal_id' => $journal->id, 'shop_id' => $shop->id, 'entry_date' => now()->toDateString(),
            'reference' => 'TEST-1', 'label' => 'Test',
        ]);
        JournalEntryLine::create(['journal_entry_id' => $entry->id, 'account_id' => $cash->id, 'debit' => 1000, 'credit' => 0]);
        JournalEntryLine::create(['journal_entry_id' => $entry->id, 'account_id' => $sales->id, 'debit' => 0, 'credit' => 1000]);

        $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/accounting/integrity-check');
        $response->assertOk();
        $this->assertTrue($response->json('balanced'));
        $this->assertCount(0, $response->json('unbalanced_entries'));
    }

    public function test_the_integrity_check_flags_an_unbalanced_entry(): void
    {
        $this->seed(AccountingSeeder::class);
        $superAdmin = $this->superAdmin();
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);

        $journal = AccountingJournal::first();
        $cash = Account::where('code', '571')->firstOrFail();
        $sales = Account::where('code', '701')->firstOrFail();

        $entry = JournalEntry::create([
            'journal_id' => $journal->id, 'shop_id' => $shop->id, 'entry_date' => now()->toDateString(),
            'reference' => 'BAD-1', 'label' => 'Écriture cassée',
        ]);
        JournalEntryLine::create(['journal_entry_id' => $entry->id, 'account_id' => $cash->id, 'debit' => 1000, 'credit' => 0]);
        JournalEntryLine::create(['journal_entry_id' => $entry->id, 'account_id' => $sales->id, 'debit' => 0, 'credit' => 900]);

        $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/accounting/integrity-check');
        $response->assertOk();
        $this->assertFalse($response->json('balanced'));
        $this->assertCount(1, $response->json('unbalanced_entries'));
        $this->assertEquals(100.0, $response->json('unbalanced_entries.0.diff'));
    }
}
