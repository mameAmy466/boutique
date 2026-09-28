<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            // Nullable at the DB level (kept portable across drivers without
            // a later NOT NULL alter) — the application layer always sets it
            // on creation; migration 2026_09_28_100006 backfills any shop
            // that predates this column.
            $table->foreignId('organization_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            $table->dropConstrainedForeignId('organization_id');
        });
    }
};
