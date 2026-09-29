<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use App\Services\GoogleTokenVerifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use UnexpectedValueException;

class AuthController extends Controller
{
    public function __construct(private readonly GoogleTokenVerifier $googleTokens) {}

    /**
     * Public self-service signup from the pricing page: one call creates
     * the organization, its first shop, the owner's super_admin account and
     * a 15-day trial subscription on the plan they picked, then logs them
     * straight in — mirroring login()'s response shape so the frontend can
     * treat "just registered" and "just logged in" identically.
     *
     * Signing up "with Google" reuses this same endpoint: it takes an
     * id_token instead of an email/password pair. The token is verified
     * server-side and its email is what gets used — never a client-supplied
     * email — so this can't be used to claim an address that isn't actually
     * behind that Google account.
     */
    public function register(Request $request)
    {
        $usingGoogle = $request->filled('id_token');

        $rules = [
            'organization_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'shop_name' => ['required', 'string', 'max:255'],
            'shop_code' => ['required', 'string', 'max:50', 'unique:shops,code'],
            'plan_code' => ['required', Rule::in([Plan::CODE_SIMPLE, Plan::CODE_PRO, Plan::CODE_PRO_MAX])],
        ];

        if ($usingGoogle) {
            $rules['id_token'] = ['required', 'string'];
        } else {
            $rules['email'] = ['required', 'email', 'unique:users,email'];
            $rules['password'] = ['required', 'string', 'min:8'];
        }

        $data = $request->validate($rules, [
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

        $googleId = null;

        if ($usingGoogle) {
            try {
                $payload = $this->googleTokens->verify($data['id_token']);
            } catch (UnexpectedValueException $e) {
                throw ValidationException::withMessages(['id_token' => [$e->getMessage()]]);
            }

            if (! $payload['email_verified']) {
                throw ValidationException::withMessages([
                    'id_token' => ["L'adresse e-mail de ce compte Google n'est pas vérifiée."],
                ]);
            }

            $data['email'] = $payload['email'];
            $googleId = $payload['sub'];

            if (User::where('email', $data['email'])->exists()) {
                throw ValidationException::withMessages([
                    'email' => ['Un compte existe déjà avec cette adresse e-mail.'],
                ]);
            }
        }

        $plan = Plan::where('code', $data['plan_code'])->where('is_active', true)->firstOrFail();

        $user = DB::transaction(function () use ($data, $plan, $usingGoogle, $googleId) {
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
                'google_id' => $googleId,
                // A Google account never authenticates with this password —
                // it's an inert value satisfying the NOT NULL column, never
                // surfaced or checked anywhere for this account.
                'password' => $usingGoogle ? Str::random(40) : $data['password'],
                'is_active' => true,
            ]);
        });

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load(['role', 'shop', 'organization']),
        ], 201);
    }

    /**
     * "Se connecter avec Google" for an account that already exists. Looks
     * up the verified email; if found, links google_id (first time) and
     * logs in. If no account exists yet, tells the frontend so it can send
     * the visitor to registration instead — Google alone can't create an
     * organization, since it has no idea what business or shop to name.
     */
    public function googleLogin(Request $request)
    {
        $request->validate(['id_token' => ['required', 'string']]);

        try {
            $payload = $this->googleTokens->verify($request->string('id_token')->toString());
        } catch (UnexpectedValueException $e) {
            throw ValidationException::withMessages(['id_token' => [$e->getMessage()]]);
        }

        if (! $payload['email_verified']) {
            throw ValidationException::withMessages([
                'id_token' => ["L'adresse e-mail de ce compte Google n'est pas vérifiée."],
            ]);
        }

        $user = User::where('email', $payload['email'])->first();

        if (! $user) {
            return response()->json([
                'needs_registration' => true,
                'email' => $payload['email'],
                'name' => $payload['name'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages(['id_token' => ['Compte désactivé.']]);
        }

        if (! $user->google_id) {
            $user->update(['google_id' => $payload['sub']]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user->load(['role', 'shop']),
        ]);
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
