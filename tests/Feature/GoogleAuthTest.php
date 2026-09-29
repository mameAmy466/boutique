<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\User;
use App\Services\GoogleTokenVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use UnexpectedValueException;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function fakeGoogleToken(array $payload): void
    {
        $this->mock(GoogleTokenVerifier::class, function ($mock) use ($payload) {
            $mock->shouldReceive('verify')->once()->andReturn(array_merge([
                'sub' => 'google-sub-123',
                'email' => 'awa@example.com',
                'email_verified' => true,
                'name' => 'Awa Diop',
            ], $payload));
        });
    }

    public function test_google_login_reports_needs_registration_for_an_unknown_email(): void
    {
        $this->fakeGoogleToken([]);

        $response = $this->postJson('/api/auth/google', ['id_token' => 'fake']);

        $response->assertOk();
        $this->assertTrue($response->json('needs_registration'));
        $this->assertSame('awa@example.com', $response->json('email'));
    }

    public function test_google_login_logs_in_an_existing_user_and_links_the_google_id(): void
    {
        $organization = $this->createOrganization();
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $user = User::factory()->create([
            'email' => 'awa@example.com',
            'role_id' => $role->id,
            'organization_id' => $organization->id,
            'google_id' => null,
        ]);

        $this->fakeGoogleToken([]);

        $response = $this->postJson('/api/auth/google', ['id_token' => 'fake']);

        $response->assertOk();
        $this->assertNotEmpty($response->json('token'));
        $this->assertSame($user->id, $response->json('user.id'));
        $this->assertSame('google-sub-123', $user->fresh()->google_id);
    }

    public function test_google_login_rejects_an_unverified_email(): void
    {
        $this->fakeGoogleToken(['email_verified' => false]);

        $this->postJson('/api/auth/google', ['id_token' => 'fake'])->assertStatus(422);
    }

    public function test_google_login_rejects_a_disabled_account(): void
    {
        $organization = $this->createOrganization();
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        User::factory()->create([
            'email' => 'awa@example.com',
            'role_id' => $role->id,
            'organization_id' => $organization->id,
            'is_active' => false,
        ]);

        $this->fakeGoogleToken([]);

        $this->postJson('/api/auth/google', ['id_token' => 'fake'])->assertStatus(422);
    }

    public function test_registering_with_google_creates_the_organization_and_logs_in(): void
    {
        $this->fakeGoogleToken([]);

        $response = $this->postJson('/api/register', [
            'id_token' => 'fake',
            'organization_name' => 'Ma Boutique Sarl',
            'name' => 'Awa Diop',
            'shop_name' => 'Boutique Plateau',
            'shop_code' => 'BPL',
            'plan_code' => Plan::CODE_PRO,
        ]);

        $response->assertCreated();
        $this->assertNotEmpty($response->json('token'));

        $user = User::where('email', 'awa@example.com')->firstOrFail();
        $this->assertSame('google-sub-123', $user->google_id);
        $this->assertNotNull($user->password);
    }

    public function test_registering_with_google_ignores_a_client_supplied_email(): void
    {
        $this->fakeGoogleToken(['email' => 'verified@example.com']);

        $response = $this->postJson('/api/register', [
            'id_token' => 'fake',
            'email' => 'spoofed@example.com',
            'organization_name' => 'Ma Boutique Sarl',
            'name' => 'Awa Diop',
            'shop_name' => 'Boutique Plateau',
            'shop_code' => 'BPL',
            'plan_code' => Plan::CODE_PRO,
        ]);

        $response->assertCreated();
        $this->assertSame('verified@example.com', $response->json('user.email'));
        $this->assertDatabaseMissing('users', ['email' => 'spoofed@example.com']);
    }

    public function test_registering_with_google_for_an_email_that_already_has_an_account_is_rejected(): void
    {
        $organization = $this->createOrganization();
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        User::factory()->create(['email' => 'awa@example.com', 'role_id' => $role->id, 'organization_id' => $organization->id]);

        $this->fakeGoogleToken([]);

        $this->postJson('/api/register', [
            'id_token' => 'fake',
            'organization_name' => 'Ma Boutique Sarl',
            'name' => 'Awa Diop',
            'shop_name' => 'Boutique Plateau',
            'shop_code' => 'BPL',
            'plan_code' => Plan::CODE_PRO,
        ])->assertStatus(422);
    }

    public function test_an_invalid_google_token_is_rejected(): void
    {
        $this->mock(GoogleTokenVerifier::class, function ($mock) {
            $mock->shouldReceive('verify')->once()->andThrow(new UnexpectedValueException("Ce jeton n'a pas été émis pour cette application."));
        });

        $this->postJson('/api/auth/google', ['id_token' => 'bad'])->assertStatus(422);
    }
}
