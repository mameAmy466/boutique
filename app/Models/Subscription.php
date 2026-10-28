<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Subscription extends Model
{
    use HasFactory;

    public const STATUS_TRIAL = 'trial';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAST_DUE = 'past_due';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_EXPIRED = 'expired';

    /** Signup approved (or pending), waiting for the first payment or a trial. */
    public const STATUS_PENDING_PAYMENT = 'pending_payment';

    /** Legacy value: suspension now lives on the organization (Organization::STATUS_SUSPENDED). */
    public const STATUS_SUSPENDED = 'suspended';

    public const STATUSES = [
        self::STATUS_PENDING_PAYMENT, self::STATUS_TRIAL, self::STATUS_ACTIVE, self::STATUS_PAST_DUE,
        self::STATUS_EXPIRED, self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'organization_id',
        'plan_id',
        'status',
        'billing_cycle',
        'trial_ends_at',
        'current_period_start',
        'current_period_end',
        'grace_days',
        'cancelled_at',
        'extra_shops',
        'extra_users',
        'extra_registers',
    ];

    /** Days a client keeps access after its period ends (column default). */
    public const DEFAULT_GRACE_DAYS = 7;

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'date',
            'current_period_start' => 'date',
            'current_period_end' => 'date',
            'cancelled_at' => 'date',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /** The date access stops if nothing is paid: end of trial or of the paid period. */
    public function endsAt(): ?Carbon
    {
        return $this->status === self::STATUS_TRIAL ? $this->trial_ends_at : $this->current_period_end;
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * trial/active/past_due (grace period) still grant access;
     * expired/cancelled/suspended cut it off. See CheckSubscriptions for
     * how a subscription moves between these states.
     */
    public function grantsAccess(): bool
    {
        return in_array($this->status, [self::STATUS_TRIAL, self::STATUS_ACTIVE, self::STATUS_PAST_DUE], true);
    }
}
