<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use HasFactory;

    public const STATUS_TRIAL = 'trial';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAST_DUE = 'past_due';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'organization_id',
        'plan_id',
        'status',
        'billing_cycle',
        'trial_ends_at',
        'current_period_start',
        'current_period_end',
        'cancelled_at',
        'extra_shops',
        'extra_users',
        'extra_registers',
    ];

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

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * trial/active/past_due (grace period) still grant access; only
     * cancelled/suspended cut it off — see the report's lifecycle rules.
     */
    public function grantsAccess(): bool
    {
        return in_array($this->status, [self::STATUS_TRIAL, self::STATUS_ACTIVE, self::STATUS_PAST_DUE], true);
    }
}
