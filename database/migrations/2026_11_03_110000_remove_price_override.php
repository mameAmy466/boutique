<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The minimum price is absolute: there is no authorization to sell below
 * it. Removes the columns a short-lived version of the previous migration
 * added, on databases that ran it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('sale_items', 'below_min_price')) {
            Schema::table('sale_items', function (Blueprint $table) {
                $table->dropColumn('below_min_price');
            });
        }

        if (Schema::hasColumn('sales', 'price_authorized_by')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->dropConstrainedForeignId('price_authorized_by');
            });
        }
    }

    public function down(): void
    {
        // Nothing to restore.
    }
};
