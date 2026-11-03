<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use App\Support\Ean13;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Product extends Model
{
    use BelongsToOrganization, HasFactory;

    protected function casts(): array
    {
        return ['selling_price' => 'decimal:2'];
    }

    public const REFERENCE_PREFIX = 'PRD-';

    public static function nextReference(?int $organizationId): string
    {
        $last = self::withoutGlobalScopes()
            ->where('organization_id', $organizationId)
            ->where('reference', 'like', self::REFERENCE_PREFIX.'%')
            ->pluck('reference')
            ->map(fn (string $reference) => (int) substr($reference, strlen(self::REFERENCE_PREFIX)))
            ->max() ?? 0;

        return self::REFERENCE_PREFIX.str_pad((string) ($last + 1), 5, '0', STR_PAD_LEFT);
    }

    /**
     * Every product has one barcode for good, printed on all its labels
     * whatever batch the item comes from: the manufacturer's when it is
     * typed or scanned in, an in-store one otherwise.
     */
    protected static function booted(): void
    {
        // The reference is numbered per client: PRD-00001, PRD-00002...
        static::creating(function (Product $product) {
            if (blank($product->reference)) {
                $product->reference = self::nextReference($product->organization_id);
            }
        });

        static::created(function (Product $product) {
            if (! $product->barcode) {
                $product->forceFill(['barcode' => Ean13::forProduct($product->id)])->saveQuietly();
            }
        });
    }

    protected $fillable = [
        'organization_id',
        'name',
        'reference',
        'barcode',
        'selling_price',
        'category_id',
        'supplier_id',
        'brand',
        'description',
        'unit',
        'image_path',
        'min_stock',
        'max_stock',
        'status',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return Storage::disk('public')->url($this->image_path);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }

    public function stockInShop(int $shopId): int
    {
        return $this->batches()
            ->where('shop_id', $shopId)
            ->sum('quantity_available');
    }
}
