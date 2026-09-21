<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientDebtManagementTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $roleSlug, ?Shop $shop = null): User
    {
        $role = Role::firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);

        return User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop?->id]);
    }

    public function test_a_shop_admin_can_create_a_customer_and_a_debt_for_them(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $customer = $this->actingAs($admin, 'sanctum')->postJson('/api/customers', [
            'shop_id' => $shop->id,
            'name' => 'Client Grossiste Fatou',
            'phone' => '+221771112233',
        ]);
        $customer->assertCreated();

        $debt = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id,
            'customer_id' => $customer->json('id'),
            'amount' => 75000,
            'due_date' => '2026-10-05',
        ]);

        $debt->assertCreated();
        $this->assertSame('pending', $debt->json('status'));
        $this->assertEquals(75000.0, $debt->json('remaining'));
    }

    public function test_partial_payment_then_overpayment_is_rejected(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Client Grossiste']);

        $debt = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 30000,
        ])->json();

        $partial = $this->actingAs($admin, 'sanctum')->postJson("/api/client-debts/{$debt['id']}/payments", [
            'amount' => 10000, 'paid_at' => '2026-09-15',
        ]);
        $partial->assertOk();
        $this->assertSame('partial', $partial->json('status'));

        $overpay = $this->actingAs($admin, 'sanctum')->postJson("/api/client-debts/{$debt['id']}/payments", [
            'amount' => 20001, 'paid_at' => '2026-09-16',
        ]);
        $overpay->assertStatus(422);
    }

    public function test_a_debt_with_payments_cannot_be_deleted(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Client Grossiste']);

        $debt = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 30000,
        ])->json();

        $this->actingAs($admin, 'sanctum')->postJson("/api/client-debts/{$debt['id']}/payments", [
            'amount' => 5000, 'paid_at' => '2026-09-15',
        ])->assertOk();

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/client-debts/{$debt['id']}")->assertStatus(422);
    }

    public function test_a_shop_admin_cannot_see_another_shops_customers_or_debts(): void
    {
        $shopA = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $adminA = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopA);
        $adminB = $this->makeUser(Role::ADMIN_BOUTIQUE, $shopB);

        $customerB = Customer::create(['shop_id' => $shopB->id, 'name' => 'Client B']);

        $this->actingAs($adminA, 'sanctum')->getJson('/api/customers')->assertJsonCount(0);

        $this->actingAs($adminA, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shopB->id, 'customer_id' => $customerB->id, 'amount' => 1000,
        ])->assertForbidden();
    }

    public function test_a_cashier_cannot_create_a_customer_or_a_client_debt(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $cashier = $this->makeUser(Role::CAISSIER, $shop);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Client Grossiste']);

        $this->actingAs($cashier, 'sanctum')->postJson('/api/customers', [
            'shop_id' => $shop->id, 'name' => 'Nouveau client',
        ])->assertForbidden();

        $this->actingAs($cashier, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 1000,
        ])->assertForbidden();
    }
}
