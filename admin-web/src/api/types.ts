export type RoleSlug = 'super_admin' | 'admin_boutique' | 'caissier';

export interface Role {
  id: number;
  name: string;
  slug: RoleSlug;
}

export interface Shop {
  id: number;
  name: string;
  code: string;
  description: string | null;
  manager_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  monthly_budget: string;
  sales_target: string | null;
  low_stock_alert_threshold: number;
  status: 'active' | 'suspended' | 'closed' | 'archived';
}

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  shop_id: number | null;
  is_active: boolean;
  role: Role | null;
  shop: Shop | null;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface Product {
  id: number;
  name: string;
  reference: string;
  category_id: number | null;
  supplier_id: number | null;
  brand: string | null;
  unit: string;
  image_path: string | null;
  image_url: string | null;
  min_stock: number;
  max_stock: number | null;
  status: 'active' | 'inactive';
  category?: Category | null;
  supplier?: Supplier | null;
}

export interface ProductBatch {
  id: number;
  batch_code: string;
  product_id: number;
  shop_id: number;
  supplier_id: number | null;
  purchase_cost: string;
  additional_costs: string;
  cost_price: string;
  min_profit_amount: string;
  min_price: string;
  quantity_received: number;
  quantity_available: number;
  received_at: string;
  received_by: number | null;
  product?: Product;
  shop?: Shop;
  supplier?: Supplier | null;
  received_by_user?: Pick<User, 'id' | 'name'> | null;
}

export type StockMovementType =
  | 'entry'
  | 'sale'
  | 'transfer_out'
  | 'transfer_in'
  | 'damage'
  | 'loss'
  | 'theft'
  | 'expiration'
  | 'adjustment'
  | 'return'
  | 'price_correction'
  | 'deletion';

export interface UserActivityMovement {
  id: number;
  type: StockMovementType;
  quantity: number;
  amount: number;
  created_at: string;
  product_name: string | null;
}

export interface UserActivitySale {
  id: number;
  sale_number: string;
  customer_name: string | null;
  payment_method: PaymentMethod;
  status: Sale['status'];
  total: number;
  created_at: string;
}

export interface UserActivityStock {
  id: number;
  batch_code: string;
  product_name: string | null;
  quantity: number;
  amount: number;
  received_at: string | null;
}

export interface UserActivity {
  sales: { count: number; amount: number; rows: UserActivitySale[] };
  stocks: { count: number; amount: number; rows: UserActivityStock[] };
  cash: {
    sessions: number;
    open: boolean;
    register_name: string | null;
    amount: number;
    opening_amount: number;
  };
  movements: { count: number; amount: number };
  recent_movements: UserActivityMovement[];
}

export interface StockMovement {
  id: number;
  product_batch_id: number;
  shop_id: number;
  type: StockMovementType;
  quantity: number;
  note: string | null;
  user_id: number | null;
  created_at: string;
  product_batch?: (Pick<ProductBatch, 'batch_code'> & { product?: Pick<Product, 'name'> }) | null;
  shop?: Shop;
  user?: Pick<User, 'id' | 'name'> | null;
}

export interface CashRegister {
  id: number;
  shop_id: number;
  name: string;
}

export interface CashSession {
  id: number;
  cash_register_id: number;
  user_id: number;
  opening_amount: string;
  opened_at: string;
  closing_amount: string | null;
  expected_amount: string | null;
  difference: string | null;
  closed_at: string | null;
  status: 'open' | 'closed';
  cash_register?: CashRegister & { shop?: Shop };
  user?: User;
  sales_count?: number;
  sales_sum_total?: string | null;
}

export type PaymentMethod = 'cash' | 'card' | 'wave' | 'orange_money' | 'free_money' | 'transfer' | 'other';

export interface SaleItem {
  id: number;
  sale_id: number;
  product_batch_id: number;
  quantity: number;
  returned_quantity: number;
  cost_price: string;
  min_price: string;
  unit_price: string;
  line_total: string;
  product_batch?: ProductBatch;
}

export interface Invoice {
  id: number;
  sale_id: number;
  invoice_number: string;
  issued_at: string;
}

export interface Sale {
  id: number;
  sale_number: string;
  shop_id: number;
  user_id: number;
  cash_session_id: number;
  customer_name: string | null;
  subtotal: string;
  discount: string;
  total: string;
  payment_method: PaymentMethod;
  status: 'completed' | 'cancelled' | 'returned' | 'partially_returned';
  created_at: string;
  items?: SaleItem[];
  invoice?: Invoice | null;
  user?: User;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface SalesTrendPoint {
  date: string;
  total: number;
}

export interface TopProduct {
  product_id: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface ShopComparisonRow {
  shop_id: number;
  name: string;
  revenue: number;
  profit: number;
}

export interface DashboardFigures {
  revenue: { today: number; this_week: number; this_month: number; this_year: number };
  gross_profit: number;
  shops?: { total: number; active: number };
  stock: { value: number; out_of_stock_batches: number };
  cash_sessions: { open: number };
  alerts: { low_stock: number; out_of_stock: number };
  shop?: { id: number; name: string; code: string };
  sales_trend: SalesTrendPoint[];
  top_products: TopProduct[];
  shops_comparison?: ShopComparisonRow[];
}

export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
  min_price?: number;
  attempted_price?: number;
  available?: number;
  requested?: number;
}
