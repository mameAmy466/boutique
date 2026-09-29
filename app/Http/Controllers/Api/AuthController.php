<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Public self-service signup from the pricing page: one call creates
     * the organization, its first shop, the owner's super_admin account and
     * a 15-day trial subscription on the plan they picked, then logs them
     * straight in — mirroring login()'s response shape so the frontend can
     * treat "just registered" and "just logged in" identically.
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'organization_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:50'],
            'shop_name' => ['required', 'string', 'max:255'],
            'shop_code' => ['required', 'string', 'max:50', 'unique:shops,code'],
            'plan_code' => ['required', Rule::in([Plan::CODE_SIMPLE, Plan::CODE_PRO, Plan::CODE_PRO_MAX])],
        ], [
            'organization_name.required' => "Indique le nom de l'entreprise.",
            'name.required' => 'Indique ton nom complet.',
            'email.required' => 'Indique une adresse e-mail.',
            'email.email' => 'Adresse e-mail invalide.',
            'email.unique' => 'Un compte existe déjà avec cette adresse e-mail.',
            'password.required' => 'Choisis un mot de passe.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'shop_name.required' => 'Indique le nom de la boutique.',
            'shop_code.required' => 'Indique un code pour la boutique.',
            'shop_code.unique' => 'Ce code boutique est déjà utilisé, choisis-en un autre.',
            'plan_code.required' => 'Choisis un forfait.',
            'plan_code.in' => 'Forfait inconnu.',
        ]);

        $plan = Plan::where('code', $data['plan_code'])->where('is_active', true)->firstOrFail();

        $user = DB::transaction(function () use ($data, $plan) {
            $organization = Organization::create([
                'name' => $data['organization_name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
            ]);

            $shop = Shop::create([
                'organization_id' => $organization->id,
                'name' => $data['shop_name'],
                'code' => $data['shop_code'],
            ]);

            Subscription::create([
                'organization_id' => $organization->id,
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_TRIAL,
                'trial_ends_at' => now()->addDays(15)->toDateString(),
            ]);

            $superAdminRole = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

            return User::create([
                'organization_id' => $organization->id,
                'shop_id' => null,
                'role_id' => $superAdminRole->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'is_active' => true,
            ]);
        });

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load(['role', 'shop', 'organization']),
        ], 201);
    }

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
