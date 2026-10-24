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
 * in which case the tenant scopes are not applied.
 */
class Tenant
{
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

        return Auth::user()?->organization_id;
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
