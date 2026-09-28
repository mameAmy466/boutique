<?php

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Database\Seeders\PlanSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * Two jobs, both guaranteed to run on any deploy that migrates (not only one
 * that also seeds — see 2026_09_22_160000_seed_default_accounting_chart for
 * why that distinction matters):
 *
 * 1. Seed the launch pricing grid (Simple/Pro/Pro Max), idempotently.
 * 2. Backfill any shop/user that predates the organizations/subscriptions
 *    layer into one default organization on an active Pro Max subscription
 *    — so an existing single-tenant deployment keeps every feature it had
 *    before this migration, with no new quota wall in its way. A brand new
 *    install has no such shops/users yet, so this step is a no-op for it;
 *    organizations for new clients are created through the (future) signup
 *    flow instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        (new PlanSeeder())->run();

        $needsBackfill = Shop::whereNull('organization_id')->exists()
            || User::whereNull('organization_id')->exists();

        if (! $needsBackfill) {
            return;
        }

        $organization = Organization::create([
            'name' => Shop::whereNull('organization_id')->value('name') ?? 'Organisation principale',
        ]);

        Shop::whereNull('organization_id')->update(['organization_id' => $organization->id]);
        User::whereNull('organization_id')->update(['organization_id' => $organization->id]);

        $proMaxId = Plan::where('code', Plan::CODE_PRO_MAX)->value('id');

        if ($proMaxId) {
            Subscription::firstOrCreate(
                ['organization_id' => $organization->id],
                [
                    'plan_id' => $proMaxId,
                    'status' => Subscription::STATUS_ACTIVE,
                    'billing_cycle' => 'monthly',
                    'current_period_start' => now()->toDateString(),
                    'current_period_end' => now()->addYear()->toDateString(),
                ]
            );
        }

        User::where('organization_id', $organization->id)
            ->whereHas('role', fn ($q) => $q->where('slug', Role::SUPER_ADMIN))
            ->update(['is_platform_admin' => true]);
    }

    public function down(): void
    {
        // Intentionally left as a no-op: rolling this back would delete real
        // organizations/subscriptions and strand every shop and user that
        // now depends on them (same reasoning as the accounting migration
        // this one follows the pattern of).
    }
};
