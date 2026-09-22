<?php

namespace App\Policies;

use App\Models\JournalEntry;
use App\Models\User;

/**
 * Entries are read-only in this phase: they are only ever produced by
 * AccountingEntryService from a commercial operation, never entered by
 * hand, so there is no create/update/delete policy to define yet.
 */
class JournalEntryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() || $user->isShopAdmin();
    }

    public function view(User $user, JournalEntry $entry): bool
    {
        return $user->isSuperAdmin() || $user->shop_id === $entry->shop_id;
    }
}
