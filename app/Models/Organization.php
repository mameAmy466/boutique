<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'email', 'phone'];

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
}
