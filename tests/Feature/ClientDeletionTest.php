<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\JournalEntry;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A client with real activity (sales, hence journal entries on its own
 * chart of accounts) can be deleted for good, one by one or all at once.
 */
class ClientDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function clientWithSales(string $code): Organization
    {
        $organization = $this->createOrganization();
        $shop = Shop::create(['organization_id' => $organization->id, 'name' => "Boutique {$code}", 'code' => $code]);
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $owner = User::factory()->create(['role_id' => $role->id, 'organization_id' => $organization->id]);
        $product = Product::create(['organization_id' => $organization->id, 'name' => 'Sac', 'unit' => 'pcs', 'min_stock' => 0]);
        $batch = ProductBatch::create([
            'batch_code' => "{$code}-1", 'product_id' => $product->id, 'shop_id' => $shop->id,
            'purchase_cost' => 1000, 'additional_costs' => 0, 'cost_price' => 1000, 'min_profit_amount' => 500,
            'min_price' => 1500, 'quantity_received' => 10, 'quantity_available' => 10, 'received_at' => now(),
        ]);
        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id, 'user_id' => $owner->id,
            'opening_amount' => 0, 'opened_at' => now(), 'status' => CashSession::STATUS_OPEN,
        ]);
        app(SaleService::class)->createSale(
            shop: $shop, cashier: $owner, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 2000]],
            paymentMethod: 'cash',
        );

        return $organization;
    }

    public function test_the_super_admin_can_delete_a_client_that_has_sales(): void
    {
        $organization = $this->clientWithSales('BTA');
        $this->assertGreaterThan(0, JournalEntry::withoutGlobalScopes()->count());
        $operator = User::factory()->create(['organization_id' => null, 'role_id' => null, 'is_platform_admin' => true]);

        $this->actingAs($operator, 'sanctum')->postJson("/api/platform/organizations/{$organization->id}/close")->assertOk();
        $this->actingAs($operator, 'sanctum')->deleteJson("/api/platform/organizations/{$organization->id}", [
            'confirm_name' => $organization->name,
        ])->assertNoContent();

        $this->assertNull(Organization::find($organization->id));
        $this->assertSame(0, JournalEntry::withoutGlobalScopes()->count());
        $this->assertSame(1, User::count());
    }

    public function test_all_clients_can_be_deleted_at_once_keeping_the_platform(): void
    {
        $this->clientWithSales('BTA');
        $this->clientWithSales('BTB');
        User::factory()->create(['email' => 'admin@myboutiqu.com', 'organization_id' => null, 'role_id' => null, 'is_platform_admin' => true]);

        $this->artisan('platform:delete-clients', ['--force' => true])->assertSuccessful();

        $this->assertSame(0, Organization::count());
        $this->assertSame(0, Shop::withoutGlobalScopes()->count());
        $this->assertSame(['admin@myboutiqu.com'], User::pluck('email')->all());
        $this->assertSame(3, Plan::count());
    }
}
