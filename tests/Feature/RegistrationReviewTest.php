<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\PlatformAuditLog;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A signup stays unusable until the platform admin accepts it and the activation conditions are met. */
class RegistrationReviewTest extends TestCase
{
    use RefreshDatabase;

    private function operator(): User
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

        return User::factory()->create([
            'role_id' => $role->id,
            'organization_id' => $this->createOrganization()->id,
            'is_platform_admin' => true,
            'email' => 'operateur@example.com',
        ]);
    }

    /** @return array{0: Organization, 1: string} the organization and the owner's token */
    private function signup(string $plan = 'pro'): array
    {
        $response = $this->postJson('/api/register', [
            'organization_name' => 'Dakar Mode', 'name' => 'Mamadou Fall', 'email' => 'mamadou@example.com',
            'password' => 'secret123', 'phone' => '771112233', 'address' => 'Médina',
            'shop_name' => 'Dakar Mode', 'shop_code' => 'DKMODE', 'plan_code' => $plan,
        ])->assertCreated();

        return [Organization::where('name', 'Dakar Mode')->firstOrFail(), $response->json('token')];
    }

    public function test_the_operator_is_told_and_sees_the_request(): void
    {
        $operator = $this->operator();
        [$organization] = $this->signup();

        $rows = $this->actingAs($operator, 'sanctum')->getJson('/api/platform/registrations')->assertOk()->json();
        $this->assertSame([$organization->id], array_column($rows, 'id'));
        $this->assertSame('pending', $rows[0]['registration_status']);
        $this->assertSame('pro', $rows[0]['subscription']['plan']['code']);

        $this->actingAs($operator, 'sanctum')->getJson('/api/platform/dashboard')->assertJsonPath('registrations.pending', 1);
        $this->assertTrue(PlatformAuditLog::where('organization_id', $organization->id)->where('action', 'registration_submitted')->exists());
    }

    public function test_the_operator_receives_an_email(): void
    {
        config(['mail.default' => 'array']);
        $this->operator();
        $this->signup();

        $sent = app('mailer')->getSymfonyTransport()->messages();
        $this->assertCount(1, $sent);
        $this->assertSame('Nouvelle inscription : Dakar Mode', $sent[0]->getOriginalMessage()->getSubject());
        $this->assertSame('operateur@example.com', $sent[0]->getOriginalMessage()->getTo()[0]->getAddress());
    }

    public function test_accepting_with_a_trial_opens_the_shop(): void
    {
        $operator = $this->operator();
        [$organization, $token] = $this->signup();

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/approve", [
            'activation' => 'trial', 'trial_days' => 30,
        ])->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('registration_status', 'approved')
            ->assertJsonPath('subscription.status', 'trial')
            ->assertJsonPath('subscription.trial_ends_at', now()->addDays(30)->toDateString());

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/products')->assertOk();
    }

    public function test_accepting_without_payment_keeps_the_shop_closed_until_it_pays(): void
    {
        $operator = $this->operator();
        [$organization, $token] = $this->signup();

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/approve", [
            'activation' => 'pending_payment',
        ])->assertOk()
            ->assertJsonPath('status', 'inactive')
            ->assertJsonPath('registration_status', 'approved')
            ->assertJsonPath('subscription.status', 'pending_payment');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/products')
            ->assertStatus(402)->assertJsonPath('code', 'organization_pending_payment');

        $this->actingAs($operator, 'sanctum')->getJson('/api/platform/registrations?status=awaiting_activation')
            ->assertJsonCount(1);

        // Reactivate is for suspended shops; an inactive one is opened by a payment.
        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/reactivate")
            ->assertStatus(422);

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/payments", [
            'amount' => 15000, 'method' => 'wave', 'months' => 1,
        ])->assertCreated()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('subscription.status', 'active');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/products')->assertOk();
    }

    public function test_accepting_with_a_payment_opens_the_shop_at_once(): void
    {
        $operator = $this->operator();
        [$organization] = $this->signup();

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/approve", [
            'activation' => 'paid', 'plan_code' => 'simple', 'amount' => 5000, 'method' => 'orange_money', 'months' => 1,
        ])->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('subscription.status', 'active')
            ->assertJsonPath('subscription.plan.code', 'simple');

        $this->assertSame(1, $organization->payments()->count());
    }

    public function test_a_rejected_request_keeps_its_data_and_tells_the_client(): void
    {
        $operator = $this->operator();
        [$organization, $token] = $this->signup();

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/reject", [
            'reason' => 'Informations incomplètes.',
        ])->assertOk()->assertJsonPath('registration_status', 'rejected')->assertJsonPath('status', 'inactive');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/subscription')
            ->assertJsonPath('access.code', 'registration_rejected')
            ->assertJsonPath('access.message', "Votre demande d'inscription n'a pas été acceptée. Informations incomplètes.");

        $this->assertNotNull(Organization::find($organization->id));
        $this->assertTrue(User::where('email', 'mamadou@example.com')->exists());
    }

    public function test_the_operator_can_ask_for_more_information(): void
    {
        $operator = $this->operator();
        [$organization, $token] = $this->signup();

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/request-info", [
            'message' => 'Envoyez-nous votre NINEA.',
        ])->assertOk()->assertJsonPath('registration_status', 'info_requested');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/products')
            ->assertStatus(402)->assertJsonPath('code', 'registration_info_requested');

        $this->actingAs($operator, 'sanctum')->getJson('/api/platform/registrations')->assertJsonCount(1);
    }

    public function test_only_the_operator_can_decide(): void
    {
        [$organization, $token] = $this->signup();

        $this->withToken($token)->postJson("/api/platform/organizations/{$organization->id}/approve", [
            'activation' => 'trial', 'trial_days' => 365,
        ])->assertForbidden();

        $this->assertSame(Organization::STATUS_INACTIVE, $organization->fresh()->status);
    }

    public function test_a_client_created_by_the_operator_is_approved_at_once(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator, 'sanctum')->postJson('/api/platform/organizations', [
            'organization_name' => 'Tech Plus', 'name' => 'Fatou', 'email' => 'fatou@example.com',
            'password' => 'secret123', 'shop_name' => 'Tech Plus', 'shop_code' => 'TECH', 'plan_code' => 'simple',
        ])->assertCreated()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('registration_status', 'approved')
            ->assertJsonPath('subscription.status', Subscription::STATUS_TRIAL);
    }
}
