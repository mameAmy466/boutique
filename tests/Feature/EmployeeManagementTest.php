<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeManagementTest extends TestCase
{
    use RefreshDatabase;

    private function makeShopWithAdmin(): array
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::ADMIN_BOUTIQUE], ['name' => Role::ADMIN_BOUTIQUE]);
        $admin = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        return compact('shop', 'admin');
    }

    public function test_a_shop_admin_can_register_and_update_an_employee(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();

        $create = $this->actingAs($admin, 'sanctum')->postJson('/api/employees', [
            'shop_id' => $shop->id,
            'name' => 'Awa Diop',
            'position' => 'Caissière',
            'phone' => '771234567',
            'hire_date' => '2025-01-10',
            'base_salary' => 100000,
        ]);

        $create->assertCreated();
        $this->assertSame('active', $create->json('status'));

        $update = $this->actingAs($admin, 'sanctum')->putJson("/api/employees/{$create->json('id')}", [
            'base_salary' => 120000,
            'status' => 'inactive',
        ]);

        $update->assertOk();
        $this->assertSame('120000.00', $update->json('base_salary'));
        $this->assertSame('inactive', $update->json('status'));
    }

    public function test_a_cashier_cannot_register_an_employee(): void
    {
        $shop = Shop::create(['name' => 'Boutique A', 'code' => 'BTA']);
        $role = Role::firstOrCreate(['slug' => Role::CAISSIER], ['name' => Role::CAISSIER]);
        $cashier = User::factory()->create(['role_id' => $role->id, 'shop_id' => $shop->id]);

        $this->actingAs($cashier, 'sanctum')->postJson('/api/employees', [
            'shop_id' => $shop->id,
            'name' => 'Awa Diop',
        ])->assertStatus(403);
    }

    public function test_a_shop_admin_cannot_register_an_employee_for_another_shop(): void
    {
        ['admin' => $admin] = $this->makeShopWithAdmin();
        $otherShop = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/employees', [
            'shop_id' => $otherShop->id,
            'name' => 'Awa Diop',
        ])->assertStatus(403);
    }

    public function test_recording_a_salary_payment_requires_a_registered_employee(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'amount' => 100000,
            'expense_date' => now()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_recording_a_salary_payment_links_the_employee_and_shows_in_their_history(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();
        $employee = Employee::create(['shop_id' => $shop->id, 'name' => 'Awa Diop', 'base_salary' => 100000]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'employee_id' => $employee->id,
            'amount' => 100000,
            'expense_date' => now()->toDateString(),
        ]);

        $response->assertCreated();
        $this->assertSame($employee->id, $response->json('employee_id'));
        $this->assertSame('Awa Diop', $response->json('employee.name'));

        $fiche = $this->actingAs($admin, 'sanctum')->getJson("/api/employees/{$employee->id}");
        $fiche->assertOk();
        $this->assertCount(1, $fiche->json('salary_payments'));
        $this->assertSame(100000.0, (float) $fiche->json('total_paid_this_year'));

        $this->assertDatabaseHas('journal_entries', ['source_type' => \App\Models\Expense::class, 'source_id' => $response->json('id')]);
    }

    public function test_an_employee_cannot_be_linked_to_a_non_salary_expense(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();
        $employee = Employee::create(['shop_id' => $shop->id, 'name' => 'Awa Diop']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'loyer',
            'employee_id' => $employee->id,
            'amount' => 50000,
            'expense_date' => now()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_an_employee_from_another_shop_cannot_be_linked(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();
        $otherShop = Shop::create(['name' => 'Boutique B', 'code' => 'BTB']);
        $employee = Employee::create(['shop_id' => $otherShop->id, 'name' => 'Awa Diop']);

        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'employee_id' => $employee->id,
            'amount' => 100000,
            'expense_date' => now()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_editing_the_amount_of_an_existing_salary_payment_does_not_require_resending_the_employee(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();
        $employee = Employee::create(['shop_id' => $shop->id, 'name' => 'Awa Diop']);

        $expense = $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'employee_id' => $employee->id,
            'amount' => 100000,
            'expense_date' => now()->toDateString(),
        ])->json();

        $update = $this->actingAs($admin, 'sanctum')->putJson("/api/expenses/{$expense['id']}", [
            'amount' => 110000,
        ]);

        $update->assertOk();
        $this->assertSame($employee->id, $update->json('employee_id'));
    }

    public function test_an_employee_with_salary_payments_cannot_be_deleted(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();
        $employee = Employee::create(['shop_id' => $shop->id, 'name' => 'Awa Diop']);
        $this->actingAs($admin, 'sanctum')->postJson('/api/expenses', [
            'shop_id' => $shop->id,
            'category' => 'salaires',
            'employee_id' => $employee->id,
            'amount' => 100000,
            'expense_date' => now()->toDateString(),
        ]);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/employees/{$employee->id}")->assertStatus(422);
        $this->assertDatabaseHas('employees', ['id' => $employee->id]);
    }

    public function test_an_employee_without_salary_payments_can_be_deleted(): void
    {
        ['shop' => $shop, 'admin' => $admin] = $this->makeShopWithAdmin();
        $employee = Employee::create(['shop_id' => $shop->id, 'name' => 'Awa Diop']);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/employees/{$employee->id}")->assertOk();
        $this->assertDatabaseMissing('employees', ['id' => $employee->id]);
    }
}
