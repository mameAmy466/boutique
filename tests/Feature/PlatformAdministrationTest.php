<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class PlatformAdministrationTest extends TestCase
{
    use RefreshDatabase;

    private function makeOwner(Organization $organization, bool $platformAdmin = false): User
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique '.$organization->id, 'code' => 'B'.$organization->id]);

        return User::factory()->create([
            'role_id' => $role->id,
            'organization_id' => $organization->id,
            'is_platform_admin' => $platformAdmin,
        ]);
    }

    private function operator(): User
    {
        return $this->makeOwner($this->createOrganization(), platformAdmin: true);
    }

    public function test_a_clients_own_admin_cannot_reach_the_platform_space(): void
    {
        $client = $this->makeOwner($this->createOrganization());

        $this->actingAs($client, 'sanctum')->getJson('/api/platform/organizations')->assertForbidden();
        $this->actingAs($client, 'sanctum')->getJson('/api/platform/dashboard')->assertForbidden();
        $this->actingAs($client, 'sanctum')->putJson('/api/platform/plans/1', ['monthly_price' => 1])->assertForbidden();
    }

    public function test_the_operator_sees_every_client_with_its_subscription(): void
    {
        $operator = $this->operator();
        $clientOrg = $this->createOrganization(Plan::CODE_SIMPLE);
        $owner = $this->makeOwner($clientOrg);

        $rows = collect($this->actingAs($operator, 'sanctum')->getJson('/api/platform/organizations')->assertOk()->json());

        $row = $rows->firstWhere('id', $clientOrg->id);
        $this->assertSame('simple', $row['subscription']['plan']['code']);
        $this->assertSame($owner->email, $row['owner']['email']);
        $this->assertSame(1, $row['shops_count']);
        $this->assertCount(2, $rows);

        $this->actingAs($operator, 'sanctum')->getJson('/api/platform/dashboard')
            ->assertOk()->assertJsonPath('organizations.total', 2);
    }

    public function test_a_suspended_client_is_blocked_by_the_api_until_reactivated(): void
    {
        $operator = $this->operator();
        $clientOrg = $this->createOrganization();
        $client = $this->makeOwner($clientOrg);

        $this->actingAs($client, 'sanctum')->getJson('/api/products')->assertOk();

        $this->actingAs($operator, 'sanctum')
            ->postJson("/api/platform/organizations/{$clientOrg->id}/suspend", ['reason' => 'Impayé'])
            ->assertOk()->assertJsonPath('status', 'suspended');

        $this->actingAs($client, 'sanctum')->getJson('/api/products')
            ->assertStatus(402)->assertJsonPath('code', 'organization_suspended');
        $this->actingAs($client, 'sanctum')->postJson('/api/products', ['name' => 'X', 'reference' => 'X'])
            ->assertStatus(402);

        // They can still see why, and log out.
        $this->actingAs($client, 'sanctum')->getJson('/api/subscription')
            ->assertOk()->assertJsonPath('access.code', 'organization_suspended');
        $this->actingAs($client, 'sanctum')->getJson('/api/me')->assertOk();

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$clientOrg->id}/reactivate")->assertOk();
        $this->actingAs($client, 'sanctum')->getJson('/api/products')->assertOk();

        $this->assertSame(
            ['organization_suspended', 'organization_reactivated'],
            PlatformAuditLog::where('organization_id', $clientOrg->id)->orderBy('id')->pluck('action')->all(),
        );
    }

    public function test_the_operator_cannot_suspend_their_own_organization(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator, 'sanctum')
            ->postJson("/api/platform/organizations/{$operator->organization_id}/suspend")
            ->assertStatus(422);
    }

    public function test_an_expired_subscription_blocks_access_after_the_grace_period(): void
    {
        $clientOrg = $this->createOrganization();
        $client = $this->makeOwner($clientOrg);
        $clientOrg->currentSubscription()->update([
            'current_period_end' => now()->subDays(3)->toDateString(),
            'grace_days' => 7,
        ]);

        // Within the grace period: still usable, flagged as late.
        $this->actingAs($client, 'sanctum')->getJson('/api/products')->assertOk();
        $this->assertSame(Subscription::STATUS_PAST_DUE, $clientOrg->currentSubscription()->status);

        Carbon::setTestNow(now()->addDays(5));
        $this->artisan('subscriptions:check')->assertSuccessful();
        $this->assertSame(Subscription::STATUS_EXPIRED, $clientOrg->currentSubscription()->status);

        $this->actingAs($client, 'sanctum')->getJson('/api/products')
            ->assertStatus(402)->assertJsonPath('code', 'subscription_expired');
        Carbon::setTestNow();
    }

    public function test_an_ended_trial_moves_to_past_due_then_expired(): void
    {
        $clientOrg = $this->createOrganization();
        $clientOrg->currentSubscription()->update([
            'status' => Subscription::STATUS_TRIAL,
            'trial_ends_at' => now()->subDay()->toDateString(),
            'current_period_end' => null,
            'grace_days' => 2,
        ]);

        $this->artisan('subscriptions:check')->assertSuccessful();
        $this->assertSame(Subscription::STATUS_PAST_DUE, $clientOrg->currentSubscription()->status);

        Carbon::setTestNow(now()->addDays(3));
        $this->artisan('subscriptions:check')->assertSuccessful();
        $this->assertSame(Subscription::STATUS_EXPIRED, $clientOrg->currentSubscription()->status);
        Carbon::setTestNow();
    }

    public function test_recording_a_payment_extends_the_period_and_reactivates_the_client(): void
    {
        Carbon::setTestNow('2026-10-24');
        $operator = $this->operator();
        $clientOrg = $this->createOrganization(Plan::CODE_SIMPLE);
        $client = $this->makeOwner($clientOrg);
        $clientOrg->currentSubscription()->update(['status' => Subscription::STATUS_EXPIRED, 'current_period_end' => '2026-09-30']);
        $clientOrg->update(['status' => Organization::STATUS_SUSPENDED]);

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$clientOrg->id}/payments", [
            'amount' => 30000, 'method' => 'wave', 'months' => 3, 'plan_code' => 'pro',
        ])->assertCreated()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('subscription.status', 'active')
            ->assertJsonPath('subscription.plan.code', 'pro')
            ->assertJsonPath('subscription.current_period_end', '2027-01-23');

        $this->actingAs($client, 'sanctum')->getJson('/api/products')->assertOk();

        // Paying again while active extends from the current end date.
        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$clientOrg->id}/payments", [
            'amount' => 15000, 'method' => 'cash', 'months' => 1,
        ])->assertCreated()->assertJsonPath('subscription.current_period_end', '2027-02-23');

        $this->actingAs($operator, 'sanctum')->getJson('/api/platform/dashboard')
            ->assertJsonPath('revenue.month', 45000);
        Carbon::setTestNow();
    }

    public function test_the_operator_can_change_a_plans_price_and_features(): void
    {
        $operator = $this->operator();
        $simple = Plan::where('code', Plan::CODE_SIMPLE)->firstOrFail();

        $this->actingAs($operator, 'sanctum')->putJson("/api/platform/plans/{$simple->id}", [
            'monthly_price' => 10000,
            'features' => ['max_users' => '3', 'excel_export' => 'true'],
        ])->assertOk();

        $this->assertEquals(10000, $simple->fresh()->monthly_price);
        $this->assertSame('3', $simple->features()->where('feature_key', 'max_users')->value('feature_value'));

        $this->actingAs($operator, 'sanctum')->putJson("/api/platform/plans/{$simple->id}", [
            'features' => ['max_users' => 'beaucoup'],
        ])->assertStatus(422);
    }

    public function test_a_client_must_be_closed_before_it_can_be_deleted(): void
    {
        $operator = $this->operator();
        $clientOrg = $this->createOrganization();
        $client = $this->makeOwner($clientOrg);

        $this->actingAs($operator, 'sanctum')->deleteJson("/api/platform/organizations/{$clientOrg->id}", [
            'confirm_name' => $clientOrg->name,
        ])->assertStatus(422);

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$clientOrg->id}/close")->assertOk();
        $this->actingAs($operator, 'sanctum')->deleteJson("/api/platform/organizations/{$clientOrg->id}", [
            'confirm_name' => 'mauvais nom',
        ])->assertStatus(422);
        $this->actingAs($operator, 'sanctum')->deleteJson("/api/platform/organizations/{$clientOrg->id}", [
            'confirm_name' => $clientOrg->name,
        ])->assertNoContent();

        $this->assertNull(Organization::find($clientOrg->id));
        $this->assertNull(User::find($client->id));
        $this->assertSame(0, Shop::withoutGlobalScopes()->where('organization_id', $clientOrg->id)->count());
    }

    public function test_the_operator_can_create_a_client(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator, 'sanctum')->postJson('/api/platform/organizations', [
            'organization_name' => 'Alimentation Ndiaye', 'name' => 'Fatou Ndiaye', 'email' => 'fatou@example.com',
            'password' => 'secret123', 'shop_name' => 'Ndiaye Market', 'shop_code' => 'NDIAYE',
            'plan_code' => 'simple', 'trial_days' => 30,
        ])->assertCreated()
            ->assertJsonPath('subscription.status', 'trial')
            ->assertJsonPath('owner.email', 'fatou@example.com')
            ->assertJsonPath('subscription.trial_ends_at', now()->addDays(30)->toDateString());
    }

    public function test_the_operator_sees_a_clients_activity_without_its_records(): void
    {
        $operator = $this->operator();
        $clientOrg = $this->createOrganization();
        $client = $this->makeOwner($clientOrg);
        $shop = Shop::withoutGlobalScopes()->where('organization_id', $clientOrg->id)->firstOrFail();
        $register = \App\Models\CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = \App\Models\CashSession::create([
            'cash_register_id' => $register->id, 'user_id' => $client->id,
            'opening_amount' => 0, 'opened_at' => now(), 'status' => \App\Models\CashSession::STATUS_OPEN,
        ]);
        foreach ([1500, 2500] as $total) {
            \App\Models\Sale::create([
                'sale_number' => 'V-'.$total, 'shop_id' => $shop->id, 'user_id' => $client->id,
                'cash_session_id' => $session->id, 'subtotal' => $total, 'total' => $total, 'payment_method' => 'cash',
            ]);
        }

        $this->actingAs($operator, 'sanctum')->getJson("/api/platform/organizations/{$clientOrg->id}/activity")
            ->assertOk()
            ->assertJsonPath('sales.month_count', 2)
            ->assertJsonPath('sales.month_revenue', 4000)
            ->assertJsonPath('usage.shops', 1)
            ->assertJsonPath('usage.registers', 1)
            ->assertJsonMissingPath('sales.0');

        $this->actingAs($client, 'sanctum')->getJson("/api/platform/organizations/{$clientOrg->id}/activity")->assertForbidden();
    }

    public function test_clients_can_be_found_by_identifier(): void
    {
        $operator = $this->operator();
        $clientOrg = $this->createOrganization();

        $rows = $this->actingAs($operator, 'sanctum')->getJson('/api/platform/organizations?search=%23'.$clientOrg->id)->json();

        $this->assertSame([$clientOrg->id], array_column($rows, 'id'));
    }
}
