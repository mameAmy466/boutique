<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function view(User $user, User $target): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $target->shop_id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function update(User $user, User $target): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        // A shop admin may only manage cashiers within their own shop.
        return $user->isShopAdmin()
            && $target->shop_id === $user->shop_id
            && $target->hasRole(Role::CAISSIER);
    }

    public function delete(User $user, User $target): bool
    {
        return $this->update($user, $target);
    }
}
