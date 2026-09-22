<?php

use Database\Seeders\AccountingSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * Without this, the chart of accounts, journals and posting rules only ever
 * existed via AccountingSeeder, called from DatabaseSeeder — which only runs
 * on `php artisan db:seed` or `migrate --seed`. A deploy that only runs
 * `php artisan migrate --force` (the common case) never seeds it, so
 * AccountingEntryService::post() silently finds no rule for every sale,
 * expense or debt (by design — bookkeeping must never block a commercial
 * operation) and every accounting report stays empty forever, with no
 * error anywhere to point at why. Running the seeder from a migration
 * guarantees it happens on any deploy that migrates, not just one that
 * also seeds. AccountingSeeder is entirely firstOrCreate-based, so this is
 * safe to run alongside (or after) a manual db:seed.
 */
return new class extends Migration
{
    public function up(): void
    {
        (new AccountingSeeder())->run();
    }

    public function down(): void
    {
        // Intentionally left as a no-op: journal entries created afterwards
        // may reference these accounts/journals, so rolling back would
        // either fail on the FK or silently orphan real financial records.
    }
};
