<?php

namespace App\Http\Middleware;

use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks every business endpoint for an organization that is suspended,
 * closed or whose subscription has expired, and for the platform admin,
 * whose account is not a shop. Hiding menus in the interface is
 * not enough: the API itself refuses. The routes left outside this
 * middleware (profile, logout, subscription status) let the client see why
 * and pay.
 */
class EnsureOrganizationHasAccess
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        // The platform operator administers the platform, not a shop: no
        // sales, stock or accounting of its own (see /api/platform/*).
        if ($user->isPlatformAdmin()) {
            return response()->json([
                'code' => 'platform_account',
                'message' => "Ce compte administre la plateforme : il n'a pas de boutique. Utilisez l'espace Super Admin.",
            ], 403);
        }

        // Always read the current status: a suspension applies on the very
        // next request.
        $organization = $user->organization()->first();

        if (! $organization) {
            return $next($request);
        }

        if ($denial = $this->subscriptions->accessDenial($organization)) {
            return response()->json($denial, 402);
        }

        return $next($request);
    }
}
