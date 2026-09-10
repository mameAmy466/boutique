<?php

namespace Tests\Unit;

use App\Exceptions\PriceBelowMinimumException;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Shop;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    private PricingService $pricing;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pricing = new PricingService;
    }

    public function test_cost_price_is_purchase_cost_plus_additional_costs(): void
    {
        $this->assertSame(52000.0, $this->pricing->computeCostPrice(50000, 2000));
    }

    public function test_min_price_is_cost_price_plus_min_profit(): void
    {
        $costPrice = $this->pricing->computeCostPrice(50000, 2000);

        $this->assertSame(60000.0, $this->pricing->computeMinPrice($costPrice, 8000));
    }

    public function test_it_rejects_a_sale_price_below_the_minimum(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT01']);
        $product = Product::create(['name' => 'Téléphone', 'reference' => 'REF-001']);
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

        $this->expectException(PriceBelowMinimumException::class);

        $this->pricing->assertValidSalePrice($batch, 59000);
    }

    public function test_it_accepts_a_sale_price_at_or_above_the_minimum(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BT02']);
        $product = Product::create(['name' => 'Téléphone', 'reference' => 'REF-002']);
        $batch = ProductBatch::create([
            'batch_code' => 'BT02-2026-000001',
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

        $this->pricing->assertValidSalePrice($batch, 60000);
        $this->pricing->assertValidSalePrice($batch, 70000);

        $this->addToAssertionCount(2);
    }
}
