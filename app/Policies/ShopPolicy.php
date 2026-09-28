<?php

namespace App\Policies;

use App\Models\Shop;
use App\Models\User;

class ShopPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Shop $shop): bool
    {
        return $this->ownsShop($user, $shop) || $user->shop_id === $shop->id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, Shop $shop): bool
    {
        return $this->ownsShop($user, $shop);
    }

    public function delete(User $user, Shop $shop): bool
    {
        return $this->ownsShop($user, $shop);
    }

    /**
     * A super admin only manages the shops of their own organization — never
     * another client's, even by guessing an id. See SubscriptionService for
     * the quota this pairs with on shop creation.
     */
    private function ownsShop(User $user, Shop $shop): bool
    {
        return $user->isSuperAdmin() && $user->organization_id === $shop->organization_id;
    }
}
