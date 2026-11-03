<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * At the till: any price at or above the minimum, never below it — for
 * every role, with no way around it.
 */
class SaleMinimumPriceAtTillTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shop;

    private ProductBatch $batch;

    protected function setUp(): void
    {
        parent::setUp();

        $organization = $this->createOrganization();
        $this->shop = Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique', 'code' => 'BTQ']);
        $product = Product::create([
            'organization_id' => $organization->id, 'name' => 'Sac', 'reference' => 'SAC-1',
            'barcode' => '6001234567890', 'selling_price' => 2500, 'unit' => 'pcs', 'min_stock' => 0,
        ]);
        $this->batch = ProductBatch::create([
            'batch_code' => 'BTQ-1', 'product_id' => $product->id, 'shop_id' => $this->shop->id,
            'purchase_cost' => 1000, 'additional_costs' => 0, 'cost_price' => 1000,
            'min_profit_amount' => 500, 'min_price' => 1500,
            'quantity_received' => 50, 'quantity_available' => 50, 'received_at' => now(),
        ]);
    }

    private function user(string $roleSlug, string $email): User
    {
        $role = Role::firstOrCreate(['slug' => $roleSlug], ['name' => $roleSlug]);

        return User::factory()->create([
            'email' => $email, 'password' => 'secret123', 'role_id' => $role->id,
            'organization_id' => $this->shop->organization_id,
            'shop_id' => $roleSlug === Role::SUPER_ADMIN ? null : $this->shop->id,
        ]);
    }

    private function sell(User $seller, float $price, array $extra = [])
    {
        $register = CashRegister::firstOrCreate(['shop_id' => $this->shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::firstOrCreate(
            ['cash_register_id' => $register->id, 'user_id' => $seller->id, 'status' => CashSession::STATUS_OPEN],
            ['opening_amount' => 0, 'opened_at' => now()],
        );

        return $this->actingAs($seller, 'sanctum')->postJson('/api/sales', [
            'shop_id' => $this->shop->id,
            'cash_session_id' => $session->id,
            'payment_method' => 'cash',
            'items' => [['product_batch_id' => $this->batch->id, 'quantity' => 2, 'unit_price' => $price]],
            ...$extra,
        ]);
    }

    public function test_any_price_from_the_minimum_up_is_accepted(): void
    {
        $cashier = $this->user(Role::CAISSIER, 'caisse@example.com');

        $this->sell($cashier, 1500)->assertCreated();
        $this->sell($cashier, 9000)->assertCreated();
        $this->assertSame(46, $this->batch->fresh()->quantity_available);
    }

    public function test_nobody_can_sell_below_the_minimum(): void
    {
        foreach ([Role::CAISSIER, Role::ADMIN_BOUTIQUE, Role::SUPER_ADMIN] as $i => $role) {
            $seller = $this->user($role, "vendeur{$i}@example.com");

            $this->sell($seller, 1499, [
                // Extra fields from an old client are ignored, not obeyed.
                'confirm_below_min' => true,
                'price_authorization' => ['email' => "vendeur{$i}@example.com", 'password' => 'secret123'],
            ])->assertStatus(422)->assertJsonPath('code', 'price_below_minimum');
        }

        $this->assertSame(50, $this->batch->fresh()->quantity_available);
    }

    public function test_products_carry_a_barcode_and_a_usual_price(): void
    {
        $owner = $this->user(Role::SUPER_ADMIN, 'owner@example.com');

        $this->actingAs($owner, 'sanctum')->postJson('/api/products', [
            'name' => 'Ceinture', 'reference' => 'CEI-1', 'barcode' => '6001234567890', 'selling_price' => 3000,
        ])->assertStatus(422)->assertJsonPath('errors.barcode.0', 'Ce code-barres est déjà utilisé par un autre produit.');

        $this->actingAs($owner, 'sanctum')->postJson('/api/products', [
            'name' => 'Ceinture', 'reference' => 'CEI-1', 'barcode' => '6009999999999', 'selling_price' => 3000,
        ])->assertCreated()->assertJsonPath('selling_price', '3000.00');
    }
}
