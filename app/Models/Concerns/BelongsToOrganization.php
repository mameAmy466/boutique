<?php

namespace App\Models\Concerns;

use App\Models\Organization;
use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * For organization-level data (catalogue, suppliers, chart of accounts...):
 * every query is limited to the current tenant and new rows are stamped
 * with it, so one client can never read or attach another client's rows,
 * even by guessing an id in a URL.
 */
trait BelongsToOrganization
{
    public static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope('organization', function (Builder $query) {
            if (($organizationId = Tenant::id()) !== null) {
                $query->where($query->qualifyColumn('organization_id'), $organizationId);
            }
        });

        static::creating(function ($model) {
            if (! $model->organization_id && ($organizationId = Tenant::id()) !== null) {
                $model->organization_id = $organizationId;
            }
        });
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
