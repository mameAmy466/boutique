<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates a new client: its organization (with its own chart of accounts,
 * see Organization::booted), first shop, subscription and owner account.
 *
 * - register(): self-service signup. Nothing is usable until the platform
 *   admin approves it (organization inactive, request pending, subscription
 *   waiting for payment); the owner can log in to follow the request.
 * - create(): a client set up by the platform admin, active straight away
 *   on a trial.
 */
class OrganizationProvisioner
{
    public const TRIAL_DAYS = 15;

    /**
     * @param  array{organization_name: string, name: string, email: string, password: string, phone?: ?string, address?: ?string, shop_name: string, shop_code: string}  $data
     */
    public function register(array $data, Plan $plan): User
    {
        return $this->provision($data, $plan, [
            'status' => Organization::STATUS_INACTIVE,
            'registration_status' => Organization::REGISTRATION_PENDING,
        ], [
            'status' => Subscription::STATUS_PENDING_PAYMENT,
        ]);
    }

    /**
     * @param  array{organization_name: string, name: string, email: string, password: string, phone?: ?string, address?: ?string, shop_name: string, shop_code: string}  $data
     */
    public function create(array $data, Plan $plan, int $trialDays = self::TRIAL_DAYS): User
    {
        return $this->provision($data, $plan, [
            'status' => Organization::STATUS_ACTIVE,
            'registration_status' => Organization::REGISTRATION_APPROVED,
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
        ], [
            'status' => Subscription::STATUS_TRIAL,
            'trial_ends_at' => now()->addDays($trialDays)->toDateString(),
        ]);
    }

    private function provision(array $data, Plan $plan, array $organizationState, array $subscriptionState): User
    {
        return DB::transaction(function () use ($data, $plan, $organizationState, $subscriptionState) {
            $organization = Organization::create([
                'name' => $data['organization_name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                ...$organizationState,
            ]);

            Shop::create([
                'organization_id' => $organization->id,
                'name' => $data['shop_name'],
                'code' => $data['shop_code'],
                'address' => $data['address'] ?? null,
                'manager_name' => $data['name'],
                'phone' => $data['phone'] ?? null,
            ]);

            Subscription::create([
                'organization_id' => $organization->id,
                'plan_id' => $plan->id,
                ...$subscriptionState,
            ]);

            // The owner administers their own organization ("super_admin"
            // role), never the platform: is_platform_admin stays false.
            $ownerRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

            return User::create([
                'organization_id' => $organization->id,
                'shop_id' => null,
                'role_id' => $ownerRole->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'is_active' => true,
            ]);
        });
    }
}
