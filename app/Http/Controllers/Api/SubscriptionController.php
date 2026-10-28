<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Services\SubscriptionService;
use App\Support\PlanFeatures;
use Illuminate\Http\Request;

/**
 * A client's own view of its subscription. Deliberately outside the
 * organization.access middleware: a suspended or expired client must still
 * be able to see why, and what to pay.
 */
class SubscriptionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    public function show(Request $request)
    {
        $organization = $request->user()->organization;

        if (! $organization) {
            return response()->json(['organization' => null, 'subscription' => null, 'access' => null]);
        }

        $subscription = $this->subscriptions->currentSubscriptionFor($organization);
        if ($subscription) {
            $this->subscriptions->refreshStatus($subscription);
        }
        $endsAt = $subscription?->endsAt() ?? $subscription?->current_period_end;

        return response()->json([
            'organization' => $organization->only(['id', 'name', 'status', 'suspended_at', 'suspension_reason']),
            'subscription' => $subscription ? [
                'status' => $subscription->status,
                'plan' => $subscription->plan->only(['code', 'name', 'monthly_price', 'annual_price']),
                'billing_cycle' => $subscription->billing_cycle,
                'trial_ends_at' => $subscription->trial_ends_at?->toDateString(),
                'current_period_end' => $subscription->current_period_end?->toDateString(),
                'ends_at' => $endsAt?->toDateString(),
                'days_left' => $endsAt ? (int) now()->startOfDay()->diffInDays($endsAt, false) : null,
                'grace_days' => $subscription->grace_days,
            ] : null,
            'access' => $this->subscriptions->accessDenial($organization),
            // What the interface may show: menus and pages are built from
            // these, and the API checks the same keys (feature: middleware).
            'features' => $this->subscriptions->features($organization),
            'limits' => $this->subscriptions->limits($organization),
            'usage' => [
                'max_shops' => Shop::count(),
                'max_users' => User::where('organization_id', $organization->id)->count(),
                'max_registers' => CashRegister::count(),
                'max_products' => Product::count(),
            ],
            'feature_labels' => collect(PlanFeatures::FLAGS)->map(fn ($f) => $f['label'])
                ->merge(collect(PlanFeatures::LIMITS)->map(fn ($l) => $l['label'])),
            'is_platform_admin' => $request->user()->isPlatformAdmin(),
            'payments' => $organization->payments()->latest('paid_at')->limit(12)
                ->get(['id', 'amount', 'method', 'reference', 'months', 'paid_at', 'period_start', 'period_end']),
            'plans' => Plan::where('is_active', true)->orderBy('monthly_price')
                ->get(['code', 'name', 'monthly_price', 'annual_price']),
        ]);
    }
}
