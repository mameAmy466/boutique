<?php

use App\Models\Plan;
use App\Support\PlanFeatures;
use Illuminate\Database\Migrations\Migration;

/**
 * Every module that can be switched on per plan (App\Support\PlanFeatures)
 * gets a value on every plan. New switches take their default; the grid
 * agreed for launch also moves the accounting and financial reports to
 * Pro Max only. Everything stays editable from the Super Admin.
 */
return new class extends Migration
{
    private const PLAN_ORDER = [Plan::CODE_SIMPLE, Plan::CODE_PRO, Plan::CODE_PRO_MAX];

    public function up(): void
    {
        foreach (self::PLAN_ORDER as $index => $code) {
            $plan = Plan::where('code', $code)->first();
            if (! $plan) {
                continue;
            }

            foreach (PlanFeatures::FLAGS as $key => $definition) {
                $plan->features()->firstOrCreate(
                    ['feature_key' => $key],
                    ['feature_value' => $definition['defaults'][$index] ? 'true' : 'false'],
                );
            }

            $plan->features()->where('feature_key', 'advanced_reports_enabled')
                ->update(['feature_value' => PlanFeatures::FLAGS['advanced_reports_enabled']['defaults'][$index] ? 'true' : 'false']);
        }
    }

    public function down(): void
    {
        // Leaves the values in place: they are harmless without the code
        // that reads them, and may have been edited since.
    }
};
