<?php

namespace App\Policies;

use App\Models\PurchaseOrder;
use App\Models\User;

/**
 * Purchasing (creating orders, receiving them, cancelling them) is the same
 * trust level as receiving stock directly (ProductBatchPolicy): reserved to
 * shop admins and the super admin, never a cashier.
 */
class PurchaseOrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function view(User $user, PurchaseOrder $order): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $order->shop_id);
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function receive(User $user, PurchaseOrder $order): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $order->shop_id);
    }

    public function cancel(User $user, PurchaseOrder $order): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $order->shop_id);
    }
}
