<?php

namespace App\Policies;

use App\Models\Account;
use App\Models\User;

/**
 * The plan comptable is shared, global configuration — only the super_admin
 * manages it, never a shop admin. A shop admin may still read journal
 * entries for their own shop (see JournalEntryPolicy), just not reshape the
 * chart of accounts everyone's entries are posted against.
 */
class AccountPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function view(User $user, Account $account): bool
    {
        return $user->isSuperAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, Account $account): bool
    {
        return $user->isSuperAdmin();
    }

    public function delete(User $user, Account $account): bool
    {
        return $user->isSuperAdmin();
    }
}
