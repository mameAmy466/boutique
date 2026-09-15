<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Auth::validate($credentials) || ! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Identifiants invalides ou compte désactivé.'],
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load(['role', 'shop']),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->load(['role', 'shop']));
    }

    /**
     * Self-service profile update (name / password), open to every role.
     * Deliberately separate from UserController::update: that endpoint is
     * gated by UserPolicy (who may administer whom) and accepts role_id /
     * shop_id / is_active — fields a self-edit must never be able to touch,
     * or any account could silently promote itself.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'current_password' => ['required_with:password', 'string'],
            'password' => ['sometimes', 'string', 'min:8'],
        ]);

        if (isset($data['password'])) {
            // Hash::check, not Auth::validate: the request is already behind
            // auth:sanctum, which switches the Auth facade's default guard
            // for the rest of the request — Auth::validate() would resolve
            // to Sanctum's RequestGuard, which doesn't support it.
            if (! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Mot de passe actuel incorrect.'],
                ]);
            }
        }

        $user->update([
            ...(isset($data['name']) ? ['name' => $data['name']] : []),
            ...(isset($data['password']) ? ['password' => $data['password']] : []),
        ]);

        return response()->json($user->fresh()->load(['role', 'shop']));
    }
}
