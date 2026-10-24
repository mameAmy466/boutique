<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\OrganizationProvisioner;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The platform operator's view of every client. Shops are read without the
 * tenant scope on purpose: this space sees all organizations.
 */
class PlatformOrganizationController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    public function index(Request $request)
    {
        $query = Organization::query()
            ->withCount([
                'shops' => fn ($q) => $q->withoutGlobalScope('organization'),
                'users',
            ])
            ->orderBy('name');

        if ($request->filled('search')) {
            $needle = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($needle) {
                $q->where('name', 'like', $needle)
                    ->orWhere('email', 'like', $needle)
                    ->orWhere('phone', 'like', $needle)
                    ->orWhereHas('users', fn ($u) => $u->where('name', 'like', $needle)->orWhere('email', 'like', $needle));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $organizations = $query->get()->map(fn (Organization $organization) => $this->summary($organization));

        if ($request->filled('plan')) {
            $organizations = $organizations->where('subscription.plan.code', $request->string('plan'))->values();
        }

        if ($request->filled('subscription_status')) {
            $organizations = $organizations->where('subscription.status', $request->string('subscription_status'))->values();
        }

        return response()->json($organizations);
    }

    public function show(Organization $organization)
    {
        $organization->loadCount(['shops' => fn ($q) => $q->withoutGlobalScope('organization'), 'users']);

        return response()->json([
            ...$this->summary($organization),
            'shops' => Shop::withoutGlobalScope('organization')->where('organization_id', $organization->id)
                ->orderBy('name')->get(['id', 'name', 'code', 'status', 'phone', 'address']),
            'users' => $organization->users()->with('role:id,slug,name')->orderBy('name')
                ->get(['id', 'name', 'email', 'role_id', 'shop_id', 'is_active']),
            'payments' => $organization->payments()->with('recorder:id,name')->latest('paid_at')->latest('id')->get(),
            'audit_logs' => $organization->auditLogs()->with('user:id,name')->latest('id')->limit(50)->get(),
        ]);
    }

    /** Creates a client by hand (e.g. after a phone sale), exactly like self-service signup. */
    public function store(Request $request, OrganizationProvisioner $provisioner)
    {
        $data = $request->validate([
            'organization_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:50'],
            'shop_name' => ['required', 'string', 'max:255'],
            'shop_code' => ['required', 'string', 'max:50', 'unique:shops,code'],
            'plan_code' => ['required', Rule::exists('plans', 'code')],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        $plan = Plan::where('code', $data['plan_code'])->firstOrFail();
        $owner = $provisioner->create($data, $plan, $data['trial_days'] ?? OrganizationProvisioner::TRIAL_DAYS);
        $organization = $owner->organization;

        PlatformAuditLog::record($organization, 'organization_created', "Client créé par l'administration (formule {$plan->name}).");

        return $this->show($organization)->setStatusCode(201);
    }

    public function update(Request $request, Organization $organization)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        $organization->update($data);
        PlatformAuditLog::record($organization, 'organization_updated', 'Informations du client modifiées.', $data);

        return $this->show($organization);
    }

    public function suspend(Request $request, Organization $organization)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        $this->guardNotOwnOrganization($request, $organization);

        $organization->update([
            'status' => Organization::STATUS_SUSPENDED,
            'suspended_at' => now(),
            'suspension_reason' => $data['reason'] ?? null,
        ]);
        PlatformAuditLog::record($organization, 'organization_suspended', 'Accès suspendu'.(
            isset($data['reason']) ? ' : '.$data['reason'] : '.'
        ));

        return $this->show($organization);
    }

    public function reactivate(Organization $organization)
    {
        $organization->update([
            'status' => Organization::STATUS_ACTIVE,
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);
        PlatformAuditLog::record($organization, 'organization_reactivated', 'Accès réactivé.');

        return $this->show($organization);
    }

    public function close(Request $request, Organization $organization)
    {
        $this->guardNotOwnOrganization($request, $organization);

        $organization->update(['status' => Organization::STATUS_CLOSED, 'suspended_at' => now()]);
        PlatformAuditLog::record($organization, 'organization_closed', 'Compte fermé.');

        return $this->show($organization);
    }

    /**
     * Permanently deletes a client and all its data. Only a closed account can
     * be deleted, and the exact name must be typed again to confirm.
     */
    public function destroy(Request $request, Organization $organization)
    {
        $this->guardNotOwnOrganization($request, $organization);

        $request->validate(['confirm_name' => ['required', 'string', Rule::in([$organization->name])]], [
            'confirm_name.in' => 'Le nom saisi ne correspond pas.',
        ]);

        abort_unless(
            $organization->status === Organization::STATUS_CLOSED,
            422,
            "Fermez d'abord le compte avant de le supprimer définitivement.",
        );

        PlatformAuditLog::record(null, 'organization_deleted', "Client « {$organization->name} » (#{$organization->id}) supprimé définitivement.");

        DB::transaction(function () use ($organization) {
            // Users are only detached when their organization goes (nullOnDelete):
            // remember them, let the organization's data cascade away, then
            // remove the accounts too.
            $userIds = User::where('organization_id', $organization->id)->pluck('id');
            $organization->delete();
            User::whereIn('id', $userIds)->each(function (User $user) {
                $user->tokens()->delete();
                $user->delete();
            });
        });

        return response()->noContent();
    }

    public function updateSubscription(Request $request, Organization $organization)
    {
        $data = $request->validate([
            'plan_code' => ['sometimes', Rule::exists('plans', 'code')],
            'status' => ['sometimes', Rule::in(Subscription::STATUSES)],
            'billing_cycle' => ['sometimes', 'nullable', Rule::in(['monthly', 'annual'])],
            'trial_ends_at' => ['sometimes', 'nullable', 'date'],
            'current_period_start' => ['sometimes', 'nullable', 'date'],
            'current_period_end' => ['sometimes', 'nullable', 'date'],
            'grace_days' => ['sometimes', 'integer', 'min:0', 'max:90'],
            'extra_shops' => ['sometimes', 'integer', 'min:0'],
            'extra_users' => ['sometimes', 'integer', 'min:0'],
            'extra_registers' => ['sometimes', 'integer', 'min:0'],
        ]);

        $subscription = $this->subscriptions->currentSubscriptionFor($organization)
            ?? new Subscription(['organization_id' => $organization->id, 'status' => Subscription::STATUS_TRIAL]);

        if (isset($data['plan_code'])) {
            $data['plan_id'] = Plan::where('code', $data['plan_code'])->value('id');
            unset($data['plan_code']);
        }

        abort_if(! $subscription->exists && ! isset($data['plan_id']), 422, 'Choisis une formule.');

        $before = $subscription->exists ? $subscription->only(array_keys($data)) : [];
        $subscription->fill($data)->save();

        PlatformAuditLog::record($organization, 'subscription_updated', 'Abonnement modifié.', [
            'avant' => $before,
            'après' => $subscription->only(array_keys($data)),
        ]);

        return $this->show($organization);
    }

    /**
     * Records a payment and extends the paid period by the number of months
     * paid, starting from the current end date when it is still running,
     * from today otherwise.
     */
    public function recordPayment(Request $request, Organization $organization)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'method' => ['required', Rule::in(SubscriptionPayment::METHODS)],
            'reference' => ['nullable', 'string', 'max:255'],
            'months' => ['required', 'integer', 'min:1', 'max:36'],
            'paid_at' => ['nullable', 'date'],
            'plan_code' => ['nullable', Rule::exists('plans', 'code')],
            'note' => ['nullable', 'string', 'max:1000'],
            'reactivate' => ['nullable', 'boolean'],
        ]);

        $payment = DB::transaction(function () use ($request, $organization, $data) {
            $subscription = $this->subscriptions->currentSubscriptionFor($organization);
            $planId = isset($data['plan_code'])
                ? Plan::where('code', $data['plan_code'])->value('id')
                : $subscription?->plan_id;

            abort_unless($planId, 422, 'Choisis une formule.');

            $today = now()->startOfDay();
            $runningEnd = $subscription?->status === Subscription::STATUS_ACTIVE ? $subscription->current_period_end : null;
            $start = $runningEnd && $runningEnd->gte($today) ? $runningEnd->copy()->addDay() : $today;
            $end = $start->copy()->addMonthsNoOverflow($data['months'])->subDay();

            $subscription ??= new Subscription(['organization_id' => $organization->id]);
            $subscription->fill([
                'plan_id' => $planId,
                'status' => Subscription::STATUS_ACTIVE,
                'billing_cycle' => $data['months'] >= 12 ? 'annual' : 'monthly',
                'current_period_start' => $subscription->status === Subscription::STATUS_ACTIVE && $subscription->current_period_start
                    ? $subscription->current_period_start : $start,
                'current_period_end' => $end,
            ])->save();

            $payment = SubscriptionPayment::create([
                'organization_id' => $organization->id,
                'subscription_id' => $subscription->id,
                'plan_id' => $planId,
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'months' => $data['months'],
                'paid_at' => isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : $today,
                'period_start' => $start,
                'period_end' => $end,
                'note' => $data['note'] ?? null,
                'recorded_by' => $request->user()->id,
            ]);

            PlatformAuditLog::record($organization, 'payment_recorded', sprintf(
                'Paiement de %s FCFA enregistré (%d mois, jusqu\'au %s).',
                number_format((float) $data['amount'], 0, ',', ' '),
                $data['months'],
                $end->format('d/m/Y'),
            ));

            if (($data['reactivate'] ?? true) && $organization->status === Organization::STATUS_SUSPENDED) {
                $organization->update(['status' => Organization::STATUS_ACTIVE, 'suspended_at' => null, 'suspension_reason' => null]);
                PlatformAuditLog::record($organization, 'organization_reactivated', 'Accès réactivé après paiement.');
            }

            return $payment;
        });

        return $this->show($organization->fresh())->setStatusCode(201);
    }

    private function summary(Organization $organization): array
    {
        $subscription = $this->subscriptions->currentSubscriptionFor($organization);
        $subscription?->loadMissing('plan');
        $owner = $organization->users()
            ->whereHas('role', fn ($q) => $q->where('slug', Role::SUPER_ADMIN))
            ->orderBy('id')->first(['id', 'name', 'email']);
        $lastPayment = $organization->payments()->latest('paid_at')->latest('id')->first();
        $endsAt = $subscription?->endsAt() ?? $subscription?->current_period_end;

        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'email' => $organization->email,
            'phone' => $organization->phone,
            'status' => $organization->status,
            'suspended_at' => $organization->suspended_at,
            'suspension_reason' => $organization->suspension_reason,
            'created_at' => $organization->created_at,
            'owner' => $owner,
            'shops_count' => $organization->shops_count,
            'users_count' => $organization->users_count,
            'subscription' => $subscription ? [
                'status' => $subscription->status,
                'plan' => $subscription->plan?->only(['code', 'name', 'monthly_price', 'annual_price']),
                'billing_cycle' => $subscription->billing_cycle,
                'trial_ends_at' => $subscription->trial_ends_at?->toDateString(),
                'current_period_start' => $subscription->current_period_start?->toDateString(),
                'current_period_end' => $subscription->current_period_end?->toDateString(),
                'ends_at' => $endsAt?->toDateString(),
                'grace_days' => $subscription->grace_days,
                'extra_shops' => $subscription->extra_shops,
                'extra_users' => $subscription->extra_users,
                'extra_registers' => $subscription->extra_registers,
                'amount_due' => $subscription->plan
                    ? (float) ($subscription->billing_cycle === 'annual' ? $subscription->plan->annual_price : $subscription->plan->monthly_price)
                    : null,
            ] : null,
            'last_payment' => $lastPayment?->only(['amount', 'paid_at', 'method']),
            'is_platform_owner' => $organization->users()->where('is_platform_admin', true)->exists(),
        ];
    }

    /** The operator cannot lock themselves out of the platform. */
    private function guardNotOwnOrganization(Request $request, Organization $organization): void
    {
        abort_if(
            $request->user()->organization_id === $organization->id,
            422,
            'Impossible de suspendre, fermer ou supprimer votre propre organisation.',
        );
    }
}
