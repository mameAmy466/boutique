<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientDebtItemsTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopWithBatch(): array
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Restaurant Le Baobab']);

        $product = Product::create(['name' => 'Sac de riz 25kg', 'reference' => 'RIZ-25', 'unit' => 'sac', 'min_stock' => 5]);
        $batch = ProductBatch::create([
            'batch_code' => 'BTA-2026-000001', 'product_id' => $product->id, 'shop_id' => $shop->id,
            'purchase_cost' => 10000, 'additional_costs' => 0, 'cost_price' => 10000,
            'min_profit_amount' => 2000, 'min_price' => 12000,
            'quantity_received' => 50, 'quantity_available' => 50, 'received_at' => now(),
        ]);

        return compact('shop', 'admin', 'customer', 'batch');
    }

    public function test_a_client_debt_with_items_decrements_stock_and_records_line_items(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'customer' => $customer, 'batch' => $batch] = $this->makeShopWithBatch();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id,
            'customer_id' => $customer->id,
            'items' => [
                ['product_batch_id' => $batch->id, 'quantity' => 5, 'unit_price' => 12000],
            ],
        ]);

        $response->assertCreated();
        $this->assertEquals(60000.0, (float) $response->json('amount'));
        $this->assertCount(1, $response->json('items'));
        $this->assertSame('Sac de riz 25kg', $response->json('items.0.product_batch.product.name'));

        $this->assertSame(45, $batch->fresh()->quantity_available);
        $this->assertDatabaseHas('stock_movements', [
            'product_batch_id' => $batch->id,
            'type' => StockMovement::TYPE_CREDIT_SALE,
            'quantity' => -5,
            'reference_type' => \App\Models\ClientDebt::class,
        ]);
    }

    public function test_a_client_debt_item_below_minimum_price_is_rejected(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'customer' => $customer, 'batch' => $batch] = $this->makeShopWithBatch();

        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id,
            'customer_id' => $customer->id,
            'items' => [
                ['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 5000],
            ],
        ])->assertStatus(422);

        $this->assertSame(50, $batch->fresh()->quantity_available);
    }

    public function test_a_client_debt_item_exceeding_available_stock_is_rejected(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'customer' => $customer, 'batch' => $batch] = $this->makeShopWithBatch();

        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id,
            'customer_id' => $customer->id,
            'items' => [
                ['product_batch_id' => $batch->id, 'quantity' => 999, 'unit_price' => 12000],
            ],
        ])->assertStatus(422);
    }

    public function test_deleting_a_client_debt_with_items_restores_stock(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'customer' => $customer, 'batch' => $batch] = $this->makeShopWithBatch();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id,
            'customer_id' => $customer->id,
            'items' => [['product_batch_id' => $batch->id, 'quantity' => 10, 'unit_price' => 12000]],
        ]);
        $this->assertSame(40, $batch->fresh()->quantity_available);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/client-debts/{$response->json('id')}")->assertOk();
        $this->assertSame(50, $batch->fresh()->quantity_available);
    }

    public function test_a_client_debt_without_items_still_accepts_a_manual_amount(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'customer' => $customer] = $this->makeShopWithBatch();

        $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id,
            'customer_id' => $customer->id,
            'amount' => 25000,
        ])->assertCreated();
    }
}
