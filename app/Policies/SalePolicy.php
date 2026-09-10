<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;

class SalePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Sale $sale): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $sale->shop_id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin() || $user->isCashier();
    }

    /**
     * A cashier must never be able to cancel a validated sale — only a
     * shop admin (for their own shop) or the super admin can.
     */
    public function cancel(User $user, Sale $sale): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $sale->shop_id);
    }
}
