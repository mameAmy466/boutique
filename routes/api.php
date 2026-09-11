<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CashRegisterController;
use App\Http\Controllers\Api\CashSessionController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/roles', [RoleController::class, 'index']);

    Route::apiResource('shops', ShopController::class);
    Route::apiResource('users', UserController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('products', ProductController::class);

    Route::get('/stocks', [StockController::class, 'index']);
    Route::post('/stocks', [StockController::class, 'store']);
    Route::post('/stocks/{batch}/adjust', [StockController::class, 'adjust']);
    Route::post('/stocks/{batch}/shrinkage', [StockController::class, 'shrinkage']);
    Route::get('/stocks/movements', [StockController::class, 'movements']);

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
});
