<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A payment received from a client for their subscription, recorded by the platform admin. */
class SubscriptionPayment extends Model
{
    public const METHODS = ['cash', 'wave', 'orange_money', 'free_money', 'bank_transfer', 'card', 'other'];

    protected $fillable = [
        'organization_id',
        'subscription_id',
        'plan_id',
        'amount',
        'method',
        'reference',
        'months',
        'paid_at',
        'period_start',
        'period_end',
        'note',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
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

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
