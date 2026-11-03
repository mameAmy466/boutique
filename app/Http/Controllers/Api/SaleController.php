<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Sale;
use App\Models\Shop;
use App\Models\User;
use App\Services\SaleService;
use App\Support\TenantRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SaleController extends Controller
{
    public function __construct(private readonly SaleService $sales) {}

    public function index(Request $request)
    {
        $actor = $request->user();

        $query = Sale::query()->with(['items', 'invoice', 'user']);

        if (! $actor->isSuperAdmin()) {
            $query->where('shop_id', $actor->shop_id);
        } elseif ($request->filled('shop_id')) {
            $query->where('shop_id', $request->integer('shop_id'));
        }

        if ($request->filled('search')) {
            $needle = $request->string('search');
            $query->where(function ($q) use ($needle) {
                $q->where('sale_number', 'like', "%{$needle}%")
                    ->orWhere('customer_name', 'like', "%{$needle}%");
            });
        }

        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->string('payment_method'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->latest()->paginate(50)->withQueryString());
    }

    public function store(Request $request)
    {
        $this->authorize('create', Sale::class);

        $actor = $request->user();

        $data = $request->validate([
            'shop_id' => ['required', TenantRule::exists('shops')],
            'cash_session_id' => ['required', TenantRule::exists('cash_sessions')],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'payment_method' => ['required', Rule::in(Sale::PAYMENT_METHODS)],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_batch_id' => ['required', TenantRule::exists('product_batches')],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            // Selling below the minimum price: a manager confirms it himself,
            // or a cashier gets a manager to type their credentials.
            'confirm_below_min' => ['nullable', 'boolean'],
            'price_authorization' => ['nullable', 'array'],
            'price_authorization.email' => ['required_with:price_authorization', 'email'],
            'price_authorization.password' => ['required_with:price_authorization', 'string'],
        ]);

        if (! $actor->isSuperAdmin() && (int) $data['shop_id'] !== $actor->shop_id) {
            abort(403, 'Vous ne pouvez vendre que dans votre propre boutique.');
        }

        $cashSession = CashSession::findOrFail($data['cash_session_id']);

        if (! $cashSession->isOpen() || $cashSession->user_id !== $actor->id) {
            abort(422, 'Aucune session de caisse ouverte pour cet utilisateur.');
        }

        $shop = Shop::findOrFail($data['shop_id']);

        $sale = $this->sales->createSale(
            shop: $shop,
            cashier: $actor,
            cashSession: $cashSession,
            items: $data['items'],
            paymentMethod: $data['payment_method'],
            customerName: $data['customer_name'] ?? null,
            discount: $data['discount'] ?? 0,
            taxRate: $data['tax_rate'] ?? 18.00,
            priceAuthorizer: $this->priceAuthorizer($actor, $shop, $data),
        );

        return response()->json($sale, 201);
    }

    public function show(Sale $sale)
    {
        $this->authorize('view', $sale);

        return response()->json($sale->load(['priceAuthorizer:id,name', 'items.productBatch.product', 'invoice', 'user', 'cancelledByUser']));
    }

    public function cancel(Request $request, Sale $sale)
    {
        $this->authorize('cancel', $sale);

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ]);

        $sale = $this->sales->cancelSale($sale, $request->user(), $data['reason']);

        return response()->json($sale);
    }

    /**
     * The manager allowing prices below the minimum on this sale, if any:
     * the seller themself when they manage the shop and confirmed, or the
     * manager whose credentials were typed at the till. Wrong credentials
     * are refused outright rather than silently ignored.
     */
    private function priceAuthorizer(User $actor, Shop $shop, array $data): ?User
    {
        $canAuthorize = fn (User $user) => ($user->is_active ?? true)
            && $user->organization_id === $shop->organization_id
            && ($user->isSuperAdmin() || ($user->isShopAdmin() && $user->shop_id === $shop->id));

        if (! empty($data['confirm_below_min']) && $canAuthorize($actor)) {
            return $actor;
        }

        if (empty($data['price_authorization'])) {
            return null;
        }

        $manager = User::where('email', $data['price_authorization']['email'])->first();

        if (! $manager || ! Hash::check($data['price_authorization']['password'], $manager->password) || ! $canAuthorize($manager)) {
            throw ValidationException::withMessages([
                'price_authorization' => ['Autorisation refusée : il faut l’e-mail et le mot de passe d’un responsable de cette boutique.'],
            ]);
        }

        return $manager;
    }
}
