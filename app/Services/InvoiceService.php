<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Sale;

class InvoiceService
{
    public function generateForSale(Sale $sale): Invoice
    {
        return Invoice::create([
            'sale_id' => $sale->id,
            'invoice_number' => sprintf('FAC-%d-%06d', now()->year, $sale->id),
            'issued_at' => now(),
        ]);
    }
}
