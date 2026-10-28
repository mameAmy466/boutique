<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Tells the platform admins that a shop asked to join. The request always
 * shows in the Super Admin (pending requests counter and history); the e-mail
 * only arrives once outgoing mail is configured (MAIL_* in .env).
 */
class RegistrationNotifier
{
    public function submitted(Organization $organization, Plan $plan): void
    {
        PlatformAuditLog::record($organization, 'registration_submitted', "Nouvelle demande d'inscription (formule {$plan->name}).");

        $recipients = User::where('is_platform_admin', true)->where('is_active', true)->pluck('email')->filter();
        if ($recipients->isEmpty()) {
            return;
        }

        $body = implode("\n", [
            "Nouvelle demande d'inscription sur Boutique :",
            '',
            "Boutique : {$organization->name}",
            'E-mail : '.($organization->email ?? '—'),
            'Téléphone : '.($organization->phone ?? '—'),
            "Formule demandée : {$plan->name}",
            '',
            'Valider ou refuser : '.rtrim(config('app.url'), '/').'/plateforme/demandes',
        ]);

        try {
            Mail::raw($body, function ($message) use ($recipients, $organization) {
                $message->to($recipients->all())->subject("Nouvelle inscription : {$organization->name}");
            });
        } catch (Throwable $e) {
            // A mail problem must never block a signup.
            Log::warning("Notification d'inscription non envoyée.", ['exception' => $e]);
        }
    }
}
