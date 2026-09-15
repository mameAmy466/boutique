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

class SaleListingFiltersTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopWithOpenSession(): array
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

    public function test_sales_can_be_searched_by_customer_name_and_filtered_by_payment_method(): void
    {
        ['shop' => $shop, 'cashier' => $cashier, 'batch' => $batch, 'session' => $session] = $this->makeShopWithOpenSession();
        $sales = app(SaleService::class);

        $sales->createSale(
            shop: $shop,
            cashier: $cashier,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 70000]],
            paymentMethod: 'cash',
            customerName: 'Awa Diop',
        );
        $sales->createSale(
            shop: $shop,
            cashier: $cashier,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 70000]],
            paymentMethod: 'card',
            customerName: 'Moussa Fall',
        );

        $bySearch = $this->actingAs($cashier, 'sanctum')->getJson('/api/sales?search=Awa');
        $bySearch->assertOk();
        $this->assertCount(1, $bySearch->json('data'));
        $this->assertSame('Awa Diop', $bySearch->json('data.0.customer_name'));

        $byPayment = $this->actingAs($cashier, 'sanctum')->getJson('/api/sales?payment_method=card');
        $byPayment->assertOk();
        $this->assertCount(1, $byPayment->json('data'));
        $this->assertSame('card', $byPayment->json('data.0.payment_method'));
    }
}
