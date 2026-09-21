<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpenseManagementTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $roleSlug, ?Shop $shop = null): User
    {
        $role = Role::firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);

        return User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop?->id]);
    }

    public function test_a_shop_admin_can_create_and_list_expenses_for_their_own_shop(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'loyer',
            'amount' => 150000,
            'expense_date' => '2026-09-01',
        ]);

        $create->assertCreated();
        $this->assertSame($admin->id, $create->json('created_by'));

        $index = $this->actingAs($admin, 'sanctum')->getJson('/api/expenses');
        $index->assertOk();
        $this->assertCount(1, $index->json());
    }

    public function test_a_shop_admin_cannot_create_an_expense_for_another_shop(): void
    {
        $shopA = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopA);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shopB->id,
            'category' => 'electricite',
            'amount' => 20000,
            'expense_date' => '2026-09-01',
        ]);

        $response->assertForbidden();
    }

    public function test_a_cashier_cannot_view_or_create_expenses(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $cashier = $this->makeUser(Role::CAISSIER, $shop);

        $this->actingAs($cashier, 'sanctum')->getJson('/api/expenses')->assertForbidden();

        $this->actingAs($cashier, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'eau',
            'amount' => 5000,
            'expense_date' => '2026-09-01',
        ])->assertForbidden();
    }

    public function test_an_invalid_category_is_rejected(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'bonbons',
            'amount' => 5000,
            'expense_date' => '2026-09-01',
        ]);

        $response->assertStatus(422);
    }

    public function test_a_super_admin_sees_expenses_across_shops_and_can_filter_by_shop(): void
    {
        $shopA = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $superAdmin = $this->makeUser(Role::SUPER_ADMIN);
        $adminA = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopA);
        $adminB = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopB);

        $this->actingAs($adminA, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shopA->id, 'category' => 'loyer', 'amount' => 100000, 'expense_date' => '2026-09-01',
        ])->assertCreated();
        $this->actingAs($adminB, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shopB->id, 'category' => 'eau', 'amount' => 8000, 'expense_date' => '2026-09-01',
        ])->assertCreated();

        $all = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/expenses');
        $this->assertCount(2, $all->json());

        $onlyA = $this->actingAs($superAdmin, 'sanctum')->getJson("/api/expenses?shop_id={$shopA->id}");
        $this->assertCount(1, $onlyA->json());
    }

    public function test_a_shop_admin_can_update_and_delete_their_own_shops_expense_but_not_another_shops(): void
    {
        $shopA = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $adminA = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopA);
        $adminB = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopB);

        $expense = $this->actingAs($adminA, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shopA->id, 'category' => 'transport', 'amount' => 10000, 'expense_date' => '2026-09-01',
        ])->json();

        $this->actingAs($adminB, 'sanctum')->putJson("/api/expenses/{$expense['id']}", ['amount' => 1])->assertForbidden();
        $this->actingAs($adminB, 'sanctum')->deleteJson("/api/expenses/{$expense['id']}")->assertForbidden();

        $update = $this->actingAs($adminA, 'sanctum')->putJson("/api/expenses/{$expense['id']}", ['amount' => 12000]);
        $update->assertOk();
        $this->assertSame('12000.00', $update->json('amount'));

        $this->actingAs($adminA, 'sanctum')->deleteJson("/api/expenses/{$expense['id']}")->assertOk();
        $this->assertDatabaseCount('expenses', 0);
    }
}
