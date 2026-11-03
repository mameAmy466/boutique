<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Faster till:
 * - products get a barcode (what the scanner reads) and a usual selling
 *   price (proposed in the cart, above the batch's minimum price);
 * - a sale below the minimum price is possible only with a manager's
 *   authorization, recorded on the sale and flagged on each line.
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

        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('price_authorized_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->boolean('below_min_price')->default(false)->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('below_min_price');
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('price_authorized_by');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique(['organization_id', 'barcode']);
            $table->dropColumn(['barcode', 'selling_price']);
        });
    }
};
