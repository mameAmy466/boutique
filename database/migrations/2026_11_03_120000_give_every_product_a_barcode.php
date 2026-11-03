<?php

use App\Support\Ean13;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Products created before barcodes existed get their permanent in-store
 * barcode, so their labels stop changing with every stock reception.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->whereNull('barcode')->orderBy('id')->pluck('id')->each(function (int $id) {
            DB::table('products')->where('id', $id)->update(['barcode' => Ean13::forProduct($id)]);
        });
    }

    public function down(): void
    {
        // Kept: the codes may already be printed on labels.
    }
};
