<?php

namespace Tests;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Most feature tests exercise a single, generously-provisioned tenant
     * and don't care about SaaS quotas — that's what SubscriptionEngineTest
     * is for. An active Pro Max subscription keeps every existing feature
     * test's shop/user/register/expense creation unblocked by default.
     */
    protected function createOrganization(string $planCode = Plan::CODE_PRO_MAX): Organization
    {
        $organization = Organization::create(['name' => 'Organisation Test']);

        Subscription::create([
            'organization_id' => $organization->id,
            'plan_id' => Plan::where('code', $planCode)->value('id'),
            'status' => Subscription::STATUS_ACTIVE,
            'billing_cycle' => 'monthly',
            'current_period_start' => now()->toDateString(),
            'current_period_end' => now()->addYear()->toDateString(),
        ]);

        return $organization;
    }
}
