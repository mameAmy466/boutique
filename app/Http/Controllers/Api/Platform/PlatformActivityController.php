<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformAuditLog;
use App\Models\SubscriptionPayment;
use Illuminate\Http\Request;

class PlatformActivityController extends Controller
{
    public function payments(Request $request)
    {
        $query = SubscriptionPayment::query()->with(['organization:id,name', 'plan:id,name', 'recorder:id,name'])
            ->latest('paid_at')->latest('id');

        if ($request->filled('from')) {
            $query->where('paid_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->where('paid_at', '<=', $request->date('to'));
        }

        return response()->json($query->limit(500)->get());
    }

    public function auditLogs(Request $request)
    {
        $query = PlatformAuditLog::query()->with(['organization:id,name', 'user:id,name'])->latest('id');

        if ($request->filled('organization_id')) {
            $query->where('organization_id', $request->integer('organization_id'));
        }

        return response()->json($query->limit(300)->get());
    }
}
