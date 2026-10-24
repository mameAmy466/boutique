<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Role;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\Supplier;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Two clients on the same platform must never see, change or reference each
 * other's data, whatever ids they put in a request.
 */
class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{organization: Organization, owner: User, shop: Shop, product: Product, batch: ProductBatch, category: Category, supplier: Supplier, customer: Customer, sale: Sale} */
    private function makeClient(string $code): array
    {
        $organization = $this->createOrganization();
        $shop = Shop::create(['organization_id' => $organization->id, 'name' => "Boutique {$code}", 'code' => $code]);
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $owner = User::factory()->create(['role_id' => $role->id, 'organization_id' => $organization->id]);

        $category = Category::create(['organization_id' => $organization->id, 'name' => "Catégorie {$code}"]);
        $supplier = Supplier::create(['organization_id' => $organization->id, 'name' => "Fournisseur {$code}"]);
        $product = Product::create([
            'organization_id' => $organization->id, 'name' => "Produit {$code}", 'reference' => 'REF-1',
            'category_id' => $category->id, 'supplier_id' => $supplier->id, 'unit' => 'pcs', 'min_stock' => 1,
        ]);
        $batch = ProductBatch::create([
            'batch_code' => "{$code}-2026-000001", 'product_id' => $product->id, 'shop_id' => $shop->id,
            'purchase_cost' => 1000, 'additional_costs' => 0, 'cost_price' => 1000,
            'min_profit_amount' => 500, 'min_price' => 1500,
            'quantity_received' => 100, 'quantity_available' => 100, 'received_at' => now(),
        ]);
        $customer = Customer::create(['shop_id' => $shop->id, 'name' => "Client {$code}"]);
        $register = CashRegister::create(['shop_id' => $shop->id, 'name' => 'Caisse 1']);
        $session = CashSession::create([
            'cash_register_id' => $register->id, 'user_id' => $owner->id,
            'opening_amount' => 0, 'opened_at' => now(), 'status' => CashSession::STATUS_OPEN,
        ]);
        $sale = app(SaleService::class)->createSale(
            shop: $shop, cashier: $owner, cashSession: $session,
            items: [['product_batch_id' => $batch->id, 'quantity' => 1, 'unit_price' => 1500]],
            paymentMethod: 'cash',
        );

        return compact('organization', 'owner', 'shop', 'product', 'batch', 'category', 'supplier', 'customer', 'sale');
    }

    public function test_lists_only_contain_the_clients_own_data(): void
    {
        $a = $this->makeClient('BTA');
        $b = $this->makeClient('BTB');

        $as = $this->actingAs($a['owner'], 'sanctum');

        $this->assertSame([$a['product']->id], collect($as->getJson('/api/products')->json())->pluck('id')->all());
        $this->assertSame([$a['category']->id], collect($as->getJson('/api/categories')->json())->pluck('id')->all());
        $this->assertSame([$a['shop']->id], collect($as->getJson('/api/shops')->json())->pluck('id')->all());

        $saleIds = collect($as->getJson('/api/sales')->json('data') ?? $as->getJson('/api/sales')->json())->pluck('id')->all();
        $this->assertContains($a['sale']->id, $saleIds);
        $this->assertNotContains($b['sale']->id, $saleIds);

        $suppliers = collect($as->getJson('/api/suppliers')->json('data') ?? $as->getJson('/api/suppliers')->json())->pluck('id')->all();
        $this->assertNotContains($b['supplier']->id, $suppliers);

        $customers = collect($as->getJson('/api/customers')->json('data') ?? $as->getJson('/api/customers')->json())->pluck('id')->all();
        $this->assertNotContains($b['customer']->id, $customers);

        $batches = collect($as->getJson('/api/stocks')->json('data') ?? $as->getJson('/api/stocks')->json())->pluck('id')->all();
        $this->assertNotContains($b['batch']->id, $batches);
    }

    public function test_another_clients_records_cannot_be_opened_or_changed_by_id(): void
    {
        $a = $this->makeClient('BTA');
        $b = $this->makeClient('BTB');

        $as = $this->actingAs($a['owner'], 'sanctum');

        $as->getJson("/api/products/{$b['product']->id}")->assertNotFound();
        $as->putJson("/api/products/{$b['product']->id}", ['name' => 'Piraté'])->assertNotFound();
        $as->deleteJson("/api/products/{$b['product']->id}")->assertNotFound();
        $as->getJson("/api/sales/{$b['sale']->id}")->assertNotFound();
        $as->postJson("/api/sales/{$b['sale']->id}/cancel", ['reason' => 'x'])->assertNotFound();
        $as->getJson("/api/customers/{$b['customer']->id}")->assertNotFound();
        $as->putJson("/api/suppliers/{$b['supplier']->id}", ['name' => 'Piraté'])->assertNotFound();
        $as->getJson("/api/dashboard/shop/{$b['shop']->id}")->assertNotFound();

        $this->assertSame('Produit BTB', $b['product']->fresh()->name);
        $this->assertSame('Fournisseur BTB', $b['supplier']->fresh()->name);
    }

    public function test_another_clients_ids_are_rejected_in_forms(): void
    {
        $a = $this->makeClient('BTA');
        $b = $this->makeClient('BTB');

        $this->actingAs($a['owner'], 'sanctum')->postJson('/api/products', [
            'name' => 'Nouveau', 'reference' => 'REF-NEW',
            'category_id' => $b['category']->id, 'supplier_id' => $b['supplier']->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['category_id', 'supplier_id']);

        $this->actingAs($a['owner'], 'sanctum')->postJson('/api/stocks', [
            'product_id' => $b['product']->id, 'shop_id' => $b['shop']->id,
            'purchase_cost' => 1000, 'quantity_received' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors(['product_id', 'shop_id']);
    }

    public function test_each_client_has_its_own_catalogue_references_and_chart_of_accounts(): void
    {
        $a = $this->makeClient('BTA');
        $b = $this->makeClient('BTB');

        // Both clients use the reference REF-1 without clashing.
        $this->assertSame('REF-1', $a['product']->reference);
        $this->assertSame('REF-1', $b['product']->reference);

        $accountsA = collect($this->actingAs($a['owner'], 'sanctum')->getJson('/api/accounts')->json());
        $this->assertNotEmpty($accountsA);
        $this->assertTrue($accountsA->every(fn ($account) => $account['organization_id'] === $a['organization']->id));

        $caisseB = Account::withoutGlobalScopes()->where('organization_id', $b['organization']->id)->where('code', '571')->firstOrFail();
        $this->actingAs($a['owner'], 'sanctum')->putJson("/api/accounts/{$caisseB->id}", ['name' => 'Piraté'])->assertNotFound();
        $this->actingAs($a['owner'], 'sanctum')->getJson("/api/accounting/ledger/{$caisseB->id}")->assertNotFound();
    }

    public function test_signup_creates_an_independent_organization(): void
    {
        $existing = $this->makeClient('BTA');

        $response = $this->postJson('/api/register', [
            'organization_name' => 'Téléphones Diallo', 'name' => 'Moussa Diallo',
            'email' => 'moussa@example.com', 'password' => 'secret123',
            'shop_name' => 'Diallo Phones', 'shop_code' => 'DIALLO', 'plan_code' => 'pro',
        ])->assertCreated();

        $token = $response->json('token');
        $products = $this->withToken($token)->getJson('/api/products')->assertOk()->json();
        $this->assertSame([], $products);

        $newUser = User::where('email', 'moussa@example.com')->firstOrFail();
        $this->assertNotSame($existing['organization']->id, $newUser->organization_id);
        $this->assertFalse($newUser->isPlatformAdmin());
        $this->assertSame(16, Account::where('organization_id', $newUser->organization_id)->count());
    }
}
