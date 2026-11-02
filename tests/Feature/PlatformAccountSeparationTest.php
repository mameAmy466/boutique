<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\PlatformAuditLog;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The platform admin runs the SaaS: no organization, no shop, no business data. */
class PlatformAccountSeparationTest extends TestCase
{
    use RefreshDatabase;

    private function operator(string $email = 'admin@example.com'): User
    {
        return User::factory()->create(['email' => $email, 'organization_id' => null, 'role_id' => null, 'is_platform_admin' => true]);
    }

    public function test_a_fresh_install_has_a_platform_admin_and_no_organization(): void
    {
        $this->seed(DatabaseSeeder::class);

        $admin = User::where('email', 'admin@boutique.test')->firstOrFail();
        $this->assertTrue($admin->isPlatformAdmin());
        $this->assertNull($admin->organization_id);
        $this->assertNull($admin->role_id);
        $this->assertSame(0, Organization::count());
    }

    public function test_the_platform_admin_sees_no_client_data_through_the_tenant_scopes(): void
    {
        $organization = $this->createOrganization();
        Product::create(['organization_id' => $organization->id, 'name' => 'Sac', 'reference' => 'R1', 'unit' => 'pcs', 'min_stock' => 1]);

        $this->actingAs($this->operator());

        // Even outside the API guards, the scopes give it nothing.
        $this->assertSame(0, Product::count());
        $this->assertSame(1, Product::withoutGlobalScopes()->count());
    }

    public function test_platform_admins_are_managed_from_the_super_admin(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator, 'sanctum')->postJson('/api/platform/admins', [
            'name' => 'Awa Gueye', 'email' => 'awa@myboutiqu.com', 'password' => 'secret123',
        ])->assertCreated();

        $awa = User::where('email', 'awa@myboutiqu.com')->firstOrFail();
        $this->assertTrue($awa->isPlatformAdmin());
        $this->assertNull($awa->organization_id);

        $this->actingAs($operator, 'sanctum')->getJson('/api/platform/admins')->assertOk()->assertJsonCount(2);

        $this->actingAs($operator, 'sanctum')->putJson("/api/platform/admins/{$awa->id}", ['is_active' => false])
            ->assertOk()->assertJsonPath('is_active', false);
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => 'awa@myboutiqu.com', 'password' => 'secret123'])->assertStatus(422);

        $this->assertTrue(PlatformAuditLog::where('action', 'platform_admin_created')->exists());
    }

    public function test_the_last_active_admin_cannot_be_disabled(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator, 'sanctum')->putJson("/api/platform/admins/{$operator->id}", ['is_active' => false])
            ->assertStatus(422);
        $this->assertTrue($operator->fresh()->is_active);
    }

    public function test_a_client_user_cannot_be_turned_into_a_platform_admin(): void
    {
        $operator = $this->operator();
        $organization = $this->createOrganization();
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $client = User::factory()->create(['organization_id' => $organization->id, 'role_id' => $role->id]);

        // The admins endpoints only touch platform accounts…
        $this->actingAs($operator, 'sanctum')->putJson("/api/platform/admins/{$client->id}", ['name' => 'X'])->assertNotFound();

        // …and a client owner cannot grant the flag through the users screen.
        $this->actingAs($client, 'sanctum')->putJson("/api/users/{$client->id}", ['is_platform_admin' => true]);
        $this->assertFalse($client->fresh()->isPlatformAdmin());
    }
}
