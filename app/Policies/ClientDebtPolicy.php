<?php

namespace App\Policies;

use App\Models\ClientDebt;
use App\Models\User;

class ClientDebtPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function view(User $user, ClientDebt $debt): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $debt->shop_id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function update(User $user, ClientDebt $debt): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $debt->shop_id);
    }

    public function delete(User $user, ClientDebt $debt): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $debt->shop_id);
    }

    public function addPayment(User $user, ClientDebt $debt): bool
    {
        return $this->update($user, $debt);
    }
}
