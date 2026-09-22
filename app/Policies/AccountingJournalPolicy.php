<?php

namespace App\Policies;

use App\Models\AccountingJournal;
use App\Models\User;

class AccountingJournalPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function view(User $user, AccountingJournal $journal): bool
    {
        return $user->isSuperAdmin();
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, AccountingJournal $journal): bool
    {
        return $user->isSuperAdmin();
    }

    public function delete(User $user, AccountingJournal $journal): bool
    {
        return $user->isSuperAdmin();
    }
}
