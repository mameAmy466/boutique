<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaleDiscountAndCancellationTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopWithBatchAndSession(string $roleSlug): array
    {
        $role = Role::firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $user = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

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
            'user_id' => $user->id,
            'opening_amount' => 0,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);

        return compact('shop', 'user', 'product', 'batch', 'session');
    }

    private function saleItemsPayload(array $batch, float $unitPrice = 65000): array
    {
        return [['product_batch_id' => $batch['id'], 'quantity' => 1, 'unit_price' => $unitPrice]];
    }

    public function test_a_cashier_cannot_apply_any_discount(): void
    {
        ['shop' => $shop, 'user' => $cashier, 'batch' => $batch, 'session' => $session] =
            $this->makeShopWithBatchAndSession(Role::CAISSIER);

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'discount' => 1,
            'items' => [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 65000]],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('sales', 0);
    }

    public function test_a_shop_admin_cannot_discount_below_total_cost(): void
    {
        ['shop' => $shop, 'user' => $admin, 'batch' => $batch, 'session' => $session] =
            $this->makeShopWithBatchAndSession(Role::ADMIN_BOUTIQUE);

        // subtotal 65000, cost 50000 -> max discount is 15000
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'discount' => 15001,
            'items' => [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 65000]],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('sales', 0);
    }

    public function test_a_shop_admin_can_discount_within_the_margin(): void
    {
        ['shop' => $shop, 'user' => $admin, 'batch' => $batch, 'session' => $session] =
            $this->makeShopWithBatchAndSession(Role::ADMIN_BOUTIQUE);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'discount' => 10000,
            'items' => [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 65000]],
        ]);

        $response->assertCreated();
        $this->assertSame('55000.00', $response->json('total'));
    }

    public function test_cancelling_a_sale_requires_a_reason_and_records_it(): void
    {
        ['shop' => $shop, 'user' => $admin, 'batch' => $batch, 'session' => $session] =
            $this->makeShopWithBatchAndSession(Role::ADMIN_BOUTIQUE);

        $sale = app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $admin,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 65000]],
            paymentMethod: 'cash',
        );

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/sales/{$sale->id}/cancel")
            ->assertStatus(422);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/sales/{$sale->id}/cancel", [
            'reason' => 'Erreur de saisie du montant',
        ]);

        $response->assertOk();
        $this->assertSame('cancelled', $response->json('status'));
        $this->assertSame('Erreur de saisie du montant', $response->json('cancellation_reason'));
        $this->assertSame($admin->id, $response->json('cancelled_by'));
        $this->assertNotNull($response->json('cancelled_at'));
    }

    public function test_a_cancelled_sales_detail_resolves_who_cancelled_it_without_overwriting_the_id(): void
    {
        ['shop' => $shop, 'user' => $admin, 'batch' => $batch, 'session' => $session] =
            $this->makeShopWithBatchAndSession(Role::ADMIN_BOUTIQUE);

        $sale = app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $admin,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 65000]],
            paymentMethod: 'cash',
        );

        app(SaleService::class)->cancelSale($sale, $admin, 'Motif de test');

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/sales/{$sale->id}");

        $response->assertOk();
        $this->assertSame($admin->id, $response->json('cancelled_by'));
        $this->assertSame($admin->id, $response->json('cancelled_by_user.id'));
        $this->assertSame($admin->name, $response->json('cancelled_by_user.name'));
    }

    public function test_a_sale_cannot_be_cancelled_twice(): void
    {
        ['shop' => $shop, 'user' => $admin, 'batch' => $batch, 'session' => $session] =
            $this->makeShopWithBatchAndSession(Role::ADMIN_BOUTIQUE);

        $sale = app(SaleService::class)->createSale(
            shop: $shop,
            cashier: $admin,
            cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 65000]],
            paymentMethod: 'cash',
        );

        app(SaleService::class)->cancelSale($sale, $admin, 'Premier motif');

        $this->expectException(\RuntimeException::class);
        app(SaleService::class)->cancelSale($sale->fresh(), $admin, 'Deuxième motif');
    }
}
