<?php

namespace App\Policies;

use App\Models\CashSession;
use App\Models\User;

class CashSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, CashSession $session): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $session->cashRegister->shop_id;
    }

    public function open(User $user): bool
    {
        return $user->isCashier() || $user->isShopAdmin() || $user->isSuperAdmin();
    }

    public function close(User $user, CashSession $session): bool
    {
        return $user->isSuperAdmin()
            || $session->user_id === $user->id
            || ($user->isShopAdmin() && $user->shop_id === $session->cashRegister->shop_id);
    }
}
