<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerSupplierFichesTest extends TestCase
{
    use RefreshDatabase;

    private function shopAdmin(string $code = 'BTA'): array
    {
        $shop = Shop::create(['name' => "Boutique {$code}", 'code' => $code]);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        return compact('shop', 'admin');
    }

    public function test_a_customer_fiche_shows_total_debt_and_credit_available(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->shopAdmin();
        $customer = Customer::create([
            'shop_id' => $shop->id, 'name' => 'Restaurant Le Baobab',
            'tax_id' => 'SN-NINEA-12345', 'credit_limit' => 100000,
        ]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 60000,
        ])->assertCreated();

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/customers/{$customer->id}");
        $response->assertOk();
        $this->assertEquals(60000.0, $response->json('total_debt'));
        $this->assertEquals(40000.0, $response->json('credit_available'));
        $this->assertCount(1, $response->json('debts'));
    }

    public function test_a_new_debt_exceeding_the_credit_limit_is_rejected(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->shopAdmin();
        $customer = Customer::create([
            'shop_id' => $shop->id, 'name' => 'Boutique Fatim', 'credit_limit' => 50000,
        ]);

        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 40000,
        ])->assertCreated();

        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 20000,
        ])->assertStatus(422);

        // A customer with no credit_limit set is never blocked.
        $unlimited = Customer::create(['shop_id' => $shop->id, 'name' => 'Client sans plafond']);
        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $unlimited->id, 'amount' => 5000000,
        ])->assertCreated();
    }

    public function test_a_supplier_fiche_consolidates_debt_across_shops_for_a_super_admin_but_scopes_it_for_a_shop_admin(): void
    {
        ['shop' => $shopA, 'admin' => $adminA] = $this->shopAdmin('BTA');
        ['shop' => $shopB, 'admin' => $adminB] = $this->shopAdmin('BTB');
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);

        $this->actingAs($adminA, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shopA->id, 'supplier_id' => $supplier->id, 'amount' => 100000,
        ])->assertCreated();
        $this->actingAs($adminB, 'sanctum')->postJson('/api/supplier-debts', [
            'shop_id' => $shopB->id, 'supplier_id' => $supplier->id, 'amount' => 60000,
        ])->assertCreated();

        $superRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $superAdmin = User::factory()->create(['role_id' => $superRole->id]);

        $asSuper = $this->actingAs($superAdmin, 'sanctum')->getJson("/api/suppliers/{$supplier->id}");
        $asSuper->assertOk();
        $this->assertTrue($asSuper->json('consolidated'));
        $this->assertEquals(160000.0, $asSuper->json('total_debt'));
        $this->assertCount(2, $asSuper->json('debts'));

        $asShopA = $this->actingAs($adminA, 'sanctum')->getJson("/api/suppliers/{$supplier->id}");
        $asShopA->assertOk();
        $this->assertFalse($asShopA->json('consolidated'));
        $this->assertEquals(100000.0, $asShopA->json('total_debt'));
        $this->assertCount(1, $asShopA->json('debts'));
    }
}
