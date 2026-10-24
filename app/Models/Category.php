<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use BelongsToOrganization, HasFactory;

    protected $fillable = ['organization_id', 'name', 'description'];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
