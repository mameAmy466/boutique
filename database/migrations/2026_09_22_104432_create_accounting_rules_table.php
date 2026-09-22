<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * No DB-level unique(event, category): MySQL treats NULLs as distinct in
     * a unique index, so it would silently allow duplicate (event, NULL)
     * rows anyway. Uniqueness is enforced in the controller instead.
     */
    public function up(): void
    {
        Schema::create('accounting_rules', function (Blueprint $table) {
            $table->id();
            $table->string('event');
            $table->string('category')->nullable();
            $table->string('dynamic_leg')->nullable();
            $table->boolean('dynamic_journal')->default(false);
            $table->foreignId('debit_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('credit_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('journal_id')->nullable()->constrained('accounting_journals')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['event', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_rules');
    }
};
