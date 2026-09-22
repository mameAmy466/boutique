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
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms_days: number | null;
}

export interface SupplierFiche extends Supplier {
  debts: SupplierDebt[];
  total_debt: number;
  consolidated: boolean;
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
  cancellation_reason?: string | null;
  cancelled_by?: number | null;
  cancelled_at?: string | null;
  items?: SaleItem[];
  invoice?: Invoice | null;
  user?: User;
  cancelled_by_user?: Pick<User, 'id' | 'name'> | null;
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

export type ExpenseCategory =
  | 'loyer'
  | 'electricite'
  | 'eau'
  | 'internet'
  | 'transport'
  | 'salaires'
  | 'fournitures'
  | 'marketing'
  | 'taxes'
  | 'autre';

export interface Expense {
  id: number;
  shop_id: number;
  category: ExpenseCategory;
  label: string | null;
  amount: string;
  payment_method: PaymentMethod;
  expense_date: string;
  note: string | null;
  created_by: number | null;
  created_at: string;
  created_by_user?: Pick<User, 'id' | 'name'> | null;
}

export interface Customer {
  id: number;
  shop_id: number;
  name: string;
  tax_id: string | null;
  phone: string | null;
  address: string | null;
  payment_terms_days: number | null;
  credit_limit: string | null;
  note: string | null;
}

export interface CustomerFiche extends Customer {
  debts: ClientDebt[];
  total_debt: number;
  credit_available: number | null;
}

export type DebtStatus = 'pending' | 'partial' | 'paid';

export interface DebtPayment {
  id: number;
  amount: string;
  paid_at: string;
  note: string | null;
  created_by: number | null;
}

export interface SupplierDebt {
  id: number;
  shop_id: number;
  supplier_id: number;
  amount: string;
  due_date: string | null;
  note: string | null;
  created_at: string;
  paid_amount: number;
  remaining: number;
  status: DebtStatus;
  supplier?: Supplier;
  created_by_user?: Pick<User, 'id' | 'name'> | null;
}

export interface ClientDebt {
  id: number;
  shop_id: number;
  customer_id: number;
  amount: string;
  due_date: string | null;
  note: string | null;
  created_at: string;
  paid_amount: number;
  remaining: number;
  status: DebtStatus;
  customer?: Customer;
  created_by_user?: Pick<User, 'id' | 'name'> | null;
}

export type CashflowGroupBy = 'day' | 'week' | 'month' | 'year';

export interface CashflowBucket {
  period: string;
  entrees: number;
  sorties: number;
  net: number;
}

export type AccountType = 'actif' | 'passif' | 'tresorerie' | 'charge' | 'produit';

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  is_active: boolean;
}

export interface AccountingJournal {
  id: number;
  code: string;
  name: string;
}

export type AccountingEvent =
  | 'sale'
  | 'expense'
  | 'supplier_debt_created'
  | 'supplier_debt_payment'
  | 'client_debt_created'
  | 'client_debt_payment';

export interface AccountingRule {
  id: number;
  event: AccountingEvent;
  category: ExpenseCategory | null;
  dynamic_leg: 'debit' | 'credit' | null;
  dynamic_journal: boolean;
  debit_account_id: number | null;
  credit_account_id: number | null;
  journal_id: number | null;
  note: string | null;
  debit_account?: Account | null;
  credit_account?: Account | null;
  journal?: AccountingJournal | null;
}

export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  debit: string;
  credit: string;
  label: string | null;
  account?: Account;
}

export interface JournalEntry {
  id: number;
  journal_id: number;
  shop_id: number;
  entry_date: string;
  reference: string | null;
  label: string;
  source_type: string | null;
  source_id: number | null;
  created_by: number | null;
  journal?: AccountingJournal;
  shop?: Shop;
  lines?: JournalEntryLine[];
  created_by_user?: Pick<User, 'id' | 'name'> | null;
}

export interface AccountLedgerMovement {
  entry_id: number;
  entry_date: string;
  reference: string | null;
  label: string;
  journal_code: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountLedger {
  account: Account;
  from: string | null;
  to: string | null;
  opening_balance: number;
  movements: AccountLedgerMovement[];
  closing_balance: number;
}

export interface TrialBalanceRow {
  account: Pick<Account, 'id' | 'code' | 'name' | 'type'>;
  opening_balance: number;
  debit: number;
  credit: number;
  closing_balance: number;
}

export interface TrialBalanceTotals {
  opening_balance: number;
  debit: number;
  credit: number;
  closing_balance: number;
}

export interface TrialBalance {
  from: string | null;
  to: string | null;
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotals;
}
