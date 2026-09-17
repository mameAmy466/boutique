<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserActivityTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_shop_admin_can_see_a_cashier_activity(): void
    {
        $adminRole = Role::create(['name' => 'Administrateur de boutique', 'slug' => Role::ADMIN_BOUTIQUE]);
        $cashierRole = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'shop_id' => $shop->id]);
        $cashier = User::factory()->create(['role_id' => $cashierRole->id, 'shop_id' => $shop->id]);

        $product = Product::create(['name' => 'Téléphone', 'reference' => 'REF-100']);
        $batch = app(StockService::class)->receiveBatch(
            product: $product,
            shop: $shop,
            purchaseCost: 50000,
            additionalCosts: 2000,
            minProfitAmount: 8000,
            quantity: 10,
            receivedBy: $cashier,
        );

        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $cashier->id,
            'opening_amount' => 50000,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $cashier,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 70000]],
            paymentMethod: 'cash',
        );

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/users/{$cashier->id}/activity");

        $response->assertOk();
        $this->assertSame(1, $response->json('sales.count'));
        $this->assertEquals(70000, $response->json('sales.amount'));
        $this->assertSame(1, $response->json('stocks.count'));
        $this->assertEquals(520000, $response->json('stocks.amount'));
        $this->assertTrue($response->json('cash.open'));
        $this->assertSame('Caisse 1', $response->json('cash.register_name'));
        $this->assertEquals(120000, $response->json('cash.amount'));
        $this->assertGreaterThan(0, $response->json('movements.count'));
        $this->assertGreaterThan(0, $response->json('movements.amount'));
        $this->assertNotEmpty($response->json('recent_movements'));
        $this->assertCount(1, $response->json('sales.rows'));
        $this->assertSame(10, $response->json('stocks.rows.0.quantity'));
        $this->assertSame('Téléphone', $response->json('stocks.rows.0.product_name'));
    }

    public function test_a_shop_admin_cannot_see_activity_from_another_shop(): void
    {
        $adminRole = Role::create(['name' => 'Administrateur de boutique', 'slug' => Role::ADMIN_BOUTIQUE]);
        $cashierRole = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $shopA = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BT02']);
        $admin = User::factory()->create(['role_id' => $adminRole->id, 'shop_id' => $shopA->id]);
        $other = User::factory()->create(['role_id' => $cashierRole->id, 'shop_id' => $shopB->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/users/{$other->id}/activity")
            ->assertStatus(403);
    }
}
