export interface Me {
  id: number;
  email: string;
  full_name: string;
  branch_id: number | null;
  role: string;
  permissions: string[];
}
export interface Branch { id: number; code: string; name: string; branch_type: string }
export interface Period { id: number; code: string; start_date: string; end_date: string; status: "OPEN" | "CLOSED" }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }

export interface Overview {
  as_of: string;
  kpis: {
    net_revenue: string;
    net_revenue_change_pct: number | null;
    gross_margin_pct: string;
    prev_gross_margin_pct: string;
    net_income: string;
    inventory_value: string;
    overdue_receivables: string;
    total_receivables: string;
    low_stock_count: number;
    cash_balance: string;
  };
  trend: { month: string; revenue: string; cogs: string; gross_profit: string; cash_in: string; cash_out: string; net_cash: string }[];
  sales_by_category: { category: string; amount: string }[];
  recent_activity: { id: number; action: string; entity_type: string; entity_id: string | null; user: string; created_at: string }[];
}
