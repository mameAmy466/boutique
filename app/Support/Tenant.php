<?php

namespace App\Support;

use Illuminate\Support\Facades\Auth;

/**
 * Resolves the organization (tenant) whose data the current code path may
 * see. Defaults to the authenticated user's organization; code that runs
 * without a user (registration, console commands, platform admin actions)
 * can pin a tenant explicitly with Tenant::as().
 *
 * Returns null when there is no tenant at all (console, seeders, guests),
 * in which case the tenant scopes are not applied; Tenant::NONE for the
 * platform admin, who sees no tenant data through the scopes.
 */
class Tenant
{
    /** Matches no organization. */
    public const NONE = 0;

    private static ?int $forced = null;

    private static bool $isForced = false;

    public static function id(): ?int
    {
        if (self::$isForced) {
            return self::$forced;
        }

        // Only look at an already-resolved user: resolving the guard here
        // would query users from inside a model scope.
        if (! Auth::hasUser()) {
            return null;
        }

        $user = Auth::user();

        // The platform admin belongs to no organization and must not fall
        // through to "no scope": 0 matches no tenant row. Platform code reads
        // a client's data explicitly (Tenant::as, withoutGlobalScope).
        if ($user?->is_platform_admin) {
            return self::NONE;
        }

        return $user?->organization_id;
    }

    /**
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public static function as(?int $organizationId, callable $callback): mixed
    {
        [$previousId, $previousForced] = [self::$forced, self::$isForced];
        self::$forced = $organizationId;
        self::$isForced = true;

        try {
            return $callback();
        } finally {
            self::$forced = $previousId;
            self::$isForced = $previousForced;
        }
    }
}
