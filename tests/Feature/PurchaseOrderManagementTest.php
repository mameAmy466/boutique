<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\PurchaseOrder;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderManagementTest extends TestCase
{
    use RefreshDatabase;

    private function shopAdmin(): array
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);
        $supplier = Supplier::create(['name' => 'Grossiste Dakar']);
        $product = Product::create(['name' => 'Sac de riz 25kg', 'reference' => 'RIZ-25', 'unit' => 'sac', 'min_stock' => 5]);

        return compact('shop', 'admin', 'supplier', 'product');
    }

    public function test_a_shop_admin_can_create_a_purchase_order(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'supplier' => $supplier, 'product' => $product] = $this->shopAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/purchase-orders', [
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'items' => [
                ['product_id' => $product->id, 'quantity' => 50, 'unit_cost' => 10000],
            ],
        ]);

        $response->assertCreated();
        $response->assertJsonPath('status', PurchaseOrder::STATUS_ORDERED);
        $this->assertMatchesRegularExpression('/^BC-\d{4}-\d{6}$/', $response->json('reference'));
        $this->assertCount(1, $response->json('items'));
    }

    public function test_receiving_a_purchase_order_creates_a_stock_batch_and_tracks_the_quantity(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'supplier' => $supplier, 'product' => $product] = $this->shopAdmin();

        $order = $this->actingAs($admin, 'sanctum')->postJson('/api/purchase-orders', [
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'items' => [['product_id' => $product->id, 'quantity' => 50, 'unit_cost' => 10000]],
        ])->json();

        $itemId = $order['items'][0]['id'];

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/purchase-orders/{$order['id']}/receive", [
            'items' => [
                ['purchase_order_item_id' => $itemId, 'quantity' => 30, 'min_profit_amount' => 2000],
            ],
        ]);
        $response->assertOk();
        $response->assertJsonPath('status', PurchaseOrder::STATUS_PARTIALLY_RECEIVED);
        $response->assertJsonPath('items.0.quantity_received', 30);

        $this->assertSame(1, ProductBatch::query()->where('product_id', $product->id)->count());
        $batch = ProductBatch::query()->where('product_id', $product->id)->first();
        $this->assertSame(30, $batch->quantity_available);
        $this->assertEquals(10000.0, (float) $batch->purchase_cost);
        $this->assertSame($itemId, $batch->purchase_order_item_id);

        // Receive the rest — the order becomes fully received.
        $second = $this->actingAs($admin, 'sanctum')->postJson("/api/purchase-orders/{$order['id']}/receive", [
            'items' => [['purchase_order_item_id' => $itemId, 'quantity' => 20]],
        ]);
        $second->assertOk();
        $second->assertJsonPath('status', PurchaseOrder::STATUS_RECEIVED);
    }

    public function test_receiving_more_than_ordered_is_rejected(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'supplier' => $supplier, 'product' => $product] = $this->shopAdmin();

        $order = $this->actingAs($admin, 'sanctum')->postJson('/api/purchase-orders', [
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'items' => [['product_id' => $product->id, 'quantity' => 10, 'unit_cost' => 10000]],
        ])->json();

        $this->actingAs($admin, 'sanctum')->postJson("/api/purchase-orders/{$order['id']}/receive", [
            'items' => [['purchase_order_item_id' => $order['items'][0]['id'], 'quantity' => 999]],
        ])->assertStatus(422);
    }

    public function test_a_purchase_order_already_partially_received_cannot_be_cancelled(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'supplier' => $supplier, 'product' => $product] = $this->shopAdmin();

        $order = $this->actingAs($admin, 'sanctum')->postJson('/api/purchase-orders', [
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'items' => [['product_id' => $product->id, 'quantity' => 10, 'unit_cost' => 10000]],
        ])->json();

        $this->actingAs($admin, 'sanctum')->postJson("/api/purchase-orders/{$order['id']}/receive", [
            'items' => [['purchase_order_item_id' => $order['items'][0]['id'], 'quantity' => 5]],
        ])->assertOk();

        $this->actingAs($admin, 'sanctum')->postJson("/api/purchase-orders/{$order['id']}/cancel")
            ->assertStatus(422);
    }

    public function test_a_cashier_cannot_create_a_purchase_order(): void
    {
        ['shop' => $shop, 'supplier' => $supplier, 'product' => $product] = $this->shopAdmin();
        $role = Role::firstOrCreate(['slug' => Role::CAISSIER], ['name' => Role::CAISSIER]);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $this->actingAs($cashier, 'sanctum')->postJson('/api/purchase-orders', [
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'items' => [['product_id' => $product->id, 'quantity' => 10, 'unit_cost' => 10000]],
        ])->assertForbidden();
    }

    public function test_a_shop_admin_only_sees_their_own_shops_purchase_orders(): void
    {
        ['shop' => $shopA, 'admin' => $adminA, 'supplier' => $supplier, 'product' => $product] = $this->shopAdmin();
        $shopB = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $roleB = Role::where('slug', Role::ADMIN_BOUTIQUE)->first();
        $adminB = User::factory()->create(['role_id' => $roleB->id, 'shop_id' => $shopB->id]);

        $this->actingAs($adminA, 'sanctum')->postJson('/api/purchase-orders', [
            'shop_id' => $shopA->id,
            'supplier_id' => $supplier->id,
            'items' => [['product_id' => $product->id, 'quantity' => 10, 'unit_cost' => 10000]],
        ])->assertCreated();

        $response = $this->actingAs($adminB, 'sanctum')->getJson('/api/purchase-orders');
        $this->assertCount(0, $response->json());
    }
}
