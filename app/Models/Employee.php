<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'name',
        'position',
        'phone',
        'address',
        'hire_date',
        'base_salary',
        'status',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'base_salary' => 'decimal:2',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    /**
     * Salary payments are plain Expense rows (category 'salaires') tagged
     * with this employee, so they flow through the existing expense
     * accounting rule (661) without a parallel bookkeeping path.
     */
    public function salaryPayments(): HasMany
    {
        return $this->hasMany(Expense::class);
    }
}
