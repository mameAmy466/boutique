<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;

class ExpensePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function view(User $user, Expense $expense): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $expense->shop_id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function update(User $user, Expense $expense): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $expense->shop_id);
    }

    public function delete(User $user, Expense $expense): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $expense->shop_id);
    }
}
