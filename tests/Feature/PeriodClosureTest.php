<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PeriodClosureTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_super_admin_can_close_a_period(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $adminRole = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $shopAdmin = User::factory()->create(['role_id' => $adminRole->id, 'shop_id' => $shop->id]);
        $superRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $superAdmin = User::factory()->create(['role_id' => $superRole->id]);

        $this->actingAs($shopAdmin, 'sanctum')->postJson("/api/shops/{$shop->id}/close-period", [
            'closed_until' => now()->subMonth()->endOfMonth()->toDateString(),
        ])->assertForbidden();

        $this->actingAs($superAdmin, 'sanctum')->postJson("/api/shops/{$shop->id}/close-period", [
            'closed_until' => now()->subMonth()->endOfMonth()->toDateString(),
        ])->assertOk();

        $this->assertNotNull($shop->fresh()->closed_until);
    }

    public function test_a_closure_cannot_move_backward(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $superRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $superAdmin = User::factory()->create(['role_id' => $superRole->id]);

        $this->actingAs($superAdmin, 'sanctum')->postJson("/api/shops/{$shop->id}/close-period", [
            'closed_until' => now()->subMonth()->endOfMonth()->toDateString(),
        ])->assertOk();

        $this->actingAs($superAdmin, 'sanctum')->postJson("/api/shops/{$shop->id}/close-period", [
            'closed_until' => now()->subMonths(2)->endOfMonth()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_a_backdated_expense_into_a_closed_period_is_rejected(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $adminRole = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'shop_id' => $shop->id]);
        $superRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $superAdmin = User::factory()->create(['role_id' => $superRole->id]);

        $closedUntil = now()->subMonth()->endOfMonth();
        $this->actingAs($superAdmin, 'sanctum')->postJson("/api/shops/{$shop->id}/close-period", [
            'closed_until' => $closedUntil->toDateString(),
        ])->assertOk();

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'electricite', 'amount' => 5000,
            'payment_method' => 'cash', 'expense_date' => $closedUntil->toDateString(),
        ])->assertStatus(422);

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id, 'category' => 'electricite', 'amount' => 5000,
            'payment_method' => 'cash', 'expense_date' => now()->toDateString(),
        ])->assertCreated();
    }
}
