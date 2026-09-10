<?php

use App\Exceptions\InsufficientStockException;
use App\Exceptions\PriceBelowMinimumException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            HandleCors::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (PriceBelowMinimumException $e, $request) {
            return response()->json([
                'message' => $e->getMessage(),
                'min_price' => $e->minPrice,
                'attempted_price' => $e->attemptedPrice,
            ], 422);
        });

        $exceptions->render(function (InsufficientStockException $e, $request) {
            return response()->json([
                'message' => $e->getMessage(),
                'available' => $e->available,
                'requested' => $e->requested,
            ], 422);
        });
    })->create();
