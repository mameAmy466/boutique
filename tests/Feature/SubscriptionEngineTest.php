<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubscriptionEngineTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrgOnPlan(string $planCode): Organization
    {
        return $this->createOrganization($planCode);
    }

    private function makeSuperAdmin(Organization $organization): User
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

        return User::factory()->create(['role_id' => $role->id, 'organization_id' => $organization->id]);
    }

    public function test_plans_are_seeded_with_their_launch_quotas(): void
    {
        $simple = Plan::where('code', Plan::CODE_SIMPLE)->firstOrFail();
        $proMax = Plan::where('code', Plan::CODE_PRO_MAX)->firstOrFail();

        $this->assertSame('1', $simple->features()->where('feature_key', 'max_shops')->value('feature_value'));
        $this->assertSame('2', $simple->features()->where('feature_key', 'max_users')->value('feature_value'));
        $this->assertSame('false', $simple->features()->where('feature_key', 'budget_enabled')->value('feature_value'));

        $this->assertSame('5', $proMax->features()->where('feature_key', 'max_shops')->value('feature_value'));
        $this->assertSame('unlimited', $proMax->features()->where('feature_key', 'max_products')->value('feature_value'));
        $this->assertSame('true', $proMax->features()->where('feature_key', 'multi_shop_dashboard')->value('feature_value'));
    }

    public function test_limit_adds_the_subscriptions_extra_quantity_on_top_of_the_plan(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_SIMPLE);
        $organization->currentSubscription()->update(['extra_shops' => 2]);

        $this->assertSame(3, app(SubscriptionService::class)->limit($organization, 'max_shops'));
    }

    public function test_limit_is_null_for_an_unlimited_feature(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);

        $this->assertNull(app(SubscriptionService::class)->limit($organization, 'max_products'));
    }

    public function test_a_simple_plan_organization_cannot_create_a_second_shop(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_SIMPLE);
        $admin = $this->makeSuperAdmin($organization);
        Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique A', 'code' => 'BTA']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/shops', [
            'name' => 'Boutique B', 'code' => 'BTB',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('shops', 1);
    }

    public function test_a_pro_max_organization_can_create_up_to_five_shops(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $admin = $this->makeSuperAdmin($organization);

        for ($i = 1; $i <= 5; $i++) {
            $this->actingAs($admin, 'sanctum')->postJson('/api/shops', [
                'name' => "Boutique {$i}", 'code' => "BT{$i}",
            ])->assertCreated();
        }

        $this->actingAs($admin, 'sanctum')->postJson('/api/shops', [
            'name' => 'Boutique 6', 'code' => 'BT6',
        ])->assertStatus(422);

        $this->assertDatabaseCount('shops', 5);
    }

    public function test_a_new_shop_is_always_attached_to_its_creators_own_organization(): void
    {
        $organizationA = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $organizationB = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $adminA = $this->makeSuperAdmin($organizationA);

        $response = $this->actingAs($adminA, 'sanctum')->postJson('/api/shops', [
            'name' => 'Boutique A2', 'code' => 'BTA2',
        ]);
        $response->assertCreated();

        $shop = Shop::findOrFail($response->json('id'));
        $this->assertSame($organizationA->id, $shop->organization_id);
        $this->assertNotSame($organizationB->id, $shop->organization_id);
    }

    public function test_a_super_admin_cannot_view_or_edit_another_organizations_shop(): void
    {
        $organizationA = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $organizationB = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $adminA = $this->makeSuperAdmin($organizationA);
        $shopB = Shop::create(['organization_id' => $organizationB->id, 'name' => 'Boutique B', 'code' => 'BTB']);

        $this->actingAs($adminA, 'sanctum')->getJson("/api/shops/{$shopB->id}")->assertForbidden();
        $this->actingAs($adminA, 'sanctum')->putJson("/api/shops/{$shopB->id}", ['name' => 'Renommée'])->assertForbidden();
    }

    public function test_shops_index_only_lists_the_actors_own_organization(): void
    {
        $organizationA = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $organizationB = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $adminA = $this->makeSuperAdmin($organizationA);
        Shop::create(['organization_id' => $organizationA->id, 'name' => 'Boutique A', 'code' => 'BTA']);
        Shop::create(['organization_id' => $organizationB->id, 'name' => 'Boutique B', 'code' => 'BTB']);

        $response = $this->actingAs($adminA, 'sanctum')->getJson('/api/shops');

        $response->assertOk();
        $this->assertCount(1, $response->json());
        $this->assertSame('Boutique A', $response->json('0.name'));
    }

    public function test_a_simple_plan_organization_cannot_record_an_expense(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_SIMPLE);
        $shop = Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id, 'organization_id' => $organization->id]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'loyer', 'amount' => 10000, 'expense_date' => now()->toDateString(),
        ]);

        $response->assertStatus(403);
        $this->assertDatabaseCount('expenses', 0);
    }

    public function test_a_pro_plan_organization_can_record_an_expense(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO);
        $shop = Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id, 'organization_id' => $organization->id]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'loyer', 'amount' => 10000, 'expense_date' => now()->toDateString(),
        ])->assertCreated();
    }

    public function test_the_general_dashboard_hides_shop_comparison_below_pro_max(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO);
        $admin = $this->makeSuperAdmin($organization);
        Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique A', 'code' => 'BTA']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/general');

        $response->assertOk();
        $this->assertSame([], $response->json('shops_comparison'));
    }

    public function test_the_general_dashboard_shows_shop_comparison_on_pro_max(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $admin = $this->makeSuperAdmin($organization);
        Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique A', 'code' => 'BTA', 'status' => 'active']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/dashboard/general');

        $response->assertOk();
        $this->assertCount(1, $response->json('shops_comparison'));
    }

    public function test_the_general_dashboard_never_leaks_another_organizations_shop(): void
    {
        $organizationA = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $organizationB = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $adminA = $this->makeSuperAdmin($organizationA);
        Shop::create(['organization_id' => $organizationA->id, 'name' => 'Boutique A', 'code' => 'BTA']);
        Shop::create(['organization_id' => $organizationB->id, 'name' => 'Boutique B', 'code' => 'BTB']);

        $response = $this->actingAs($adminA, 'sanctum')->getJson('/api/dashboard/general');

        $response->assertOk();
        $this->assertSame(1, $response->json('shops.total'));
    }

    public function test_a_cancelled_subscription_does_not_grant_access(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $organization->currentSubscription()->update(['status' => Subscription::STATUS_CANCELLED]);

        $this->assertFalse(app(SubscriptionService::class)->hasAccess($organization));
    }

    public function test_a_past_due_subscription_still_grants_access_during_the_grace_period(): void
    {
        $organization = $this->makeOrgOnPlan(Plan::CODE_PRO_MAX);
        $organization->currentSubscription()->update(['status' => Subscription::STATUS_PAST_DUE]);

        $this->assertTrue(app(SubscriptionService::class)->hasAccess($organization));
    }
}
