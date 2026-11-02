<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

/**
 * "Mot de passe oublié" from the login page: an e-mail with a one-hour link
 * (see AppServiceProvider for its address and wording), then a new password.
 */
class PasswordResetController extends Controller
{
    public function forgot(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']], [
            'email.required' => 'Indique ton adresse e-mail.',
            'email.email' => 'Adresse e-mail invalide.',
        ]);

        $status = Password::sendResetLink($data);

        if ($status === Password::RESET_THROTTLED) {
            throw ValidationException::withMessages([
                'email' => ['Un lien vient déjà d’être envoyé. Patiente une minute avant de réessayer.'],
            ]);
        }

        // Same answer whether the address exists or not: the form must not
        // reveal who has an account.
        return response()->json([
            'message' => 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé. Il est valable une heure.',
            // While outgoing mail is not configured the e-mail cannot arrive;
            // the page then points to the other way of getting help.
            'mail_enabled' => config('mail.default') !== 'log',
        ]);
    }

    public function reset(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'Les deux mots de passe ne correspondent pas.',
        ]);

        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password])->save();
            // Sign out every device that used the old password.
            $user->tokens()->delete();
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => ['Ce lien n’est plus valable (il a expiré ou a déjà servi). Demande un nouveau lien.'],
            ]);
        }

        return response()->json(['message' => 'Mot de passe modifié. Tu peux te connecter.']);
    }
}
