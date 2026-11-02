<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformAuditLog;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * The people who administer the platform. They belong to no organization
 * and have no shop role: only the is_platform_admin flag, which no client
 * screen or signup can set.
 */
class PlatformAdminController extends Controller
{
    public function index()
    {
        return response()->json(
            User::where('is_platform_admin', true)->orderBy('name')
                ->get(['id', 'name', 'email', 'is_active', 'created_at'])
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ], [
            'email.unique' => 'Un compte existe déjà avec cette adresse e-mail.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
        ]);

        $admin = User::create([
            ...$data,
            'organization_id' => null,
            'shop_id' => null,
            'role_id' => null,
            'is_platform_admin' => true,
            'is_active' => true,
        ]);

        PlatformAuditLog::record(null, 'platform_admin_created', "Administrateur de la plateforme ajouté : {$admin->name} ({$admin->email}).");

        return response()->json($admin->only(['id', 'name', 'email', 'is_active', 'created_at']), 201);
    }

    public function update(Request $request, User $admin)
    {
        abort_unless($admin->is_platform_admin, 404);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:8'],
        ]);

        if (array_key_exists('is_active', $data) && ! $data['is_active']) {
            abort_if($admin->id === $request->user()->id, 422, 'Vous ne pouvez pas désactiver votre propre compte.');
            abort_if(
                User::where('is_platform_admin', true)->where('is_active', true)->whereKeyNot($admin->id)->doesntExist(),
                422,
                'Il doit rester au moins un administrateur actif.',
            );
        }

        $admin->update($data);

        if (array_key_exists('is_active', $data) && ! $data['is_active']) {
            $admin->tokens()->delete();
        }

        PlatformAuditLog::record(null, 'platform_admin_updated', match (true) {
            array_key_exists('is_active', $data) => ($data['is_active'] ? 'Administrateur réactivé : ' : 'Administrateur désactivé : ').$admin->name.'.',
            array_key_exists('password', $data) => "Mot de passe de l'administrateur {$admin->name} réinitialisé.",
            default => "Administrateur {$admin->name} modifié.",
        });

        return response()->json($admin->only(['id', 'name', 'email', 'is_active', 'created_at']));
    }
}
