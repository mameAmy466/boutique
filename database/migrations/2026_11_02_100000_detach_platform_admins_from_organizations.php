<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The platform admin runs the SaaS and is not a shop: no organization, no
 * role inside one. The organization it used to belong to ("Organisation
 * principale") is removed when nothing else uses it — no shop, no other
 * user. One that does hold a shop is kept as an ordinary client.
 */
return new class extends Migration
{
    public function up(): void
    {
        $organizationIds = DB::table('users')
            ->where('is_platform_admin', true)
            ->whereNotNull('organization_id')
            ->pluck('organization_id')
            ->unique();

        DB::table('users')->where('is_platform_admin', true)->update([
            'organization_id' => null,
            'shop_id' => null,
            'role_id' => null,
        ]);

        foreach ($organizationIds as $organizationId) {
            $inUse = DB::table('shops')->where('organization_id', $organizationId)->exists()
                || DB::table('users')->where('organization_id', $organizationId)->exists();

            if (! $inUse) {
                // Cascades to its subscription and its (unused) chart of accounts.
                DB::table('organizations')->where('id', $organizationId)->delete();
            }
        }
    }

    public function down(): void
    {
        // Not restored: the platform admin never needed an organization.
    }
};
