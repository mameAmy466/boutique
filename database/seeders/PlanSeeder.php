<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Seeds the launch pricing grid from the commercial proposal: Simple, Pro
 * and Pro Max, each with its quotas and feature flags. Quotas are stored as
 * numeric strings; 'unlimited' means no cap. This is a starting grid meant
 * to be tuned from a future admin UI, not a hardcoded law — see
 * SubscriptionService for how these values are read.
 */
class PlanSeeder extends Seeder
{
    private const PLANS = [
        [
            'code' => Plan::CODE_SIMPLE,
            'name' => 'Simple',
            'monthly_price' => 10000,
            'annual_price' => 100000,
            'features' => [
                'max_shops' => '1',
                'max_users' => '2',
                'max_registers' => '1',
                'max_products' => '500',
                'budget_enabled' => 'false',
                'multi_shop_dashboard' => 'false',
                'advanced_reports_enabled' => 'false',
                'risk_analysis_advanced' => 'false',
                'excel_export' => 'false',
                'transfers_enabled' => 'false',
            ],
        ],
        [
            'code' => Plan::CODE_PRO,
            'name' => 'Pro',
            'monthly_price' => 25000,
            'annual_price' => 250000,
            'features' => [
                'max_shops' => '1',
                'max_users' => '10',
                'max_registers' => '3',
                'max_products' => '5000',
                'budget_enabled' => 'true',
                'multi_shop_dashboard' => 'false',
                'advanced_reports_enabled' => 'true',
                'risk_analysis_advanced' => 'true',
                'excel_export' => 'true',
                'transfers_enabled' => 'false',
            ],
        ],
        [
            'code' => Plan::CODE_PRO_MAX,
            'name' => 'Pro Max',
            'monthly_price' => 50000,
            'annual_price' => 500000,
            'features' => [
                'max_shops' => '5',
                'max_users' => '30',
                'max_registers' => '10',
                'max_products' => 'unlimited',
                'budget_enabled' => 'true',
                'multi_shop_dashboard' => 'true',
                'advanced_reports_enabled' => 'true',
                'risk_analysis_advanced' => 'true',
                'excel_export' => 'true',
                'transfers_enabled' => 'true',
            ],
        ],
    ];

    public function run(): void
    {
        foreach (self::PLANS as $planData) {
            $features = $planData['features'];
            unset($planData['features']);

            $plan = Plan::firstOrCreate(['code' => $planData['code']], $planData);

            foreach ($features as $key => $value) {
                $plan->features()->firstOrCreate(['feature_key' => $key], ['feature_value' => $value]);
            }
        }
    }
}
