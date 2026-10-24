<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;

class PlatformDashboardController extends Controller
{
    public function __invoke()
    {
        $subscriptions = Subscription::query()
            ->whereIn('id', Subscription::query()->selectRaw('max(id)')->where('status', '!=', Subscription::STATUS_CANCELLED)->groupBy('organization_id'))
            ->get();

        $soon = now()->addDays(7)->toDateString();
        $expiringSoon = $subscriptions->filter(function (Subscription $subscription) use ($soon) {
            $endsAt = $subscription->endsAt();

            return in_array($subscription->status, [Subscription::STATUS_TRIAL, Subscription::STATUS_ACTIVE], true)
                && $endsAt && $endsAt->toDateString() <= $soon;
        })->count();

        $monthStart = now()->startOfMonth()->toDateString();
        $yearStart = now()->startOfYear()->toDateString();

        return response()->json([
            'organizations' => [
                'total' => Organization::count(),
                'active' => Organization::where('status', Organization::STATUS_ACTIVE)->count(),
                'suspended' => Organization::where('status', Organization::STATUS_SUSPENDED)->count(),
                'closed' => Organization::where('status', Organization::STATUS_CLOSED)->count(),
            ],
            'subscriptions' => [
                'trial' => $subscriptions->where('status', Subscription::STATUS_TRIAL)->count(),
                'active' => $subscriptions->where('status', Subscription::STATUS_ACTIVE)->count(),
                'past_due' => $subscriptions->where('status', Subscription::STATUS_PAST_DUE)->count(),
                'expired' => $subscriptions->where('status', Subscription::STATUS_EXPIRED)->count(),
                'expiring_soon' => $expiringSoon,
            ],
            'revenue' => [
                'month' => (float) SubscriptionPayment::where('paid_at', '>=', $monthStart)->sum('amount'),
                'year' => (float) SubscriptionPayment::where('paid_at', '>=', $yearStart)->sum('amount'),
            ],
            'by_plan' => $subscriptions->groupBy(fn ($s) => $s->plan?->name ?? '—')->map->count(),
        ]);
    }
}
