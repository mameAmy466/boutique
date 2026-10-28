<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * What a plan does not include is refused by the API itself, whatever the
 * interface shows, and the Super Admin's changes apply at once.
 */
class PlanFeatureGatingTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: Organization, 1: User, 2: Shop} */
    private function client(string $planCode): array
    {
        $organization = $this->createOrganization($planCode);
        $shop = Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique', 'code' => 'B'.$organization->id]);
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $owner = User::factory()->create(['role_id' => $role->id, 'organization_id' => $organization->id]);

        return [$organization, $owner, $shop];
    }

    private function operator(): User
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

        return User::factory()->create([
            'role_id' => $role->id,
            'organization_id' => $this->createOrganization()->id,
            'is_platform_admin' => true,
        ]);
    }

    public function test_a_simple_client_only_reaches_the_modules_of_its_plan(): void
    {
        [, $owner] = $this->client(Plan::CODE_SIMPLE);
        $as = $this->actingAs($owner, 'sanctum');

        $as->getJson('/api/products')->assertOk();
        $as->getJson('/api/sales')->assertOk();
        $as->getJson('/api/customers')->assertOk();
        $as->getJson('/api/suppliers')->assertOk();

        $as->getJson('/api/employees')->assertForbidden()
            ->assertJsonPath('code', 'feature_not_included')
            ->assertJsonPath('feature', 'employees')
            ->assertJsonPath('plans', ['Pro', 'Pro Max']);
        $as->postJson('/api/employees', ['name' => 'Awa'])->assertForbidden();
        $as->getJson('/api/expenses')->assertForbidden()->assertJsonPath('feature', 'budget_enabled');
        $as->getJson('/api/accounting/cashflow')->assertForbidden()->assertJsonPath('plans', ['Pro Max']);
        $as->getJson('/api/journal-entries')->assertForbidden();
        $as->getJson('/api/accounts')->assertForbidden();
    }

    public function test_pro_includes_employees_but_not_the_financial_reports(): void
    {
        [, $owner] = $this->client(Plan::CODE_PRO);
        $as = $this->actingAs($owner, 'sanctum');

        $as->getJson('/api/employees')->assertOk();
        $as->getJson('/api/expenses')->assertOk();
        $as->getJson('/api/accounting/income-statement')->assertForbidden();
        $as->getJson('/api/accounting/balance-sheet')->assertForbidden();
    }

    public function test_the_client_receives_its_features_and_limits(): void
    {
        [, $owner] = $this->client(Plan::CODE_SIMPLE);

        $this->actingAs($owner, 'sanctum')->getJson('/api/subscription')->assertOk()
            ->assertJsonPath('features.employees', false)
            ->assertJsonPath('features.debts_enabled', true)
            ->assertJsonPath('features.excel_export', false)
            ->assertJsonPath('limits.max_shops', 1)
            ->assertJsonPath('limits.max_registers', 1)
            ->assertJsonPath('usage.max_shops', 1);
    }

    public function test_the_super_admins_changes_apply_immediately(): void
    {
        [, $owner] = $this->client(Plan::CODE_SIMPLE);
        $simple = Plan::where('code', Plan::CODE_SIMPLE)->firstOrFail();

        $this->actingAs($owner, 'sanctum')->getJson('/api/employees')->assertForbidden();

        $this->actingAs($this->operator(), 'sanctum')
            ->putJson("/api/platform/plans/{$simple->id}", ['features' => ['employees' => 'true']])
            ->assertOk();

        $this->actingAs($owner, 'sanctum')->getJson('/api/employees')->assertOk();
        $this->actingAs($owner, 'sanctum')->getJson('/api/subscription')->assertJsonPath('features.employees', true);
    }

    public function test_unknown_or_malformed_feature_values_are_rejected(): void
    {
        $simple = Plan::where('code', Plan::CODE_SIMPLE)->firstOrFail();
        $as = $this->actingAs($this->operator(), 'sanctum');

        $as->putJson("/api/platform/plans/{$simple->id}", ['features' => ['employees' => '3']])->assertStatus(422);
        $as->putJson("/api/platform/plans/{$simple->id}", ['features' => ['max_users' => 'true']])->assertStatus(422);
        $as->putJson("/api/platform/plans/{$simple->id}", ['features' => ['teleportation' => 'true']])->assertStatus(422);
    }

    public function test_salaries_need_no_employee_when_the_plan_has_no_employee_management(): void
    {
        [, $owner, $shop] = $this->client(Plan::CODE_PRO);
        Plan::where('code', Plan::CODE_PRO)->firstOrFail()
            ->features()->where('feature_key', 'employees')->update(['feature_value' => 'false']);

        $this->actingAs($owner, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'amount' => 50000,
            'expense_date' => now()->toDateString(),
        ])->assertCreated();
    }

    public function test_salaries_still_name_the_employee_when_the_plan_manages_employees(): void
    {
        [, $owner, $shop] = $this->client(Plan::CODE_PRO);

        $this->actingAs($owner, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'amount' => 50000,
            'expense_date' => now()->toDateString(),
        ])->assertStatus(422);
    }
}
