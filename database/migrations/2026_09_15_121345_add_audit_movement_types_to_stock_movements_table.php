<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Widens the stock_movements.type enum with two audit-only types so every
 * stock-affecting action — not just entries/adjustments/shrinkage — leaves
 * a trace: price_correction (a batch's purchase cost / min price edited)
 * and deletion (a batch removed). No doctrine/dbal is installed, so a
 * plain column ->change() isn't available; MySQL gets a raw MODIFY, and
 * SQLite (whose enum is a CHECK constraint baked into CREATE TABLE, not
 * alterable in place) gets a full table rebuild.
 */
return new class extends Migration
{
    private const ORIGINAL_TYPES = [
        'entry', 'sale', 'transfer_out', 'transfer_in', 'damage',
        'loss', 'theft', 'expiration', 'adjustment', 'return',
    ];

    private const AUDIT_TYPES = [
        'price_correction', 'deletion',
    ];

    public function up(): void
    {
        $this->applyTypes([...self::ORIGINAL_TYPES, ...self::AUDIT_TYPES]);
    }

    public function down(): void
    {
        $this->applyTypes(self::ORIGINAL_TYPES);
    }

    private function applyTypes(array $types): void
    {
        if (DB::getDriverName() === 'sqlite') {
            $this->rebuildSqliteTable($types);

            return;
        }

        $quoted = "'".implode("','", $types)."'";
        DB::statement("ALTER TABLE stock_movements MODIFY type ENUM({$quoted}) NOT NULL");
    }

    private function rebuildSqliteTable(array $types): void
    {
        Schema::create('stock_movements_rebuild', function (Blueprint $table) use ($types) {
            $table->id();
            $table->foreignId('product_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->enum('type', $types);
            $table->integer('quantity');
            $table->nullableMorphs('reference');
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        DB::statement(
            'INSERT INTO stock_movements_rebuild '.
            '(id, product_batch_id, shop_id, type, quantity, reference_type, reference_id, note, user_id, created_at, updated_at) '.
            'SELECT id, product_batch_id, shop_id, type, quantity, reference_type, reference_id, note, user_id, created_at, updated_at '.
            'FROM stock_movements'
        );

        Schema::drop('stock_movements');
        Schema::rename('stock_movements_rebuild', 'stock_movements');
    }
};
