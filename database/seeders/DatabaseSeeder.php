<?php

namespace Database\Seeders;

use App\Models\Role;
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

        User::firstOrCreate(
            ['email' => 'admin@boutique.test'],
            [
                'name' => 'Administrateur Général',
                'password' => 'password',
                'role_id' => Role::where('slug', Role::SUPER_ADMIN)->value('id'),
                'is_active' => true,
            ]
        );
    }
}
