<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlanFeature;
use App\Models\Subscription;
use App\Support\PlanFeatures;

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
        return $this->accessDenial($organization) === null;
    }

    /**
     * Why this organization may not use the platform right now, or null when
     * it may. An organization's own status (suspended/closed by the platform
     * admin) wins over its subscription.
     *
     * @return array{code: string, message: string}|null
     */
    public function accessDenial(Organization $organization): ?array
    {
        if ($organization->status === Organization::STATUS_CLOSED) {
            return [
                'code' => 'organization_closed',
                'message' => 'Ce compte a été fermé. Contactez-nous si vous souhaitez le rouvrir.',
            ];
        }

        if ($organization->status === Organization::STATUS_INACTIVE) {
            $note = $organization->registration_note ? ' '.$organization->registration_note : '';

            return match ($organization->registration_status) {
                Organization::REGISTRATION_REJECTED => [
                    'code' => 'registration_rejected',
                    'message' => "Votre demande d'inscription n'a pas été acceptée.".$note,
                ],
                Organization::REGISTRATION_INFO_REQUESTED => [
                    'code' => 'registration_info_requested',
                    'message' => "Nous avons besoin d'informations complémentaires pour valider votre inscription.".$note,
                ],
                Organization::REGISTRATION_APPROVED => [
                    'code' => 'organization_pending_payment',
                    'message' => 'Votre inscription est acceptée. Votre boutique sera activée dès réception de votre paiement.',
                ],
                default => [
                    'code' => 'registration_pending',
                    'message' => "Votre inscription est en cours de validation. Vous pourrez utiliser votre boutique dès qu'elle sera activée.",
                ],
            };
        }

        if ($organization->status === Organization::STATUS_SUSPENDED) {
            return [
                'code' => 'organization_suspended',
                'message' => "L'accès de votre organisation est suspendu".
                    ($organization->suspension_reason ? ' : '.$organization->suspension_reason : '').
                    '. Régularisez votre abonnement ou contactez-nous pour le réactiver.',
            ];
        }

        $subscription = $this->currentSubscriptionFor($organization);
        if ($subscription) {
            $this->refreshStatus($subscription);
        }

        if (! $subscription?->grantsAccess()) {
            return [
                'code' => 'subscription_expired',
                'message' => 'Votre abonnement a expiré. Renouvelez-le pour continuer à utiliser la plateforme.',
            ];
        }

        return null;
    }

    /**
     * Moves a subscription along its lifecycle from its dates: once its trial
     * or paid period has ended it is past_due (still usable during the grace
     * period), then expired. Run daily by `subscriptions:check`, and on
     * every access check so a missed run never keeps a client open.
     */
    public function refreshStatus(Subscription $subscription): Subscription
    {
        if (! in_array($subscription->status, [Subscription::STATUS_TRIAL, Subscription::STATUS_ACTIVE, Subscription::STATUS_PAST_DUE], true)) {
            return $subscription;
        }

        $endsAt = $subscription->status === Subscription::STATUS_PAST_DUE
            ? ($subscription->current_period_end ?? $subscription->trial_ends_at)
            : $subscription->endsAt();

        if (! $endsAt) {
            return $subscription;
        }

        $today = now()->startOfDay();
        $status = $subscription->status;

        if ($today->gt($endsAt->copy()->addDays($subscription->grace_days ?? Subscription::DEFAULT_GRACE_DAYS))) {
            $status = Subscription::STATUS_EXPIRED;
        } elseif ($today->gt($endsAt)) {
            $status = Subscription::STATUS_PAST_DUE;
        }

        if ($status !== $subscription->status) {
            // A trial running out has no paid period: keep its end date as
            // the reference for the grace period.
            if ($subscription->status === Subscription::STATUS_TRIAL && ! $subscription->current_period_end) {
                $subscription->current_period_end = $subscription->trial_ends_at;
            }
            $subscription->status = $status;
            $subscription->save();
        }

        return $subscription;
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

    /**
     * Every on/off feature of the registry for this organization's current
     * plan — what the interface uses to build its menus.
     *
     * @return array<string, bool>
     */
    public function features(Organization $organization): array
    {
        $values = $this->planValues($organization);

        return collect(PlanFeatures::FLAGS)
            ->mapWithKeys(fn ($definition, $key) => [$key => ($values[$key] ?? null) === 'true'])
            ->all();
    }

    /**
     * Effective quotas (plan + add-ons); null means unlimited.
     *
     * @return array<string, int|null>
     */
    public function limits(Organization $organization): array
    {
        return collect(PlanFeatures::LIMITS)
            ->mapWithKeys(fn ($definition, $key) => [$key => $this->limit($organization, $key)])
            ->all();
    }

    /**
     * Names of the active plans that include a feature, cheapest first — to
     * tell a client which formula to move to.
     *
     * @return list<string>
     */
    public function plansIncluding(string $key): array
    {
        return Plan::query()
            ->where('is_active', true)
            ->whereHas('features', fn ($q) => $q->where('feature_key', $key)->where('feature_value', 'true'))
            ->orderBy('monthly_price')
            ->pluck('name')
            ->all();
    }

    /**
     * Refuses (403) a feature the organization's plan does not include, with a
     * message naming the formulas that do.
     */
    public function assertFeature(Organization $organization, string $key): void
    {
        if ($this->hasFeature($organization, $key)) {
            return;
        }

        $plans = $this->plansIncluding($key);

        abort(response()->json([
            'code' => 'feature_not_included',
            'feature' => $key,
            'message' => sprintf(
                '« %s » n\'est pas inclus dans votre formule.%s',
                PlanFeatures::label($key),
                $plans ? ' Disponible avec : '.implode(', ', $plans).'.' : '',
            ),
            'plans' => $plans,
        ], 403));
    }

    /** @return array<string, string> */
    private function planValues(Organization $organization): array
    {
        $subscription = $this->currentSubscriptionFor($organization);
        if (! $subscription) {
            return [];
        }

        return PlanFeature::query()
            ->where('plan_id', $subscription->plan_id)
            ->pluck('feature_value', 'feature_key')
            ->all();
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
