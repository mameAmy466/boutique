<?php

namespace Database\Seeders;

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
        $this->call(PlanSeeder::class);

        // The platform admin runs the SaaS: no organization, no shop, no
        // subscription. Client organizations come from signups.
        User::firstOrCreate(
            ['email' => 'admin@boutique.test'],
            [
                'name' => 'Administrateur Général',
                'password' => 'password',
                'role_id' => null,
                'organization_id' => null,
                'is_platform_admin' => true,
                'is_active' => true,
            ]
        );
    }
}
