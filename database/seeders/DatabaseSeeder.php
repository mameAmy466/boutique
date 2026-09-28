<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);
        $this->call(AccountingSeeder::class);
        $this->call(PlanSeeder::class);

        $organization = Organization::firstOrCreate(
            ['name' => 'Organisation principale'],
            [],
        );

        Subscription::firstOrCreate(
            ['organization_id' => $organization->id],
            [
                'plan_id' => Plan::where('code', Plan::CODE_PRO_MAX)->value('id'),
                'status' => Subscription::STATUS_ACTIVE,
                'billing_cycle' => 'monthly',
                'current_period_start' => now()->toDateString(),
                'current_period_end' => now()->addYear()->toDateString(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'admin@boutique.test'],
            [
                'name' => 'Administrateur Général',
                'password' => 'password',
                'role_id' => Role::where('slug', Role::SUPER_ADMIN)->value('id'),
                'organization_id' => $organization->id,
                'is_platform_admin' => true,
                'is_active' => true,
            ]
        );
    }
}
