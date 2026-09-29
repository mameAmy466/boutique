<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'organization_name' => 'Ma Boutique Sarl',
            'name' => 'Awa Diop',
            'email' => 'awa@example.com',
            'password' => 'password123',
            'phone' => '771234567',
            'shop_name' => 'Boutique Plateau',
            'shop_code' => 'BPL',
            'plan_code' => Plan::CODE_PRO,
        ], $overrides);
    }

    public function test_registration_creates_the_organization_shop_and_a_trial_subscription_and_logs_in(): void
    {
        $response = $this->postJson('/api/register', $this->payload());

        $response->assertCreated();
        $this->assertNotEmpty($response->json('token'));
        $this->assertSame('Awa Diop', $response->json('user.name'));
        $this->assertSame('super_admin', $response->json('user.role.slug'));

        $organization = Organization::where('name', 'Ma Boutique Sarl')->firstOrFail();
        $shop = Shop::where('code', 'BPL')->firstOrFail();
        $this->assertSame($organization->id, $shop->organization_id);

        $user = User::where('email', 'awa@example.com')->firstOrFail();
        $this->assertSame($organization->id, $user->organization_id);
        $this->assertNull($user->shop_id);
        $this->assertFalse($user->isPlatformAdmin());

        $subscription = $organization->currentSubscription();
        $this->assertSame(Subscription::STATUS_TRIAL, $subscription->status);
        $this->assertSame(Plan::CODE_PRO, $subscription->plan->code);
        $this->assertSame(now()->addDays(15)->toDateString(), $subscription->trial_ends_at->toDateString());

        // The returned token must actually authenticate.
        $me = $this->withHeader('Authorization', "Bearer {$response->json('token')}")->getJson('/api/me');
        $me->assertOk();
        $this->assertSame('awa@example.com', $me->json('email'));
    }

    public function test_registration_rejects_a_duplicate_email_with_a_french_message(): void
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        User::factory()->create(['email' => 'awa@example.com', 'role_id' => $role->id]);

        $response = $this->postJson('/api/register', $this->payload());
        $response->assertStatus(422);
        $this->assertSame(
            'Un compte existe déjà avec cette adresse e-mail.',
            $response->json('errors.email.0'),
        );
    }

    public function test_registration_rejects_a_duplicate_shop_code(): void
    {
        $organization = $this->createOrganization();
        Shop::create(['organization_id' => $organization->id, 'name' => 'Existante', 'code' => 'BPL']);

        $this->postJson('/api/register', $this->payload())->assertStatus(422);
    }

    public function test_registration_rejects_an_unknown_plan_code(): void
    {
        $this->postJson('/api/register', $this->payload(['plan_code' => 'ultra']))->assertStatus(422);
    }

    public function test_the_plans_endpoint_is_public_and_lists_the_launch_grid(): void
    {
        $response = $this->getJson('/api/plans');

        $response->assertOk();
        $codes = collect($response->json())->pluck('code');
        $this->assertEqualsCanonicalizing([Plan::CODE_SIMPLE, Plan::CODE_PRO, Plan::CODE_PRO_MAX], $codes->all());

        $pro = collect($response->json())->firstWhere('code', Plan::CODE_PRO);
        $this->assertEquals(15000, $pro['monthly_price']);
        $this->assertSame('5', $pro['features']['max_shops']);
    }
}
