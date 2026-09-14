<?php

namespace App\Policies;

use App\Models\ProductBatch;
use App\Models\User;

class ProductBatchPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, ProductBatch $batch): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $batch->shop_id;
    }

    /**
     * Receiving stock (entries) and manual adjustments are reserved to
     * shop admins and the super admin — a cashier must never be able to
     * alter stock by hand.
     */
    public function create(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function adjust(User $user, ProductBatch $batch): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $batch->shop_id);
    }

    /**
     * Correcting the purchase price / minimum price of a batch is the same
     * trust level as receiving or adjusting stock.
     */
    public function update(User $user, ProductBatch $batch): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $batch->shop_id);
    }

    public function delete(User $user, ProductBatch $batch): bool
    {
        return $user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $batch->shop_id);
    }
}
