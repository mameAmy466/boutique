<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Self-service signups now wait for the platform admin: the request has its
 * own status (pending, info_requested, approved, rejected), separate from the
 * organization's access (now also "inactive": created but not authorized)
 * and from the subscription (now also "pending_payment").
 *
 * Every existing organization was already in use, so it counts as approved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('registration_status', 20)->default('approved')->after('status');
            $table->text('registration_note')->nullable()->after('registration_status');
            $table->timestamp('reviewed_at')->nullable()->after('registration_note');
            $table->foreignId('reviewed_by')->nullable()->after('reviewed_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['registration_status', 'registration_note', 'reviewed_at']);
        });
    }
};
