<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Access to the platform (organizations.status) is now tracked apart from
 * the billing state (subscriptions.status): the platform admin can suspend
 * a client by hand whatever their subscription says, and an expired
 * subscription blocks access without touching the organization.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('status', 20)->default('active')->after('phone');
            $table->timestamp('suspended_at')->nullable()->after('status');
            $table->string('suspension_reason')->nullable()->after('suspended_at');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('status', 20)->default('trial')->change();
            $table->unsignedSmallInteger('grace_days')->default(7)->after('current_period_end');
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method', 30)->default('cash');
            $table->string('reference')->nullable();
            $table->unsignedSmallInteger('months')->default(1);
            $table->date('paid_at');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['organization_id', 'paid_at']);
        });

        Schema::create('platform_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 50);
            $table->text('description');
            $table->json('details')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_audit_logs');
        Schema::dropIfExists('subscription_payments');

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('grace_days');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['status', 'suspended_at', 'suspension_reason']);
        });
    }
};
