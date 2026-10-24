<?php

namespace App\Models;

use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use HasFactory;

    /** Invoices have no shop of their own: they belong to the tenant of their sale. */
    protected static function booted(): void
    {
        static::addGlobalScope('organization', function (Builder $query) {
            if (($organizationId = Tenant::id()) !== null) {
                $query->whereIn($query->qualifyColumn('sale_id'), fn ($sales) => $sales->select('id')->from('sales')
                    ->whereIn('shop_id', fn ($shops) => $shops->select('id')->from('shops')->where('organization_id', $organizationId)));
            }
        });
    }

    protected $fillable = [
        'sale_id',
        'invoice_number',
        'issued_at',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}
