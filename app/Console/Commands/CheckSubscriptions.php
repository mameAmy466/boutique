<?php

namespace App\Console\Commands;

use App\Models\PlatformAuditLog;
use App\Models\Subscription;
use App\Services\SubscriptionService;
use Illuminate\Console\Command;

/** Daily: moves subscriptions whose trial or paid period has ended to past_due, then expired. */
class CheckSubscriptions extends Command
{
    protected $signature = 'subscriptions:check';

    protected $description = 'Met à jour le statut des abonnements arrivés à échéance';

    public function handle(SubscriptionService $subscriptions): int
    {
        $changed = 0;

        Subscription::query()
            ->with('organization')
            ->whereIn('status', [Subscription::STATUS_TRIAL, Subscription::STATUS_ACTIVE, Subscription::STATUS_PAST_DUE])
            ->each(function (Subscription $subscription) use ($subscriptions, &$changed) {
                $before = $subscription->status;
                $subscriptions->refreshStatus($subscription);

                if ($subscription->status !== $before) {
                    $changed++;
                    PlatformAuditLog::record(
                        $subscription->organization,
                        'subscription_'.$subscription->status,
                        "Abonnement passé de « {$before} » à « {$subscription->status} » (échéance atteinte).",
                    );
                }
            });

        $this->info("{$changed} abonnement(s) mis à jour.");

        return self::SUCCESS;
    }
}
