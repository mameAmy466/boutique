<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Batches are soft-deleted (not removed) so their stock_movements
     * history — the audit trail — always stays intact and resolvable.
     */
    public function up(): void
    {
        Schema::table('product_batches', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('product_batches', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
