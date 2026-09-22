<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // Percentage (18.00 = 18%), snapshotted per sale so a later rate
            // change never retroactively alters an already-issued invoice.
            // The total stays TTC as before; TVA is extracted from it, not
            // added on top, so nothing downstream (cash reconciliation,
            // accounting, stock) needs to change.
            $table->decimal('tax_rate', 5, 2)->default(18.00)->after('total');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('tax_rate');
        });
    }
};
