<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Administrateur général', 'slug' => Role::SUPER_ADMIN],
            ['name' => 'Administrateur de boutique', 'slug' => Role::ADMIN_BOUTIQUE],
            ['name' => 'Caissier / Vendeur', 'slug' => Role::CAISSIER],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['slug' => $role['slug']], $role);
        }
    }
}
