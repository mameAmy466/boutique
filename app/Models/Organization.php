<?php

namespace App\Models;

use Database\Seeders\AccountingSeeder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

/**
 * A client of the platform (tenant). Every shop, user, product and record
 * belongs to exactly one organization, and only sees its own data.
 */
class Organization extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUS_CLOSED = 'closed';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_SUSPENDED, self::STATUS_CLOSED];

    protected $fillable = ['name', 'email', 'phone', 'status', 'suspended_at', 'suspension_reason'];

    protected function casts(): array
    {
        return [
            'suspended_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Each client starts with its own copy of the default chart of
        // accounts. Older migrations create organizations before that chart
        // was per-organization; the 2026_10_24_100000 migration covers those.
        static::created(function (Organization $organization) {
            if (Schema::hasColumn('accounts', 'organization_id')) {
                (new AccountingSeeder())->installFor($organization->id);
            }
        });
    }

    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(PlatformAuditLog::class);
    }

    /**
     * A foundations-phase simplification: one non-cancelled subscription per
     * organization at a time (no plan-change history yet — see
     * SubscriptionService).
     */
    public function currentSubscription(): ?Subscription
    {
        return $this->subscriptions()
            ->whereNotIn('status', [Subscription::STATUS_CANCELLED])
            ->latest('id')
            ->first();
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}
