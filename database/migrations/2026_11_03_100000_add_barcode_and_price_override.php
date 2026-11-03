<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Faster till: products get a barcode (what the scanner reads) and a usual
 * selling price (proposed in the cart, never below the batch's minimum).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('barcode', 64)->nullable()->after('reference');
            $table->decimal('selling_price', 14, 2)->nullable()->after('barcode');
            $table->unique(['organization_id', 'barcode']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['organization_id', 'barcode']);
            $table->dropColumn(['barcode', 'selling_price']);
        });
    }
};
