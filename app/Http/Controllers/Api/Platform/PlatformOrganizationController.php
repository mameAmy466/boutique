<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\OrganizationProvisioner;
use App\Services\SubscriptionService;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\PersonalAccessToken;

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
            $term = trim((string) $request->string('search'));
            $needle = '%'.$term.'%';
            $query->where(function ($q) use ($needle, $term) {
                // "#12" or "12" also finds the client by its identifier.
                if (ctype_digit(ltrim($term, '#'))) {
                    $q->orWhere('id', (int) ltrim($term, '#'));
                }
                $q->orWhere('name', 'like', $needle)
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

    /**
     * Aggregated activity of a client — figures only, never its individual
     * sales, customers or prices: enough to follow usage and spot an
     * inactive account without reading the client's business data.
     */
    public function activity(Organization $organization)
    {
        $figures = Tenant::as($organization->id, function () {
            $completed = fn () => Sale::query()->where('status', '!=', Sale::STATUS_CANCELLED);
            $since30 = now()->subDays(30)->startOfDay();

            $daily = $completed()->where('created_at', '>=', now()->subDays(13)->startOfDay())
                ->get(['total', 'created_at'])
                ->groupBy(fn (Sale $sale) => $sale->created_at->toDateString())
                ->map(fn ($sales) => (float) $sales->sum('total'));

            return [
                'sales' => [
                    'month_count' => $completed()->where('created_at', '>=', now()->startOfMonth())->count(),
                    'month_revenue' => (float) $completed()->where('created_at', '>=', now()->startOfMonth())->sum('total'),
                    'last_30_days_revenue' => (float) $completed()->where('created_at', '>=', $since30)->sum('total'),
                    'total_count' => $completed()->count(),
                    'total_revenue' => (float) $completed()->sum('total'),
                    'last_sale_at' => $completed()->max('created_at'),
                ],
                'trend' => collect(range(13, 0))->map(function ($daysAgo) use ($daily) {
                    $day = now()->subDays($daysAgo)->toDateString();

                    return ['date' => $day, 'revenue' => $daily[$day] ?? 0];
                })->values(),
                'usage' => [
                    'shops' => Shop::count(),
                    'users' => User::where('organization_id', Tenant::id())->count(),
                    'registers' => CashRegister::count(),
                    'products' => Product::count(),
                    'customers' => Customer::count(),
                ],
            ];
        });

        $userIds = User::where('organization_id', $organization->id)->pluck('id');
        $lastSeen = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->whereIn('tokenable_id', $userIds)
            ->max('last_used_at');

        return response()->json([
            ...$figures,
            'limits' => $this->subscriptions->limits($organization),
            'last_seen_at' => $lastSeen,
            'active_users_7_days' => PersonalAccessToken::query()
                ->where('tokenable_type', User::class)
                ->whereIn('tokenable_id', $userIds)
                ->where('last_used_at', '>=', now()->subDays(7))
                ->distinct()
                ->count('tokenable_id'),
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
        abort_if(
            $organization->status === Organization::STATUS_INACTIVE,
            422,
            "Cette boutique n'a pas encore été activée : acceptez sa demande d'inscription.",
        );

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

    /** Signup requests: pending and waiting for information first, then the decided ones. */
    public function registrations(Request $request)
    {
        $status = $request->string('status')->toString() ?: 'open';

        $query = Organization::query()
            ->withCount(['shops' => fn ($q) => $q->withoutGlobalScope('organization'), 'users'])
            ->latest('id');

        match ($status) {
            'open' => $query->whereIn('registration_status', [Organization::REGISTRATION_PENDING, Organization::REGISTRATION_INFO_REQUESTED]),
            // Accepted but not usable yet: waiting for the first payment.
            'awaiting_activation' => $query->where('registration_status', Organization::REGISTRATION_APPROVED)
                ->where('status', Organization::STATUS_INACTIVE),
            'all' => $query->whereNotNull('registration_status'),
            default => $query->where('registration_status', $status),
        };

        return response()->json($query->limit(200)->get()->map(fn (Organization $o) => $this->summary($o)));
    }

    /**
     * Accepts a signup, with one of three activations:
     * - trial: usable at once for trial_days;
     * - paid: records the first payment, usable at once;
     * - pending_payment: accepted but still inactive until a payment is recorded.
     * Also activates an accepted shop that was waiting for its payment.
     */
    public function approve(Request $request, Organization $organization)
    {
        $data = $request->validate([
            'activation' => ['required', Rule::in(['trial', 'paid', 'pending_payment'])],
            'plan_code' => ['nullable', Rule::exists('plans', 'code')],
            'trial_days' => ['required_if:activation,trial', 'nullable', 'integer', 'min:1', 'max:365'],
            'amount' => ['required_if:activation,paid', 'nullable', 'numeric', 'min:0'],
            'method' => ['required_if:activation,paid', 'nullable', Rule::in(SubscriptionPayment::METHODS)],
            'months' => ['required_if:activation,paid', 'nullable', 'integer', 'min:1', 'max:36'],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        abort_if(
            in_array($organization->status, [Organization::STATUS_SUSPENDED, Organization::STATUS_CLOSED], true),
            422,
            'Cette boutique est suspendue ou fermée : utilisez Réactiver.',
        );

        DB::transaction(function () use ($request, $organization, $data) {
            $subscription = $this->subscriptions->currentSubscriptionFor($organization)
                ?? new Subscription(['organization_id' => $organization->id]);

            if (isset($data['plan_code'])) {
                $subscription->plan_id = Plan::where('code', $data['plan_code'])->value('id');
            }
            abort_unless($subscription->plan_id, 422, 'Choisis une formule.');
            $subscription->save();

            $planName = $subscription->plan()->value('name');
            $this->markApproved($request, $organization, $data['note'] ?? null);
            PlatformAuditLog::record($organization, 'registration_approved', "Inscription acceptée (formule {$planName}).");

            if ($data['activation'] === 'trial') {
                $subscription->fill([
                    'status' => Subscription::STATUS_TRIAL,
                    'trial_ends_at' => now()->addDays($data['trial_days'])->toDateString(),
                    'current_period_end' => null,
                ])->save();
                $organization->update(['status' => Organization::STATUS_ACTIVE]);
                PlatformAuditLog::record($organization, 'organization_activated', "Boutique activée avec {$data['trial_days']} jours d'essai.");
            } elseif ($data['activation'] === 'paid') {
                $this->applyPayment($request, $organization, [...$data, 'plan_code' => $data['plan_code'] ?? null]);
            } else {
                $subscription->update(['status' => Subscription::STATUS_PENDING_PAYMENT]);
            }
        });

        return $this->show($organization->fresh());
    }

    public function reject(Request $request, Organization $organization)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $this->guardNotOwnOrganization($request, $organization);

        // The request and its data are kept: it can still be accepted later.
        $organization->update([
            'status' => Organization::STATUS_INACTIVE,
            'registration_status' => Organization::REGISTRATION_REJECTED,
            'registration_note' => $data['reason'] ?? null,
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
        ]);
        PlatformAuditLog::record($organization, 'registration_rejected', 'Inscription refusée'.(
            isset($data['reason']) ? ' : '.$data['reason'] : '.'
        ));

        return $this->show($organization);
    }

    public function requestInfo(Request $request, Organization $organization)
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:1000']], [
            'message.required' => 'Précise les informations demandées.',
        ]);

        abort_unless($organization->isAwaitingReview(), 422, "Cette demande d'inscription a déjà été traitée.");

        $organization->update([
            'registration_status' => Organization::REGISTRATION_INFO_REQUESTED,
            'registration_note' => $data['message'],
        ]);
        PlatformAuditLog::record($organization, 'registration_info_requested', 'Informations demandées : '.$data['message']);

        return $this->show($organization);
    }

    private function markApproved(Request $request, Organization $organization, ?string $note = null): void
    {
        if ($organization->registration_status === Organization::REGISTRATION_APPROVED) {
            return;
        }

        $organization->update([
            'registration_status' => Organization::REGISTRATION_APPROVED,
            'registration_note' => $note,
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
        ]);
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

        $this->applyPayment($request, $organization, $data);

        return $this->show($organization->fresh())->setStatusCode(201);
    }

    /** @return SubscriptionPayment */
    private function applyPayment(Request $request, Organization $organization, array $data): SubscriptionPayment
    {
        return DB::transaction(function () use ($request, $organization, $data) {
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

            // A first payment from a shop that signed up opens it: being
            // paid means the request is accepted.
            if ($organization->status === Organization::STATUS_INACTIVE) {
                $this->markApproved($request, $organization);
                $organization->update(['status' => Organization::STATUS_ACTIVE]);
                PlatformAuditLog::record($organization, 'organization_activated', 'Boutique activée après paiement.');
            }

            return $payment;
        });
    }

    private function summary(Organization $organization): array
    {
        $subscription = $this->subscriptions->currentSubscriptionFor($organization);
        if ($subscription) {
            // Show the state the dates imply, even before tonight's check runs.
            $this->subscriptions->refreshStatus($subscription)->loadMissing('plan');
        }
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
            'registration_status' => $organization->registration_status,
            'registration_note' => $organization->registration_note,
            'reviewed_at' => $organization->reviewed_at,
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
