<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockBatchManagementTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopAdminWithBatch(): array
    {
        $role = Role::create(['name' => 'Administrateur de boutique', 'slug' => Role::ADMIN_BOUTIQUE]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

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

        return compact('shop', 'admin', 'product', 'batch');
    }

    public function test_a_shop_admin_can_correct_the_price_of_their_own_batch(): void
    {
        ['admin' => $admin, 'batch' => $batch] = $this->makeShopAdminWithBatch();

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/stocks/{$batch->id}", [
            'purchase_cost' => 51000,
            'additional_costs' => 1000,
            'min_profit_amount' => 9000,
        ]);

        $response->assertOk();
        $batch->refresh();
        $this->assertSame('52000.00', $batch->cost_price);
        $this->assertSame('61000.00', $batch->min_price);

        // The correction must be traceable to the account that made it.
        $movement = StockMovement::where('product_batch_id', $batch->id)
            ->where('type', StockMovement::TYPE_PRICE_CORRECTION)
            ->first();
        $this->assertNotNull($movement);
        $this->assertSame($admin->id, $movement->user_id);
        $this->assertSame(0, $movement->quantity);
    }

    public function test_a_shop_admin_cannot_edit_a_batch_from_another_shop(): void
    {
        ['admin' => $admin] = $this->makeShopAdminWithBatch();
        $otherShop = Shop::create(['name' => 'Boutique B', 'code' => 'BT02']);
        $product = Product::create(['name' => 'Casque', 'reference' => 'REF-200']);
        $otherBatch = ProductBatch::create([
            'batch_code' => 'BT02-2026-000001',
            'product_id' => $product->id,
            'shop_id' => $otherShop->id,
            'purchase_cost' => 1000,
            'additional_costs' => 0,
            'cost_price' => 1000,
            'min_profit_amount' => 200,
            'min_price' => 1200,
            'quantity_received' => 5,
            'quantity_available' => 5,
            'received_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/stocks/{$otherBatch->id}", [
            'purchase_cost' => 1,
            'additional_costs' => 0,
            'min_profit_amount' => 1,
        ]);

        $response->assertStatus(403);
    }

    public function test_an_unused_batch_can_be_deleted(): void
    {
        ['admin' => $admin, 'batch' => $batch] = $this->makeShopAdminWithBatch();

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/stocks/{$batch->id}");

        $response->assertStatus(204);

        // Soft-deleted, not erased: it disappears from the active stock
        // list but its history stays intact for the audit trail.
        $this->assertSoftDeleted('product_batches', ['id' => $batch->id]);

        $activeList = $this->actingAs($admin, 'sanctum')->getJson('/api/stocks');
        $this->assertEmpty(collect($activeList->json())->where('id', $batch->id));

        $deletion = StockMovement::where('product_batch_id', $batch->id)
            ->where('type', StockMovement::TYPE_DELETION)
            ->first();
        $this->assertNotNull($deletion);
        $this->assertSame($admin->id, $deletion->user_id);
        $this->assertSame(-10, $deletion->quantity);

        // The deletion's own audit entry must still resolve the batch code
        // and product name even though the batch itself is gone.
        $movements = $this->actingAs($admin, 'sanctum')->getJson('/api/stocks/movements');
        $entry = collect($movements->json('data'))->firstWhere('id', $deletion->id);
        $this->assertSame('BT01-2026-000001', $entry['product_batch']['batch_code']);
        $this->assertSame('Téléphone', $entry['product_batch']['product']['name']);
    }

    public function test_a_batch_already_used_in_a_sale_cannot_be_deleted(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'batch' => $batch] = $this->makeShopAdminWithBatch();

        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $admin->id,
            'opening_amount' => 0,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $admin,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 70000]],
            paymentMethod: 'cash',
        );

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/stocks/{$batch->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('product_batches', ['id' => $batch->id]);
    }

    public function test_receiving_stock_traces_the_supplier_and_the_receiving_user(): void
    {
        ['shop' => $shop, 'admin' => $admin, 'product' => $product] = $this->makeShopAdminWithBatch();
        $supplier = Supplier::create(['name' => 'Grossiste Sénégal']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/stocks', [
            'product_id' => $product->id,
            'shop_id' => $shop->id,
            'supplier_id' => $supplier->id,
            'purchase_cost' => 1000,
            'additional_costs' => 0,
            'min_profit_amount' => 200,
            'quantity' => 5,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('supplier.id', $supplier->id);
        $response->assertJsonPath('supplier.name', 'Grossiste Sénégal');
        $response->assertJsonPath('received_by', $admin->id);
        $response->assertJsonPath('received_by_user.id', $admin->id);
        $response->assertJsonPath('received_by_user.name', $admin->name);

        // The receivedByUser relation must never overwrite the received_by
        // foreign key column when both are serialized together.
        $listing = $this->actingAs($admin, 'sanctum')->getJson('/api/stocks');
        $listing->assertOk();
        $entry = collect($listing->json())->firstWhere('supplier_id', $supplier->id);
        $this->assertSame($admin->id, $entry['received_by']);
        $this->assertSame($admin->id, $entry['received_by_user']['id']);
    }

    public function test_a_cashier_cannot_edit_or_delete_a_batch(): void
    {
        ['shop' => $shop, 'batch' => $batch] = $this->makeShopAdminWithBatch();
        $cashierRole = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $cashier = User::factory()->create(['role_id' => $cashierRole->id, 'shop_id' => $shop->id]);

        $this->actingAs($cashier, 'sanctum')
            ->putJson("/api/stocks/{$batch->id}", ['purchase_cost' => 1, 'additional_costs' => 0, 'min_profit_amount' => 1])
            ->assertStatus(403);

        $this->actingAs($cashier, 'sanctum')
            ->deleteJson("/api/stocks/{$batch->id}")
            ->assertStatus(403);
    }
}
