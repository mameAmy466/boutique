<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The reset link opens the admin app (served on APP_URL), not a
        // Laravel page.
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim(config('app.url'), '/')
            .'/reinitialiser-mot-de-passe?token='.urlencode($token).'&email='.urlencode($user->getEmailForPasswordReset()));

        ResetPassword::toMailUsing(fn ($user, string $token) => (new MailMessage)
            ->subject('Réinitialisation de ton mot de passe')
            ->greeting('Bonjour '.$user->name.',')
            ->line('Tu as demandé à changer le mot de passe de ton compte Boutique.')
            ->action('Choisir un nouveau mot de passe', ResetPassword::$createUrlCallback
                ? call_user_func(ResetPassword::$createUrlCallback, $user, $token)
                : url('/'))
            ->line('Ce lien est valable une heure.')
            ->line("Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail : ton mot de passe ne change pas.")
            ->salutation('L’équipe Boutique'));
    }
}
