<?php

namespace App\Policies;

use App\Models\BankStatementLine;
use App\Models\User;

class BankStatementLinePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function match(User $user, BankStatementLine $line): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $line->shop_id);
    }

    public function delete(User $user, BankStatementLine $line): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $line->shop_id);
    }
}
