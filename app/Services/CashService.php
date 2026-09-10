<?php

namespace App\Services;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CashService
{
    public function openSession(CashRegister $register, User $user, float $openingAmount): CashSession
    {
        $alreadyOpen = CashSession::query()
            ->where('cash_register_id', $register->id)
            ->where('status', CashSession::STATUS_OPEN)
            ->exists();

        if ($alreadyOpen) {
            throw new RuntimeException('Cette caisse a déjà une session ouverte.');
        }

        return CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $user->id,
            'opening_amount' => $openingAmount,
            'opened_at' => now(),
            'status' => CashSession::STATUS_OPEN,
        ]);
    }

    public function closeSession(CashSession $session, float $declaredAmount): CashSession
    {
        return DB::transaction(function () use ($session, $declaredAmount) {
            $session = CashSession::query()->lockForUpdate()->findOrFail($session->id);

            if (! $session->isOpen()) {
                throw new RuntimeException('Cette session de caisse est déjà clôturée.');
            }

            $cashSalesTotal = Sale::query()
                ->where('cash_session_id', $session->id)
                ->where('payment_method', 'cash')
                ->where('status', Sale::STATUS_COMPLETED)
                ->sum('total');

            $expectedAmount = round((float) $session->opening_amount + (float) $cashSalesTotal, 2);
            $difference = round($declaredAmount - $expectedAmount, 2);

            $session->update([
                'closing_amount' => $declaredAmount,
                'expected_amount' => $expectedAmount,
                'difference' => $difference,
                'closed_at' => now(),
                'status' => CashSession::STATUS_CLOSED,
            ]);

            return $session;
        });
    }
}
