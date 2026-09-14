export interface CompanyConfig {
  id: string;
  company_name: string;
  subtitle: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  currency: string;
  currency_symbol: string;
  tax_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  location: string | null;
  stock_current: number;
  stock_min: number;
  price_net: number;
  tax_rate: number;
  price_total: number;
  price_sale: number;
  weight_kg: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  categories?: Category;
}

export type MovementType = 'entrada' | 'salida' | 'ajuste';
export type SaleChannel = 'directa' | 'mercadolibre';

export interface Movement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost: number;
  total_amount: number;
  user_name: string;
  notes: string | null;
  sale_channel: SaleChannel | null;
  sale_price: number;
  shipping_cost: number;
  commission: number;
  net_margin: number;
  created_at: string;
  products?: Product;
}

export type InvoiceStatus = 'por_pagar' | 'pagado';

export interface Invoice {
  id: string;
  folio: string;
  supplier: string;
  amount_total: number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseFrequency = 'puntual' | 'mensual';

export interface OperationalExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  expense_date: string;
  frequency: ExpenseFrequency;
  notes: string | null;
  created_at: string;
}

export interface ProcessMovementResult {
  success: boolean;
  product_id?: string;
  new_stock?: number;
  movement_type?: MovementType;
  quantity?: number;
  error?: string;
}

export type TabKey = 'inventario' | 'facturacion' | 'historial' | 'costos' | 'metricas';
