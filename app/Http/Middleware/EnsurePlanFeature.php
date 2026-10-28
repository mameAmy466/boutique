<?php

namespace App\Http\Middleware;

use App\Services\SubscriptionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `feature:employees` on a route: the client's plan must include that
 * feature (see App\Support\PlanFeatures), whatever the interface shows.
 */
class EnsurePlanFeature
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $organization = $request->user()?->organization()->first();

        // Accounts outside any organization (legacy single-shop installs)
        // keep every module.
        if ($organization) {
            $this->subscriptions->assertFeature($organization, $feature);
        }

        return $next($request);
    }
}
