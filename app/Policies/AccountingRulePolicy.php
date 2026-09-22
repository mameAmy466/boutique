<?php

namespace App\Policies;

use App\Models\AccountingRule;
use App\Models\User;

class AccountingRulePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function view(User $user, AccountingRule $rule): bool
    {
        return $user->isSuperAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, AccountingRule $rule): bool
    {
        return $user->isSuperAdmin();
    }

    public function delete(User $user, AccountingRule $rule): bool
    {
        return $user->isSuperAdmin();
    }
}
