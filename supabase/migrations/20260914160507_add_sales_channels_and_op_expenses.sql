/*
# ERP Update: Weight, Sales Channels, Operational Expenses

## Changes
1. products: Add `weight_kg` (numeric, nullable) for shipping calculations.
2. movements: Add sale-related columns — `sale_channel`, `sale_price`, `shipping_cost`, `commission`, `net_margin`.
3. operational_expenses: New table for non-inventory costs (packaging, rent, services, etc.).

## Security
- RLS enabled on operational_expenses with anon+authenticated CRUD (single-tenant demo).
*/

-- 1. Add weight_kg to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT 0;

-- 2. Add sale fields to movements
ALTER TABLE movements ADD COLUMN IF NOT EXISTS sale_channel text;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS sale_price numeric DEFAULT 0;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS commission numeric DEFAULT 0;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS net_margin numeric DEFAULT 0;

-- 3. Create operational_expenses table
CREATE TABLE IF NOT EXISTS operational_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  frequency text NOT NULL DEFAULT 'puntual' CHECK (frequency IN ('puntual', 'mensual')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE operational_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_op_expenses" ON operational_expenses;
CREATE POLICY "anon_select_op_expenses" ON operational_expenses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_op_expenses" ON operational_expenses;
CREATE POLICY "anon_insert_op_expenses" ON operational_expenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_op_expenses" ON operational_expenses;
CREATE POLICY "anon_update_op_expenses" ON operational_expenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_op_expenses" ON operational_expenses;
CREATE POLICY "anon_delete_op_expenses" ON operational_expenses FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_op_expenses_date ON operational_expenses(expense_date DESC);

-- Enable Realtime for operational_expenses
ALTER PUBLICATION supabase_realtime ADD TABLE operational_expenses;
