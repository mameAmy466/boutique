<?php

namespace App\Services;

use App\Models\BankStatementLine;
use App\Models\JournalEntry;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Permanently removes a client and everything it owns.
 *
 * Most of it cascades from the organization (shops, sales, stock...), but
 * its journal entries and bank lines point at its own chart of accounts with
 * restrictive keys, so they go first; and its users are only detached by
 * the database, so they are deleted explicitly.
 */
class OrganizationPurger
{
    public function purge(Organization $organization): void
    {
        DB::transaction(function () use ($organization) {
            $shopIds = DB::table('shops')->where('organization_id', $organization->id)->pluck('id');
            $userIds = User::where('organization_id', $organization->id)->pluck('id');
            $images = DB::table('products')->where('organization_id', $organization->id)->whereNotNull('image_path')->pluck('image_path');

            // Lines go with their entry (cascade).
            JournalEntry::withoutGlobalScopes()->whereIn('shop_id', $shopIds)->delete();
            BankStatementLine::withoutGlobalScopes()->whereIn('shop_id', $shopIds)->delete();

            $organization->delete();

            User::whereIn('id', $userIds)->each(function (User $user) {
                $user->tokens()->delete();
                $user->delete();
            });

            DB::afterCommit(fn () => Storage::disk('public')->delete($images->all()));
        });
    }
}
