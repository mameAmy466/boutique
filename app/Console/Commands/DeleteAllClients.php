<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\PlatformAuditLog;
use App\Models\User;
use App\Services\OrganizationPurger;
use Illuminate\Console\Command;

/**
 * Wipes every client (test data) and keeps the platform: its administrators,
 * plans and prices. Asks for confirmation unless --force.
 */
class DeleteAllClients extends Command
{
    protected $signature = 'platform:delete-clients {--force : Ne pas demander de confirmation}';

    protected $description = 'Supprime tous les clients et leurs données (garde les administrateurs de la plateforme et les formules)';

    public function handle(OrganizationPurger $purger): int
    {
        $organizations = Organization::orderBy('id')->get();
        $orphans = User::where('is_platform_admin', false)->whereNull('organization_id')->count();

        $this->info(sprintf('%d client(s) et %d compte(s) sans boutique seront supprimés :', $organizations->count(), $orphans));
        foreach ($organizations as $organization) {
            $this->line("  - #{$organization->id} {$organization->name}");
        }

        if (! $this->option('force') && ! $this->confirm('Supprimer définitivement ces clients et toutes leurs données ?')) {
            $this->warn('Rien n’a été supprimé.');

            return self::FAILURE;
        }

        foreach ($organizations as $organization) {
            $purger->purge($organization);
        }

        User::where('is_platform_admin', false)->whereNull('organization_id')->each(function (User $user) {
            $user->tokens()->delete();
            $user->delete();
        });

        PlatformAuditLog::query()->delete();

        $this->info('Terminé. Administrateurs de la plateforme gardés : '.User::where('is_platform_admin', true)->pluck('email')->implode(', '));

        return self::SUCCESS;
    }
}
