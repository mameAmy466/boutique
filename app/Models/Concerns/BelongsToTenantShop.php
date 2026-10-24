<?php

namespace App\Models\Concerns;

use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;

/**
 * For shop-level data (sales, stock, expenses...): limits every query to
 * rows whose shop belongs to the current tenant. Which shop of the tenant a
 * user may see is still decided by the controllers and policies.
 */
trait BelongsToTenantShop
{
    public static function bootBelongsToTenantShop(): void
    {
        static::addGlobalScope('organization', function (Builder $query) {
            if (($organizationId = Tenant::id()) !== null) {
                $query->whereIn(
                    $query->qualifyColumn('shop_id'),
                    fn ($shops) => $shops->select('id')->from('shops')->where('organization_id', $organizationId),
                );
            }
        });
    }
}
