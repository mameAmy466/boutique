<?php

namespace App\Services;

use App\Models\Account;
use App\Models\AccountingJournal;
use App\Models\AccountingRule;
use App\Models\ClientDebt;
use App\Models\ClientDebtPayment;
use App\Models\Expense;
use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use App\Models\Sale;
use App\Models\SupplierDebt;
use App\Models\SupplierDebtPayment;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Turns commercial operations already recorded elsewhere (sales, expenses,
 * debts and their payments) into balanced double-entry journal entries,
 * driven entirely by the configurable AccountingRule table rather than
 * hardcoded account numbers — a comptable can retune the plan comptable
 * without a code change.
 *
 * Every record* method is deliberately soft: if no rule is configured yet
 * (fresh install, or an admin hasn't finished setting up the plan
 * comptable), it returns null instead of throwing. The register, the
 * expense form and the debt ledgers must never fail because accounting
 * configuration is incomplete — bookkeeping is additive on top of the
 * commercial operation, never a precondition for it.
 */
class AccountingEntryService
{
    public function recordSale(Sale $sale): ?JournalEntry
    {
        return $this->post(
            event: 'sale',
            category: null,
            source: $sale,
            shopId: $sale->shop_id,
            entryDate: ($sale->created_at ?? now())->toDateString(),
            reference: $sale->sale_number,
            label: 'Vente '.$sale->sale_number,
            amount: (float) $sale->total,
            paymentMethod: $sale->payment_method,
            createdBy: $sale->user_id,
        );
    }

    /**
     * Reverses (contre-passation) the entry originally posted for a sale,
     * rather than editing or deleting it — the ledger keeps a full history
     * of both the sale and its cancellation.
     */
    public function recordSaleCancellation(Sale $sale): ?JournalEntry
    {
        $original = JournalEntry::query()
            ->where('source_type', Sale::class)
            ->where('source_id', $sale->id)
            ->with('lines')
            ->first();

        if (! $original || $original->lines->isEmpty()) {
            return null;
        }

        return $this->safely(function () use ($sale, $original) {
            return DB::transaction(function () use ($sale, $original) {
                $entry = JournalEntry::create([
                    'journal_id' => $original->journal_id,
                    'shop_id' => $sale->shop_id,
                    'entry_date' => now()->toDateString(),
                    'reference' => $sale->sale_number,
                    'label' => 'Annulation de la vente '.$sale->sale_number,
                    'source_type' => Sale::class,
                    'source_id' => $sale->id,
                    'created_by' => $sale->cancelled_by,
                ]);

                foreach ($original->lines as $line) {
                    JournalEntryLine::create([
                        'journal_entry_id' => $entry->id,
                        'account_id' => $line->account_id,
                        'debit' => $line->credit,
                        'credit' => $line->debit,
                        'label' => $entry->label,
                    ]);
                }

                return $entry;
            });
        });
    }

    public function recordExpense(Expense $expense): ?JournalEntry
    {
        return $this->post(
            event: 'expense',
            category: $expense->category,
            source: $expense,
            shopId: $expense->shop_id,
            entryDate: $expense->expense_date->toDateString(),
            reference: 'DEP-'.$expense->id,
            label: 'Dépense — '.($expense->label ?: $expense->category),
            amount: (float) $expense->amount,
            paymentMethod: $expense->payment_method,
            createdBy: $expense->created_by,
        );
    }

    public function recordSupplierDebtCreated(SupplierDebt $debt): ?JournalEntry
    {
        return $this->post(
            event: 'supplier_debt_created',
            category: null,
            source: $debt,
            shopId: $debt->shop_id,
            entryDate: now()->toDateString(),
            reference: 'DF-'.$debt->id,
            label: 'Dette fournisseur #'.$debt->id,
            amount: (float) $debt->amount,
            paymentMethod: null,
            createdBy: $debt->created_by,
        );
    }

    public function recordSupplierDebtPayment(SupplierDebtPayment $payment): ?JournalEntry
    {
        $debt = $payment->supplierDebt;

        return $this->post(
            event: 'supplier_debt_payment',
            category: null,
            source: $payment,
            shopId: $debt->shop_id,
            entryDate: $payment->paid_at->toDateString(),
            reference: 'PF-'.$payment->id,
            label: 'Paiement dette fournisseur #'.$debt->id,
            amount: (float) $payment->amount,
            paymentMethod: $payment->payment_method,
            createdBy: $payment->created_by,
        );
    }

