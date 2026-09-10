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

class SaleMinimumPriceTest extends TestCase
{
    use RefreshDatabase;

    private function makeCashierWithOpenSession(): array
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
            'additional_costs' => 2000,
            'cost_price' => 52000,
            'min_profit_amount' => 8000,
            'min_price' => 60000,
            'quantity_received' => 10,
            'quantity_available' => 10,
            'received_at' => now(),
        ]);

        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $cashier->id,
            'opening_amount' => 50000,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        return compact('shop', 'cashier', 'batch', 'session');
    }

    public function test_a_sale_below_the_minimum_price_is_rejected_by_the_server(): void
    {
        ['shop' => $shop, 'cashier' => $cashier, 'batch' => $batch, 'session' => $session] = $this->makeCashierWithOpenSession();

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'items' => [
                ['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 59000],
            ],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('sales', 0);
        $this->assertSame(10, $batch->fresh()->quantity_available);
    }

    public function test_a_sale_at_or_above_the_minimum_price_is_accepted(): void
    {
        ['shop' => $shop, 'cashier' => $cashier, 'batch' => $batch, 'session' => $session] = $this->makeCashierWithOpenSession();

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'items' => [
                ['product_batch_id' => $batch->id, 'quantity' => 2, 'unit_price' => 70000],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseCount('sales', 1);
        $this->assertDatabaseCount('invoices', 1);
        $this->assertSame(8, $batch->fresh()->quantity_available);
    }

    public function test_a_cashier_cannot_cancel_a_validated_sale(): void
    {
        ['shop' => $shop, 'cashier' => $cashier, 'batch' => $batch, 'session' => $session] = $this->makeCashierWithOpenSession();

        $sale = app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $cashier,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 70000]],
            paymentMethod: 'cash',
        );

        $response = $this->actingAs($cashier, 'sanctum')->postJson("/api/sales/{$sale->id}/cancel");

        $response->assertStatus(403);
    }
}
