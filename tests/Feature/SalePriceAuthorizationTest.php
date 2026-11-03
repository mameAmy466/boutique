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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * At the till: any price above the minimum, never below it unless a manager
 * of the shop authorizes it — the seller themself when they manage the
 * shop, or a manager typing their credentials for a cashier.
 */
class SalePriceAuthorizationTest extends TestCase
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

    public function test_a_price_above_the_minimum_needs_no_authorization(): void
    {
        $cashier = $this->user(Role::CAISSIER, 'caisse@example.com');

        $this->sell($cashier, 9000)->assertCreated();
        $this->assertSame(48, $this->batch->fresh()->quantity_available);
    }

    public function test_below_the_minimum_without_authorization_is_refused(): void
    {
        $cashier = $this->user(Role::CAISSIER, 'caisse@example.com');

        $this->sell($cashier, 1200)->assertStatus(422)->assertJsonPath('code', 'price_below_minimum');
        // A cashier cannot authorize themself.
        $this->sell($cashier, 1200, ['confirm_below_min' => true])->assertStatus(422);
        $this->assertSame(50, $this->batch->fresh()->quantity_available);
    }

    public function test_a_manager_typing_their_credentials_authorizes_it(): void
    {
        $cashier = $this->user(Role::CAISSIER, 'caisse@example.com');
        $manager = $this->user(Role::ADMIN_BOUTIQUE, 'chef@example.com');

        $sale = $this->sell($cashier, 1200, [
            'price_authorization' => ['email' => 'chef@example.com', 'password' => 'secret123'],
        ])->assertCreated()->json();

        $sale = Sale::with('items')->findOrFail($sale['id']);
        $this->assertSame($manager->id, $sale->price_authorized_by);
        $this->assertTrue($sale->items->first()->below_min_price);
    }

    public function test_wrong_or_insufficient_credentials_are_refused(): void
    {
        $cashier = $this->user(Role::CAISSIER, 'caisse@example.com');
        $this->user(Role::ADMIN_BOUTIQUE, 'chef@example.com');
        $this->user(Role::CAISSIER, 'autre@example.com');

        $this->sell($cashier, 1200, ['price_authorization' => ['email' => 'chef@example.com', 'password' => 'faux']])
            ->assertStatus(422)->assertJsonValidationErrors('price_authorization');
        // Another cashier is not a manager.
        $this->sell($cashier, 1200, ['price_authorization' => ['email' => 'autre@example.com', 'password' => 'secret123']])
            ->assertStatus(422)->assertJsonValidationErrors('price_authorization');
        $this->assertSame(50, $this->batch->fresh()->quantity_available);
    }

    public function test_a_manager_selling_confirms_it_themself(): void
    {
        $manager = $this->user(Role::ADMIN_BOUTIQUE, 'chef@example.com');

        $id = $this->sell($manager, 1200, ['confirm_below_min' => true])->assertCreated()->json('id');
        $this->assertSame($manager->id, Sale::findOrFail($id)->price_authorized_by);
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