    public function recordClientDebtCreated(ClientDebt $debt): ?JournalEntry
    {
        return $this->post(
            event: 'client_debt_created',
            category: null,
            source: $debt,
            shopId: $debt->shop_id,
            entryDate: now()->toDateString(),
            reference: 'CC-'.$debt->id,
            label: 'Créance client #'.$debt->id,
            amount: (float) $debt->amount,
            paymentMethod: null,
            createdBy: $debt->created_by,
        );
    }

    public function recordClientDebtPayment(ClientDebtPayment $payment): ?JournalEntry
    {
        $debt = $payment->clientDebt;

        return $this->post(
            event: 'client_debt_payment',
            category: null,
            source: $payment,
            shopId: $debt->shop_id,
            entryDate: $payment->paid_at->toDateString(),
            reference: 'RC-'.$payment->id,
            label: 'Encaissement créance client #'.$debt->id,
            amount: (float) $payment->amount,
            paymentMethod: $payment->payment_method,
            createdBy: $payment->created_by,
        );
    }

    private function post(
        string $event,
        ?string $category,
        EloquentModel $source,
        int $shopId,
        string $entryDate,
        string $reference,
        string $label,
        float $amount,
        ?string $paymentMethod,
        ?int $createdBy,
    ): ?JournalEntry {
        $rule = AccountingRule::query()
            ->where('event', $event)
            ->where('category', $category)
            ->first();

        if (! $rule || $amount <= 0) {
            return null;
        }

        $debitAccountId = $rule->debit_account_id;
        $creditAccountId = $rule->credit_account_id;
        $journalId = $rule->journal_id;

        if ($rule->dynamic_leg || $rule->dynamic_journal) {
            $treasury = $this->resolveTreasury($paymentMethod);

            if ($rule->dynamic_leg === 'debit') {
                $debitAccountId = $treasury['account_id'];
            } elseif ($rule->dynamic_leg === 'credit') {
                $creditAccountId = $treasury['account_id'];
            }

            if ($rule->dynamic_journal) {
                $journalId = $treasury['journal_id'];
            }
        }

        if (! $debitAccountId || ! $creditAccountId || ! $journalId) {
            return null;
        }

        return $this->safely(function () use (
            $journalId, $shopId, $entryDate, $reference, $label, $source, $createdBy, $debitAccountId, $creditAccountId, $amount,
        ) {
            return DB::transaction(function () use (
                $journalId, $shopId, $entryDate, $reference, $label, $source, $createdBy, $debitAccountId, $creditAccountId, $amount,
            ) {
                $entry = JournalEntry::create([
                    'journal_id' => $journalId,
                    'shop_id' => $shopId,
                    'entry_date' => $entryDate,
                    'reference' => $reference,
                    'label' => $label,
                    'source_type' => $source::class,
                    'source_id' => $source->id,
                    'created_by' => $createdBy,
                ]);

                JournalEntryLine::create([
                    'journal_entry_id' => $entry->id,
                    'account_id' => $debitAccountId,
                    'debit' => $amount,
                    'credit' => 0,
                    'label' => $label,
                ]);

                JournalEntryLine::create([
                    'journal_entry_id' => $entry->id,
                    'account_id' => $creditAccountId,
                    'debit' => 0,
                    'credit' => $amount,
                    'label' => $label,
                ]);

                return $entry;
            });
        });
    }

    /**
     * Never lets a bookkeeping failure escape to the caller — see the class
     * docblock: a misconfigured plan comptable must not block the
     * commercial operation it would have recorded.
     */
    private function safely(callable $work): ?JournalEntry
    {
        try {
            return $work();
        } catch (Throwable $e) {
            Log::warning('Génération automatique d\'écriture comptable échouée.', ['exception' => $e]);

            return null;
        }
    }

    /**
     * @return array{account_id: ?int, journal_id: ?int}
     */
    private function resolveTreasury(?string $paymentMethod): array
    {
        $isCash = ($paymentMethod ?? 'cash') === 'cash';

        return [
            'account_id' => Account::where('code', $isCash ? Account::CASH_CODE : Account::BANK_CODE)->value('id'),
            'journal_id' => AccountingJournal::where('code', $isCash ? AccountingJournal::CASH_CODE : AccountingJournal::BANK_CODE)->value('id'),
        ];
    }
}
