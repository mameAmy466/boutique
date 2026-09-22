<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AccountingJournalController;
use App\Http\Controllers\Api\AccountingRuleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BankStatementLineController;
use App\Http\Controllers\Api\CashRegisterController;
use App\Http\Controllers\Api\CashSessionController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ClientDebtController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SupplierDebtController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);

    Route::get('/roles', [RoleController::class, 'index']);

    Route::apiResource('shops', ShopController::class);
    Route::post('/shops/{shop}/close-period', [ShopController::class, 'closePeriod']);
    Route::get('/users/{user}/activity', [UserController::class, 'activity']);
    Route::apiResource('users', UserController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('products', ProductController::class);
    Route::post('/products/{product}/image', [ProductController::class, 'uploadImage']);

    Route::get('/stocks', [StockController::class, 'index']);
    Route::post('/stocks', [StockController::class, 'store']);
    Route::put('/stocks/{batch}', [StockController::class, 'update']);
    Route::delete('/stocks/{batch}', [StockController::class, 'destroy']);
    Route::post('/stocks/{batch}/adjust', [StockController::class, 'adjust']);
    Route::post('/stocks/{batch}/shrinkage', [StockController::class, 'shrinkage']);
    Route::get('/stocks/movements', [StockController::class, 'movements']);

    Route::apiResource('purchase-orders', PurchaseOrderController::class)->only(['index', 'store', 'show']);
    Route::post('/purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive']);
    Route::post('/purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);

    Route::get('/cash-registers', [CashRegisterController::class, 'index']);
    Route::post('/cash-registers', [CashRegisterController::class, 'store']);

    Route::get('/cash-sessions', [CashSessionController::class, 'index']);
    Route::post('/cash-sessions/open', [CashSessionController::class, 'open']);
    Route::post('/cash-sessions/{cashSession}/close', [CashSessionController::class, 'close']);

    Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);
    Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel']);

    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);

    Route::get('/dashboard/general', [DashboardController::class, 'general']);
    Route::get('/dashboard/shop/{shop}', [DashboardController::class, 'shop']);

    Route::apiResource('expenses', ExpenseController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::apiResource('customers', CustomerController::class)->only(['index', 'show', 'store', 'update']);

    Route::apiResource('supplier-debts', SupplierDebtController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::post('/supplier-debts/{supplierDebt}/payments', [SupplierDebtController::class, 'addPayment']);

    Route::apiResource('client-debts', ClientDebtController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::post('/client-debts/{clientDebt}/payments', [ClientDebtController::class, 'addPayment']);

    Route::get('/accounting/cashflow', [AccountingController::class, 'cashflow']);
    Route::get('/accounting/balance', [AccountingController::class, 'trialBalance']);
    Route::get('/accounting/ledger/{account}', [AccountingController::class, 'ledger']);
    Route::get('/accounting/income-statement', [AccountingController::class, 'incomeStatement']);
    Route::get('/accounting/balance-sheet', [AccountingController::class, 'balanceSheet']);

    Route::get('/bank-statement-lines/unmatched-entries', [BankStatementLineController::class, 'unmatchedEntries']);
    Route::post('/bank-statement-lines/import', [BankStatementLineController::class, 'import']);
    Route::post('/bank-statement-lines/{bankStatementLine}/match', [BankStatementLineController::class, 'match']);
    Route::post('/bank-statement-lines/{bankStatementLine}/unmatch', [BankStatementLineController::class, 'unmatch']);
    Route::apiResource('bank-statement-lines', BankStatementLineController::class)->only(['index', 'store', 'destroy']);

    Route::apiResource('accounts', AccountController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('accounting-journals', AccountingJournalController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('accounting-rules', AccountingRuleController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('/journal-entries', [JournalEntryController::class, 'index']);
});
