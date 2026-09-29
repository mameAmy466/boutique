<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;

/**
 * Public (no auth) — feeds the pricing/presentation page, so the launch
 * grid it displays always matches whatever PlanSeeder / the plans table
 * currently holds, instead of a second hardcoded copy on the frontend.
 */
class PlanController extends Controller
{
    public function index()
    {
        $plans = Plan::query()
            ->with('features')
            ->where('is_active', true)
            ->orderBy('monthly_price')
            ->get()
            ->map(fn (Plan $plan) => [
                'code' => $plan->code,
                'name' => $plan->name,
                'monthly_price' => (float) $plan->monthly_price,
                'annual_price' => (float) $plan->annual_price,
                'features' => $plan->features->mapWithKeys(fn ($f) => [$f->feature_key => $f->feature_value]),
            ]);

        return response()->json($plans);
    }
}
