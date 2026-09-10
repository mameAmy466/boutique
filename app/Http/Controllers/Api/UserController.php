<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $actor = $request->user();

        $users = $actor->isSuperAdmin()
            ? User::query()->with(['role', 'shop'])->get()
            : User::query()->with(['role', 'shop'])->where('shop_id', $actor->shop_id)->get();

        return response()->json($users);
    }

    public function store(Request $request)
    {
        $this->authorize('create', User::class);

        $actor = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role_id' => ['required', 'exists:roles,id'],
            'shop_id' => ['nullable', 'exists:shops,id'],
        ]);

        // A shop admin may only create cashiers scoped to their own shop.
        if (! $actor->isSuperAdmin()) {
            $data['shop_id'] = $actor->shop_id;
        }

        $user = User::create($data);

        return response()->json($user->load(['role', 'shop']), 201);
    }

    public function show(Request $request, User $user)
    {
        $this->authorize('view', $user);

        return response()->json($user->load(['role', 'shop']));
    }

    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'role_id' => ['sometimes', 'exists:roles,id'],
            'shop_id' => ['sometimes', 'nullable', 'exists:shops,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user->update($data);

        return response()->json($user->load(['role', 'shop']));
    }

    public function destroy(Request $request, User $user)
    {
        $this->authorize('delete', $user);

        $user->update(['is_active' => false]);

        return response()->json(['message' => 'Utilisateur désactivé.']);
    }
}
