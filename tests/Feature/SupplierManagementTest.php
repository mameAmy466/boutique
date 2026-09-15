<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SupplierManagementTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $roleSlug): User
    {
        $role = Role::firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);

        return User::factory()->create(['role_id' => $role->id]);
    }

    public function test_a_shop_admin_can_create_and_update_a_supplier(): void
    {
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE);

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/suppliers', ['name' => 'Grossiste Dakar']);
        $create->assertCreated();
        $supplierId = $create->json('id');

        $update = $this->actingAs($admin, 'sanctum')->putJson("/api/suppliers/{$supplierId}", [
            'phone' => '+221771112233',
        ]);

        $update->assertOk();
        $this->assertSame('+221771112233', $update->json('phone'));
    }

    public function test_a_shop_admin_cannot_delete_a_supplier(): void
    {
        $admin = $this->makeUser(Role::ADMIN_BOUTIQUE);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/suppliers/{$supplier->id}");

        $response->assertStatus(403);
        $this->assertDatabaseHas('suppliers', ['id' => $supplier->id]);
    }

    public function test_a_super_admin_can_delete_a_supplier(): void
    {
        $superAdmin = $this->makeUser(Role::SUPER_ADMIN);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);

        $response = $this->actingAs($superAdmin, 'sanctum')->deleteJson("/api/suppliers/{$supplier->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('suppliers', ['id' => $supplier->id]);
    }

    public function test_a_cashier_cannot_create_or_update_a_supplier(): void
    {
        $cashier = $this->makeUser(Role::CAISSIER);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);

        $this->actingAs($cashier, 'sanctum')
            ->postJson('/api/suppliers', ['name' => 'Autre fournisseur'])
            ->assertStatus(403);

        $this->actingAs($cashier, 'sanctum')
            ->putJson("/api/suppliers/{$supplier->id}", ['name' => 'Modifié'])
            ->assertStatus(403);
    }
}
