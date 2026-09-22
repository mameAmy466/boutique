<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Widens the stock_movements.type enum with credit_sale — a wholesale
 * credit sale (créance client) now moves stock out just like a register
 * sale, so it needs its own type instead of overloading "sale" (whose
 * reference always points at a Sale, never a ClientDebt).
 */
return new class extends Migration
{
    private const ORIGINAL_TYPES = [
        'entry', 'sale', 'transfer_out', 'transfer_in', 'damage',
        'loss', 'theft', 'expiration', 'adjustment', 'return',
        'price_correction', 'deletion',
    ];

    private const NEW_TYPES = [
        'credit_sale',
    ];

    public function up(): void
    {
        $this->applyTypes([...self::ORIGINAL_TYPES, ...self::NEW_TYPES]);
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
            // Explicit index name: SQLite keeps an index's original name across
            // a table rename, so the previous rebuild's auto-generated name
            // (stock_movements_rebuild_reference_type_reference_id_index) is
            // still bound to the current stock_movements table and would
            // collide with the default name Laravel would pick here again.
            $table->nullableMorphs('reference', 'stock_movements_reference_index_v2');
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
