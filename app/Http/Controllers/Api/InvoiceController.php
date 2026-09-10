<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;

class InvoiceController extends Controller
{
    public function show(Invoice $invoice)
    {
        $this->authorize('view', $invoice->sale);

        return response()->json($invoice->load(['sale.items.productBatch.product', 'sale.shop', 'sale.user']));
    }
}
