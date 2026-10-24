<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

/** History of platform-level actions: suspensions, reactivations, plan changes, payments... */
class PlatformAuditLog extends Model
{
    protected $fillable = ['organization_id', 'user_id', 'action', 'description', 'details'];

    protected function casts(): array
    {
        return ['details' => 'array'];
    }

    public static function record(?Organization $organization, string $action, string $description, array $details = []): self
    {
        return self::create([
            'organization_id' => $organization?->id,
            'user_id' => Auth::id(),
            'action' => $action,
            'description' => $description,
            'details' => $details ?: null,
        ]);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
