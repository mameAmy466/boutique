<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Prices and features of the Simple / Pro / Pro Max formulas, editable without a deploy. */
class PlatformPlanController extends Controller
{
    /** Labels of the known feature keys, so the interface can show them in French. */
    public const FEATURES = [
        'max_shops' => ['label' => 'Boutiques', 'type' => 'limit'],
        'max_users' => ['label' => 'Utilisateurs', 'type' => 'limit'],
        'max_registers' => ['label' => 'Caisses', 'type' => 'limit'],
        'max_products' => ['label' => 'Produits', 'type' => 'limit'],
        'budget_enabled' => ['label' => 'Budget et dépenses par catégorie', 'type' => 'flag'],
        'multi_shop_dashboard' => ['label' => 'Tableau de bord multi-boutiques', 'type' => 'flag'],
        'advanced_reports_enabled' => ['label' => 'Rapports avancés', 'type' => 'flag'],
        'risk_analysis_advanced' => ['label' => 'Analyse de risque avancée', 'type' => 'flag'],
        'excel_export' => ['label' => 'Export Excel', 'type' => 'flag'],
        'transfers_enabled' => ['label' => 'Transferts entre boutiques', 'type' => 'flag'],
    ];

    public function index()
    {
        $plans = Plan::query()->with('features')->withCount('subscriptions')->orderBy('monthly_price')->get()
            ->map(fn (Plan $plan) => [
                ...$plan->only(['id', 'code', 'name', 'is_active', 'subscriptions_count']),
                'monthly_price' => (float) $plan->monthly_price,
                'annual_price' => (float) $plan->annual_price,
                'features' => $plan->features->mapWithKeys(fn ($f) => [$f->feature_key => $f->feature_value]),
            ]);

        return response()->json(['plans' => $plans, 'feature_definitions' => self::FEATURES]);
    }

    public function update(Request $request, Plan $plan)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'monthly_price' => ['sometimes', 'numeric', 'min:0'],
            'annual_price' => ['sometimes', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'features' => ['sometimes', 'array'],
            'features.*' => ['nullable', 'string', 'max:50', 'regex:/^(\d+|unlimited|true|false)$/'],
        ], [
            'features.*.regex' => 'Valeur attendue : un nombre, « unlimited », « true » ou « false ».',
        ]);

        DB::transaction(function () use ($plan, $data) {
            $plan->update(collect($data)->except('features')->all());

            foreach ($data['features'] ?? [] as $key => $value) {
                $plan->features()->updateOrCreate(['feature_key' => $key], ['feature_value' => $value ?? 'false']);
            }
        });

        PlatformAuditLog::record(null, 'plan_updated', "Formule « {$plan->name} » modifiée.", $data);

        return $this->index();
    }
}
