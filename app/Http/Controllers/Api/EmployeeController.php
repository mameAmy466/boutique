<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Employee::class);

        $actor = $request->user();

        $query = Employee::query();

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Employee::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', 'exists:shops,id'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez enregistrer un employé que pour votre propre boutique.');
        }

        return response()->json(Employee::create([...$data, 'status' => $data['status'] ?? 'active']), 201);
    }

    public function show(Request $request, Employee $employee)
    {
        $this->authorize('view', $employee);

        $payments = $employee->salaryPayments()->latest('expense_date')->get();

        return response()->json([
            ...$employee->toArray(),
            'salary_payments' => $payments,
            'total_paid_this_year' => round(
                (float) $payments->where('expense_date', '>=', now()->startOfYear()->toDateString())->sum('amount'),
                2,
            ),
        ]);
    }

    public function update(Request $request, Employee $employee)
    {
        $this->authorize('update', $employee);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $employee->update($data);

        return response()->json($employee);
    }

    public function destroy(Employee $employee)
    {
        $this->authorize('delete', $employee);

        if ($employee->salaryPayments()->exists()) {
            abort(422, "Cet employé a des paiements de salaire enregistrés : désactive-le plutôt que de le supprimer.");
        }

        $employee->delete();

        return response()->json(['message' => 'Employé supprimé.']);
    }
}
