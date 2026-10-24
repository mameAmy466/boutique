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
 * Used by self-service signup and by the platform admin.
 */
class OrganizationProvisioner
{
    public const TRIAL_DAYS = 15;

    /**
     * @param  array{organization_name: string, name: string, email: string, password: string, phone?: ?string, shop_name: string, shop_code: string}  $data
     */
    public function create(array $data, Plan $plan, int $trialDays = self::TRIAL_DAYS): User
    {
        return DB::transaction(function () use ($data, $plan, $trialDays) {
            $organization = Organization::create([
                'name' => $data['organization_name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
            ]);

            Shop::create([
                'organization_id' => $organization->id,
                'name' => $data['shop_name'],
                'code' => $data['shop_code'],
            ]);

            Subscription::create([
                'organization_id' => $organization->id,
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_TRIAL,
                'trial_ends_at' => now()->addDays($trialDays)->toDateString(),
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
