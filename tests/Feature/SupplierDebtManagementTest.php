<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupplierDebtManagementTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $roleSlug, ?Shop $shop = null): User
    {
        $role = Role::firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);

        return User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop?->id]);
    }

    public function test_a_shop_admin_can_create_a_debt_and_it_starts_pending(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'amount' => 100000,
            'due_date' => '2026-10-01',
        ]);

        $response->assertCreated();
        $this->assertSame('pending', $response->json('status'));
        $this->assertEquals(100000.0, $response->json('remaining'));
        $this->assertEquals(0.0, $response->json('paid_amount'));
    }

    public function test_partial_then_full_payment_updates_status(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $debt = $this->actingAs($admin, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shop->id, 'supplier_id' => $supplier->id, 'amount' => 100000,
        ])->json();

        $partial = $this->actingAs($admin, 'sanctum')->postJson("/api/supplier-debts/{$debt['id']}/payments", [
            'amount' => 40000, 'paid_at' => '2026-09-15',
        ]);
        $partial->assertOk();
        $this->assertSame('partial', $partial->json('status'));
        $this->assertEquals(60000.0, $partial->json('remaining'));

        $full = $this->actingAs($admin, 'sanctum')->postJson("/api/supplier-debts/{$debt['id']}/payments", [
            'amount' => 60000, 'paid_at' => '2026-09-20',
        ]);
        $full->assertOk();
        $this->assertSame('paid', $full->json('status'));
        $this->assertEquals(0.0, $full->json('remaining'));
    }

    public function test_a_payment_exceeding_the_remaining_balance_is_rejected(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $debt = $this->actingAs($admin, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shop->id, 'supplier_id' => $supplier->id, 'amount' => 50000,
        ])->json();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/supplier-debts/{$debt['id']}/payments", [
            'amount' => 50001, 'paid_at' => '2026-09-15',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('supplier_debt_payments', 0);
    }

    public function test_a_debt_with_payments_cannot_be_deleted(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE, $shop);

        $debt = $this->actingAs($admin, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shop->id, 'supplier_id' => $supplier->id, 'amount' => 50000,
        ])->json();

        $this->actingAs($admin, 'sanctum')->postJson("/api/supplier-debts/{$debt['id']}/payments", [
            'amount' => 10000, 'paid_at' => '2026-09-15',
        ])->assertOk();

        $delete = $this->actingAs($admin, 'sanctum')->deleteJson("/api/supplier-debts/{$debt['id']}");
        $delete->assertStatus(422);
        $this->assertDatabaseCount('supplier_debts', 1);
    }

    public function test_a_cashier_cannot_create_a_supplier_debt(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $cashier = $this->makeUser(Role::CAISSIER, $shop);

        $this->actingAs($cashier, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shop->id, 'supplier_id' => $supplier->id, 'amount' => 50000,
        ])->assertForbidden();
    }
}
