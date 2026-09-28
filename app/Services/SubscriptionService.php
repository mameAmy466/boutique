<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\PlanFeature;
use App\Models\Subscription;

/**
 * Resolves what an organization's current subscription allows — quotas
 * (max_shops, max_users, max_registers, max_products) and feature flags
 * (budget_enabled, multi_shop_dashboard, ...) — from the configurable
 * Plan/PlanFeature tables rather than hardcoded limits, so the pricing grid
 * can be tuned without a code change (see PlanSeeder for the launch grid).
 *
 * A quota's effective ceiling is the plan's included amount plus the
 * subscription's own extra_* add-on quantities ("forfait de base +
 * supplément par boutique/utilisateur/caisse").
 */
class SubscriptionService
{
    private const EXTRA_COLUMN_FOR_QUOTA = [
        'max_shops' => 'extra_shops',
        'max_users' => 'extra_users',
        'max_registers' => 'extra_registers',
    ];

    public function currentSubscriptionFor(Organization $organization): ?Subscription
    {
        return $organization->currentSubscription();
    }

    public function hasAccess(Organization $organization): bool
    {
        return (bool) $this->currentSubscriptionFor($organization)?->grantsAccess();
    }

    private function featureValue(Organization $organization, string $key): ?string
    {
        $subscription = $this->currentSubscriptionFor($organization);
        if (! $subscription) {
            return null;
        }

        return PlanFeature::query()
            ->where('plan_id', $subscription->plan_id)
            ->where('feature_key', $key)
            ->value('feature_value');
    }

    public function hasFeature(Organization $organization, string $key): bool
    {
        return $this->featureValue($organization, $key) === 'true';
    }

    /**
     * Null means unlimited. Returns 0 if no subscription/plan/feature is
     * configured at all — a misconfigured organization should never be
     * silently treated as unlimited.
     */
    public function limit(Organization $organization, string $key): ?int
    {
        $value = $this->featureValue($organization, $key);

        if ($value === 'unlimited') {
            return null;
        }

        if ($value === null || ! is_numeric($value)) {
            return 0;
        }

        $extra = 0;
        if ($column = self::EXTRA_COLUMN_FOR_QUOTA[$key] ?? null) {
            $extra = (int) ($this->currentSubscriptionFor($organization)?->{$column} ?? 0);
        }

        return (int) $value + $extra;
    }

    public function assertWithinLimit(Organization $organization, string $key, int $currentCount, string $message): void
    {
        $limit = $this->limit($organization, $key);

        if ($limit !== null && $currentCount >= $limit) {
            abort(422, $message);
        }
    }

    public function assertHasFeature(Organization $organization, string $key, string $message): void
    {
        if (! $this->hasFeature($organization, $key)) {
            abort(403, $message);
        }
    }
}
