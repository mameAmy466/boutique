<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** The platform (Super Admin) space is reserved to the platform operator, never to a client's own admins. */
class EnsurePlatformAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isPlatformAdmin()) {
            return response()->json(['message' => 'Accès réservé à l\'administration de la plateforme.'], 403);
        }

        return $next($request);
    }
}
