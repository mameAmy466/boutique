<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoicingTaxTest extends TestCase
{
    use RefreshDatabase;

    private function makeCashierWithOpenSession(): array
    {
        $role = Role::create(['name' => 'Caissier', 'slug' => Role::CAISSIER]);
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $product = Product::create(['name' => 'Sac de riz 25kg', 'reference' => 'RIZ-25', 'unit' => 'sac', 'min_stock' => 1]);
        $batch = ProductBatch::create([
            'batch_code' => 'BT01-2026-000001', 'product_id' => $product->id, 'shop_id' => $shop->id,
            'purchase_cost' => 10000, 'additional_costs' => 0, 'cost_price' => 10000,
            'min_profit_amount' => 1000, 'min_price' => 11800,
            'quantity_received' => 20, 'quantity_available' => 20, 'received_at' => now(),
        ]);
        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id, 'user_id' => $cashier->id,
            'opening_amount' => 0, 'opened_at' => now(), 'status' => CashSession::STATUS_OPEN,
        ]);

        return compact('shop', 'cashier', 'batch', 'session');
    }

    public function test_a_sale_extracts_tva_from_its_ttc_total_by_default(): void
    {
        ['shop' => $shop, 'cashier' => $cashier, 'batch' => $batch, 'session' => $session] = $this->makeCashierWithOpenSession();

        // 11800 TTC at 18% VAT = 10000 HT + 1800 TVA.
        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'items' => [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 11800]],
        ]);
        $response->assertCreated();

        $sale = $this->actingAs($cashier, 'sanctum')->getJson("/api/sales/{$response->json('id')}");
        $sale->assertOk();
        $this->assertEquals('18.00', $sale->json('tax_rate'));
        $this->assertEquals(1800.0, $sale->json('tax_amount'));
        $this->assertEquals(10000.0, $sale->json('subtotal_ht'));
        $this->assertEquals(11800.0, (float) $sale->json('total'));
    }

    public function test_a_sale_can_be_marked_tax_exempt(): void
    {
        ['shop' => $shop, 'cashier' => $cashier, 'batch' => $batch, 'session' => $session] = $this->makeCashierWithOpenSession();

        $response = $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'tax_rate' => 0,
            'items' => [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 11800]],
        ]);
        $response->assertCreated();

        $sale = $this->actingAs($cashier, 'sanctum')->getJson("/api/sales/{$response->json('id')}");
        $this->assertEquals('0.00', $sale->json('tax_rate'));
        $this->assertEquals(0.0, $sale->json('tax_amount'));
        $this->assertEquals(11800.0, $sale->json('subtotal_ht'));
    }

    public function test_a_client_debt_gets_a_sequential_legal_invoice_number(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => 'Restaurant Le Baobab']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/client-debts', [
            'shop_id' => $shop->id, 'customer_id' => $customer->id, 'amount' => 90000,
        ]);
        $response->assertCreated();

        $this->assertMatchesRegularExpression(
            '/^FAC-CR-\d{4}-\d{6}$/',
            $response->json('invoice_number'),
        );
    }
}
