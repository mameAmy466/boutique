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
        Schema::table('customers', function (Blueprint $table) {
            $table->string('tax_id')->nullable()->after('name');
            $table->string('address')->nullable()->after('phone');
            $table->unsignedSmallInteger('payment_terms_days')->nullable()->after('address');
            $table->decimal('credit_limit', 12, 2)->nullable()->after('payment_terms_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['tax_id', 'address', 'payment_terms_days', 'credit_limit']);
        });
    }
};
