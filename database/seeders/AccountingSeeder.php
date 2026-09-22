<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\AccountingJournal;
use App\Models\AccountingRule;
use App\Models\Expense;
use Illuminate\Database\Seeder;

/**
 * Seeds a minimal, SYSCOHADA-inspired starting chart of accounts, journals
 * and posting rules — a working default, not a certified plan comptable.
 * A comptable should review and adjust the account codes before this is
 * relied on for real filings, per the OHADA/AUDCIF referential.
 */
class AccountingSeeder extends Seeder
{
    private const ACCOUNTS = [
        ['401', 'Fournisseurs', 'passif'],
        ['411', 'Clients', 'actif'],
        ['512', 'Banques', 'tresorerie'],
        ['571', 'Caisse', 'tresorerie'],
        ['601', 'Achats de marchandises', 'charge'],
        ['6051', 'Eau', 'charge'],
        ['6052', 'Électricité', 'charge'],
        ['6132', 'Locations (loyer)', 'charge'],
        ['6135', 'Internet et télécommunications', 'charge'],
        ['624', 'Transports', 'charge'],
        ['6284', 'Fournitures diverses', 'charge'],
        ['6379', 'Publicité et marketing', 'charge'],
        ['646', 'Impôts et taxes', 'charge'],
        ['661', 'Rémunérations du personnel (salaires)', 'charge'],
        ['628', 'Autres charges', 'charge'],
        ['701', 'Ventes de marchandises', 'produit'],
    ];

    private const JOURNALS = [
        ['VE', 'Journal des ventes'],
        ['AC', 'Journal des achats'],
        ['CA', 'Journal de caisse'],
        ['BQ', 'Journal de banque'],
        ['OD', 'Journal des opérations diverses'],
    ];

    /**
     * Maps each Expense::CATEGORIES slug to the account it debits.
     */
    private const EXPENSE_CATEGORY_ACCOUNTS = [
        'loyer' => '6132',
        'electricite' => '6052',
        'eau' => '6051',
        'internet' => '6135',
        'transport' => '624',
        'salaires' => '661',
        'fournitures' => '6284',
        'marketing' => '6379',
        'taxes' => '646',
        'autre' => '628',
    ];

    public function run(): void
    {
        foreach (self::ACCOUNTS as [$code, $name, $type]) {
            Account::firstOrCreate(['code' => $code], ['name' => $name, 'type' => $type]);
        }

        foreach (self::JOURNALS as [$code, $name]) {
            AccountingJournal::firstOrCreate(['code' => $code], ['name' => $name]);
        }

        $accountId = fn (string $code) => Account::where('code', $code)->value('id');
        $journalId = fn (string $code) => AccountingJournal::where('code', $code)->value('id');

        // A vente comptant credits Ventes (701); the debit side (Caisse or
        // Banque) is resolved at posting time from the sale's payment_method.
        $this->rule('sale', null, [
            'dynamic_leg' => 'debit',
            'credit_account_id' => $accountId('701'),
            'journal_id' => $journalId('VE'),
        ]);

        // Each expense category debits its own charge account; the credit
        // side (Caisse or Banque) and the journal both follow payment_method.
        foreach (self::EXPENSE_CATEGORY_ACCOUNTS as $category => $code) {
            if (! in_array($category, Expense::CATEGORIES, true)) {
                continue;
            }

            $this->rule('expense', $category, [
                'dynamic_leg' => 'credit',
                'dynamic_journal' => true,
                'debit_account_id' => $accountId($code),
            ]);
        }

        // Recording a debt to a supplier (achat à crédit) is a non-treasury
        // operation: it just recognises the debt, no cash moves yet.
        $this->rule('supplier_debt_created', null, [
            'debit_account_id' => $accountId('601'),
            'credit_account_id' => $accountId('401'),
            'journal_id' => $journalId('OD'),
        ]);

        // Paying down a supplier debt debits Fournisseurs; the credit side
        // (Caisse or Banque) and the journal follow payment_method.
        $this->rule('supplier_debt_payment', null, [
            'dynamic_leg' => 'credit',
            'dynamic_journal' => true,
            'debit_account_id' => $accountId('401'),
        ]);

        // Recording a client debt (vente en gros à crédit) recognises the
        // receivable against revenue — again no treasury movement yet.
        $this->rule('client_debt_created', null, [
            'debit_account_id' => $accountId('411'),
            'credit_account_id' => $accountId('701'),
            'journal_id' => $journalId('OD'),
        ]);

        // Collecting on a client debt credits Clients; the debit side
        // (Caisse or Banque) and the journal follow payment_method.
        $this->rule('client_debt_payment', null, [
            'dynamic_leg' => 'debit',
            'dynamic_journal' => true,
            'credit_account_id' => $accountId('411'),
        ]);
    }

    private function rule(string $event, ?string $category, array $attributes): void
    {
        AccountingRule::firstOrCreate(
            ['event' => $event, 'category' => $category],
            $attributes,
        );
    }
}
