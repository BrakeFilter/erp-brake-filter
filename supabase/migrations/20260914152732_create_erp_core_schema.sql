/*
# BRAKE FILTER ERP — Core Schema

## Overview
Creates the foundational database schema for a modular ERP system adapted for "BRAKE FILTER".
This is a single-tenant demo (no auth), so all tables use anon+authenticated policies with USING(true)
since the data is intentionally shared within the company.

## Tables
1. company_config — company identity, branding, tax parameters (single row)
2. categories — inventory/spare-part categories
3. products — SKUs with barcode, brand, stock, pricing (net, IVA, total)
4. movements — stock entries/exits/adjustments with precise timestamps
5. invoices — supplier invoices with folio, amounts, dates, status, attachment URL

## RPC
- process_movement — atomic stock adjustment: validates product exists, updates stock,
  inserts a movement audit row, all within a single transaction-safe PL/pgSQL block.

## Security
- RLS enabled on all tables.
- Policies allow anon+authenticated full CRUD (single-tenant shared data).
*/

-- ========================================================
-- 1. company_config
-- ========================================================
CREATE TABLE IF NOT EXISTS company_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'BRAKE FILTER',
  subtitle text NOT NULL DEFAULT 'CONTROL DE BODEGA & ERP',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#DC2626',
  secondary_color text NOT NULL DEFAULT '#1E293B',
  currency text NOT NULL DEFAULT 'CLP',
  currency_symbol text NOT NULL DEFAULT '$',
  tax_rate numeric NOT NULL DEFAULT 19.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_company_config" ON company_config;
CREATE POLICY "anon_select_company_config" ON company_config FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_company_config" ON company_config;
CREATE POLICY "anon_insert_company_config" ON company_config FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_company_config" ON company_config;
CREATE POLICY "anon_update_company_config" ON company_config FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_company_config" ON company_config;
CREATE POLICY "anon_delete_company_config" ON company_config FOR DELETE
  TO anon, authenticated USING (true);

-- ========================================================
-- 2. categories
-- ========================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- ========================================================
-- 3. products
-- ========================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  barcode text,
  name text NOT NULL,
  description text,
  brand text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  location text,
  stock_current int NOT NULL DEFAULT 0,
  stock_min int NOT NULL DEFAULT 0,
  price_net numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 19.0,
  price_total numeric NOT NULL DEFAULT 0,
  price_sale numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- ========================================================
-- 4. movements
-- ========================================================
CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste')),
  quantity int NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  user_name text NOT NULL DEFAULT 'Sistema',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_movements" ON movements;
CREATE POLICY "anon_select_movements" ON movements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_movements" ON movements;
CREATE POLICY "anon_insert_movements" ON movements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_movements" ON movements;
CREATE POLICY "anon_update_movements" ON movements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_movements" ON movements;
CREATE POLICY "anon_delete_movements" ON movements FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_movements_product_id ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);

-- ========================================================
-- 5. invoices
-- ========================================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL,
  supplier text NOT NULL,
  amount_total numeric NOT NULL DEFAULT 0,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'por_pagar' CHECK (status IN ('por_pagar', 'pagado')),
  attachment_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invoices" ON invoices;
CREATE POLICY "anon_select_invoices" ON invoices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_invoices" ON invoices;
CREATE POLICY "anon_insert_invoices" ON invoices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_invoices" ON invoices;
CREATE POLICY "anon_delete_invoices" ON invoices FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ========================================================
-- RPC: process_movement
-- Atomic stock adjustment + audit trail
-- ========================================================
CREATE OR REPLACE FUNCTION process_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity int,
  p_user_name text DEFAULT 'Sistema',
  p_notes text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
  v_new_stock int;
  v_unit_cost numeric;
  v_total_amount numeric;
BEGIN
  -- Validate movement type
  IF p_movement_type NOT IN ('entrada', 'salida', 'ajuste') THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de movimiento inválido');
  END IF;

  -- Fetch product
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Producto no encontrado');
  END IF;

  v_unit_cost := COALESCE(v_product.price_total, 0);

  -- Calculate new stock
  IF p_movement_type = 'entrada' THEN
    v_new_stock := v_product.stock_current + p_quantity;
  ELSIF p_movement_type = 'salida' THEN
    v_new_stock := GREATEST(v_product.stock_current - p_quantity, 0);
  ELSIF p_movement_type = 'ajuste' THEN
    v_new_stock := GREATEST(p_quantity, 0);
  END IF;

  v_total_amount := v_unit_cost * p_quantity;

  -- Update product stock
  UPDATE products
    SET stock_current = v_new_stock, updated_at = now()
    WHERE id = p_product_id;

  -- Insert audit movement
  INSERT INTO movements (product_id, movement_type, quantity, unit_cost, total_amount, user_name, notes)
  VALUES (p_product_id, p_movement_type, p_quantity, v_unit_cost, v_total_amount, p_user_name, p_notes);

  RETURN json_build_object(
    'success', true,
    'product_id', p_product_id,
    'new_stock', v_new_stock,
    'movement_type', p_movement_type,
    'quantity', p_quantity
  );
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION process_movement(uuid, text, int, text, text) TO anon, authenticated;

-- ========================================================
-- Seed default categories
-- ========================================================
INSERT INTO categories (name, sort_order) VALUES
  ('Filtros de Aire', 1),
  ('Filtros de Aceite', 2),
  ('Filtros de Combustible', 3),
  ('Pastillas de Freno', 4),
  ('Discos de Freno', 5),
  ('Líquidos & Aditivos', 6)
ON CONFLICT DO NOTHING;

-- Seed default company config if empty
INSERT INTO company_config (company_name, subtitle)
SELECT 'BRAKE FILTER', 'CONTROL DE BODEGA & ERP'
WHERE NOT EXISTS (SELECT 1 FROM company_config);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE movements;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
