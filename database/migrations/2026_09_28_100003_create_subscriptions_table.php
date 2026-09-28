<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained();
            $table->enum('status', ['trial', 'active', 'past_due', 'cancelled', 'suspended'])->default('trial');
            $table->enum('billing_cycle', ['monthly', 'annual'])->nullable();
            $table->date('trial_ends_at')->nullable();
            $table->date('current_period_start')->nullable();
            $table->date('current_period_end')->nullable();
            $table->date('cancelled_at')->nullable();
            // Quotas add-on quantities, billed on top of the plan's included
            // quota (see Plan/PlanFeature) — "forfait de base + supplément
            // par boutique/utilisateur/caisse", not a separate line-item
            // table, to keep this foundational layer simple.
            $table->unsignedInteger('extra_shops')->default(0);
            $table->unsignedInteger('extra_users')->default(0);
            $table->unsignedInteger('extra_registers')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
