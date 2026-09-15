<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileSelfUpdateTest extends TestCase
{
    use RefreshDatabase;

    private function makeCashier(): User
    {
        $role = Role::firstOrCreate(['slug' => Role::CAISSIER], ['name' => 'Caissier']);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);

        return User::factory()->create([
            'role_id' => $role->id,
            'shop_id' => $shop->id,
            'password' => 'old-password',
        ]);
    }

    public function test_any_role_can_rename_themselves(): void
    {
        $cashier = $this->makeCashier();

        $response = $this->actingAs($cashier, 'sanctum')->putJson('/api/me', [
            'name' => 'Nouveau nom',
        ]);

        $response->assertOk();
        $this->assertSame('Nouveau nom', $cashier->fresh()->name);
    }

    public function test_changing_password_requires_the_correct_current_password(): void
    {
        $cashier = $this->makeCashier();

        $this->actingAs($cashier, 'sanctum')->putJson('/api/me', [
            'current_password' => 'wrong-password',
            'password' => 'new-password-123',
        ])->assertStatus(422);

        $response = $this->actingAs($cashier, 'sanctum')->putJson('/api/me', [
            'current_password' => 'old-password',
            'password' => 'new-password-123',
        ]);

        $response->assertOk();
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('new-password-123', $cashier->fresh()->password));
    }

    public function test_a_self_update_cannot_change_role_or_shop(): void
    {
        $cashier = $this->makeCashier();
        $superAdminRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => 'Administrateur général']);
        $originalRoleId = $cashier->role_id;

        $this->actingAs($cashier, 'sanctum')->putJson('/api/me', [
            'name' => 'Toujours caissier',
            'role_id' => $superAdminRole->id,
            'shop_id' => null,
            'is_active' => false,
        ])->assertOk();

        $fresh = $cashier->fresh();
        $this->assertSame($originalRoleId, $fresh->role_id);
        $this->assertNotNull($fresh->shop_id);
        $this->assertTrue($fresh->is_active);
    }
}
