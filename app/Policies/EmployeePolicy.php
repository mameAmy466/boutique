<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;

class EmployeePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function view(User $user, Employee $employee): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $employee->shop_id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function update(User $user, Employee $employee): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $employee->shop_id);
    }

    public function delete(User $user, Employee $employee): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $employee->shop_id);
    }
}
