<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use App\Support\Ean13;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** One barcode per product, for good — new stock receptions never change it. */
class ProductBarcodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_in_store_barcodes_are_valid_ean13(): void
    {
        $this->assertSame('2000000000428', Ean13::forProduct(42));
        $this->assertSame(13, strlen(Ean13::forProduct(123456)));
    }

    public function test_a_product_keeps_the_same_barcode_across_receptions(): void
    {
        $organization = $this->createOrganization();
        $shop = Shop::create(['organization_id' => $organization->id, 'name' => 'Boutique', 'code' => 'BTQ']);
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $owner = User::factory()->create(['role_id' => $role->id, 'organization_id' => $organization->id]);
        $as = $this->actingAs($owner, 'sanctum');

        $product = $as->postJson('/api/products', ['name' => 'Sac', 'reference' => 'SAC-1'])->assertCreated()->json();
        $barcode = Product::findOrFail($product['id'])->barcode;
        $this->assertSame(Ean13::forProduct($product['id']), $barcode);

        foreach ([1, 2] as $round) {
            $batch = $as->postJson('/api/stocks', [
                'product_id' => $product['id'], 'shop_id' => $shop->id,
                'purchase_cost' => 1000, 'min_profit_amount' => 500, 'quantity' => 5,
            ])->assertCreated()->json();

            // Each reception is its own batch, but the product's code does not move.
            $this->assertSame($barcode, $batch['product']['barcode']);
        }

        // A manufacturer's code typed in replaces it; clearing it gives the
        // in-store one back.
        $as->putJson("/api/products/{$product['id']}", ['barcode' => '6001234567890'])->assertOk();
        $this->assertSame('6001234567890', Product::findOrFail($product['id'])->barcode);
        $as->putJson("/api/products/{$product['id']}", ['barcode' => null])->assertOk();
        $this->assertSame($barcode, Product::findOrFail($product['id'])->barcode);
    }

    public function test_references_are_numbered_automatically_per_client(): void
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);
        $ownerA = User::factory()->create(['role_id' => $role->id, 'organization_id' => $this->createOrganization()->id]);
        $ownerB = User::factory()->create(['role_id' => $role->id, 'organization_id' => $this->createOrganization()->id]);

        $this->actingAs($ownerA, 'sanctum')->postJson('/api/products', ['name' => 'Sac'])
            ->assertCreated()->assertJsonPath('reference', 'PRD-00001');
        $this->actingAs($ownerA, 'sanctum')->postJson('/api/products', ['name' => 'Ceinture'])
            ->assertCreated()->assertJsonPath('reference', 'PRD-00002');

        // Each client has its own numbering.
        $this->actingAs($ownerB, 'sanctum')->postJson('/api/products', ['name' => 'Chaussure'])
            ->assertCreated()->assertJsonPath('reference', 'PRD-00001');
    }
}
