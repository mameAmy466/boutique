<?php

use App\Models\Plan;
use Illuminate\Database\Migrations\Migration;

/**
 * PlanSeeder uses firstOrCreate, so editing its price/quota constants alone
 * never touches a Plan/PlanFeature row that a previous migrate already
 * created — same reasoning as 2026_09_28_100006. This applies the new
 * launch pricing (Simple 5 000, Pro 15 000 with 5 boutiques included, Pro
 * Max 30 000 with 10 boutiques included) to whatever is already in the
 * database, keyed by plan code so it's safe to run whether the plan
 * predates this change or was just seeded with the new values already.
 */
return new class extends Migration
{
    private const UPDATES = [
        Plan::CODE_SIMPLE => ['monthly_price' => 5000, 'annual_price' => 50000, 'max_shops' => '1'],
        Plan::CODE_PRO => ['monthly_price' => 15000, 'annual_price' => 150000, 'max_shops' => '5'],
        Plan::CODE_PRO_MAX => ['monthly_price' => 30000, 'annual_price' => 300000, 'max_shops' => '10'],
    ];

    public function up(): void
    {
        foreach (self::UPDATES as $code => $values) {
            $plan = Plan::where('code', $code)->first();
            if (! $plan) {
                continue;
            }

            $plan->update([
                'monthly_price' => $values['monthly_price'],
                'annual_price' => $values['annual_price'],
            ]);

            $plan->features()->updateOrCreate(
                ['feature_key' => 'max_shops'],
                ['feature_value' => $values['max_shops']],
            );
        }
    }

    public function down(): void
    {
        // Intentionally left as a no-op: pricing is business data, not
        // schema — a rollback shouldn't silently revert a live price change.
    }
};
