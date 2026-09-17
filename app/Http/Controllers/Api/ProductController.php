<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json(Product::query()->with(['category', 'supplier'])->get());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Product::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'reference' => ['required', 'string', 'max:100', 'unique:products,reference'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'brand' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'unit' => ['nullable', 'string', 'max:50'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'max_stock' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:active,inactive'],
            'image' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('products', 'public');
        }
        unset($data['image']);

        $product = Product::create($data);

        return response()->json($product, 201);
    }

    public function show(Product $product)
    {
        return response()->json($product->load(['category', 'supplier']));
    }

    public function update(Request $request, Product $product)
    {
        $this->authorize('update', $product);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'reference' => ['sometimes', 'string', 'max:100', Rule::unique('products', 'reference')->ignore($product->id)],
            'category_id' => ['nullable', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'brand' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'unit' => ['nullable', 'string', 'max:50'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'max_stock' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:active,inactive'],
            'image' => ['nullable', 'image', 'max:4096'],
        ]);

        if ($request->hasFile('image')) {
            if ($product->image_path) {
                Storage::disk('public')->delete($product->image_path);
            }
            $data['image_path'] = $request->file('image')->store('products', 'public');
        }
        unset($data['image']);

        $product->update($data);

        return response()->json($product);
    }

    public function uploadImage(Request $request, Product $product)
    {
        $this->authorize('update', $product);

        $request->validate([
            'image' => ['required', 'image', 'max:4096'],
        ]);

        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $product->update([
            'image_path' => $request->file('image')->store('products', 'public'),
        ]);

        return response()->json($product->fresh(['category', 'supplier']));
    }

    public function destroy(Product $product)
    {
        $this->authorize('delete', $product);

        $product->delete();

        return response()->json(['message' => 'Produit supprimé.']);
    }
}
