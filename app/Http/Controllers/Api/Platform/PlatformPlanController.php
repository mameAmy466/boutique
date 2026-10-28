<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Support\PlanFeatures;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Prices and features of the Simple / Pro / Pro Max formulas, editable without a deploy. */
class PlatformPlanController extends Controller
{
    public function index()
    {
        $plans = Plan::query()->with('features')->withCount('subscriptions')->orderBy('monthly_price')->get()
            ->map(fn (Plan $plan) => [
                ...$plan->only(['id', 'code', 'name', 'is_active', 'subscriptions_count']),
                'monthly_price' => (float) $plan->monthly_price,
                'annual_price' => (float) $plan->annual_price,
                'features' => $plan->features->mapWithKeys(fn ($f) => [$f->feature_key => $f->feature_value]),
            ]);

        return response()->json([
            'plans' => $plans,
            'core' => PlanFeatures::CORE,
            'flags' => collect(PlanFeatures::FLAGS)->map(fn ($f) => ['label' => $f['label'], 'description' => $f['description']]),
            'limits' => PlanFeatures::LIMITS,
        ]);
    }

    public function update(Request $request, Plan $plan)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'monthly_price' => ['sometimes', 'numeric', 'min:0'],
            'annual_price' => ['sometimes', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'features' => ['sometimes', 'array'],
            'features.*' => ['nullable', 'string', 'max:50'],
        ]);

        foreach ($data['features'] ?? [] as $key => $value) {
            $valid = PlanFeatures::isFlag($key)
                ? in_array($value, ['true', 'false'], true)
                : array_key_exists($key, PlanFeatures::LIMITS) && preg_match('/^(\d+|unlimited)$/', (string) $value);

            if (! $valid) {
                throw ValidationException::withMessages([
                    "features.{$key}" => [PlanFeatures::isFlag($key) || array_key_exists($key, PlanFeatures::LIMITS)
                        ? 'Valeur attendue : un nombre, « unlimited », « true » ou « false ».'
                        : "Fonctionnalité inconnue : {$key}."],
                ]);
            }
        }

        DB::transaction(function () use ($plan, $data) {
            $plan->update(collect($data)->except('features')->all());

            foreach ($data['features'] ?? [] as $key => $value) {
                $plan->features()->updateOrCreate(['feature_key' => $key], ['feature_value' => $value]);
            }
        });

        PlatformAuditLog::record(null, 'plan_updated', "Formule « {$plan->name} » modifiée.", $data);

        return $this->index();
    }
}
