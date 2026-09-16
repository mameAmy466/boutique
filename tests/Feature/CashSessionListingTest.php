<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashSessionListingTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_cashier_sees_their_sales_count_and_total_on_the_session(): void
    {
        $role = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $product = Product::create(['name' => 'Téléphone', 'reference' => 'REF-100']);
        $batch = ProductBatch::create([
            'batch_code' => 'BT01-2026-000001',
            'product_id' => $product->id,
            'shop_id' => $shop->id,
            'purchase_cost' => 50000,
            'additional_costs' => 0,
            'cost_price' => 50000,
            'min_profit_amount' => 10000,
            'min_price' => 60000,
            'quantity_received' => 10,
            'quantity_available' => 10,
            'received_at' => now(),
        ]);

        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $cashier->id,
            'opening_amount' => 10000,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $cashier,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 2, 'unit_price' => 65000]],
            paymentMethod: 'cash',
        );

        $response = $this->actingAs($cashier, 'sanctum')->getJson('/api/cash-sessions');

        $response->assertOk();
        $entry = collect($response->json())->firstWhere('id', $session->id);
        $this->assertSame(1, $entry['sales_count']);
        $this->assertEquals(130000, (float) $entry['sales_sum_total']);
    }

    public function test_closing_a_session_computes_the_expected_amount_from_cash_sales(): void
    {
        $role = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $product = Product::create(['name' => 'Téléphone', 'reference' => 'REF-100']);
        $batch = ProductBatch::create([
            'batch_code' => 'BT01-2026-000001',
            'product_id' => $product->id,
            'shop_id' => $shop->id,
            'purchase_cost' => 50000,
            'additional_costs' => 0,
            'cost_price' => 50000,
            'min_profit_amount' => 10000,
            'min_price' => 60000,
            'quantity_received' => 10,
            'quantity_available' => 10,
            'received_at' => now(),
        ]);

        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $cashier->id,
            'opening_amount' => 10000,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $cashier,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 60000]],
            paymentMethod: 'cash',
        );

        $response = $this->actingAs($cashier, 'sanctum')->postJson("/api/cash-sessions/{$session->id}/close", [
            'declared_amount' => 69000,
        ]);

        $response->assertOk();
        $this->assertEquals(70000, (float) $response->json('expected_amount'));
        $this->assertEquals(-1000, (float) $response->json('difference'));
        $this->assertSame('closed', $response->json('status'));
    }

    public function test_a_cashier_cannot_close_another_cashiers_session(): void
    {
        $role = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);
        $otherCashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $otherCashier->id,
            'opening_amount' => 10000,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        $response = $this->actingAs($cashier, 'sanctum')->postJson("/api/cash-sessions/{$session->id}/close", [
            'declared_amount' => 10000,
        ]);

        $response->assertStatus(403);
    }
}
