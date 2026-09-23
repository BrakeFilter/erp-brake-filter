/*
# ERP Expansion: Vehicle Compatibility, Suppliers, Purchase Orders, Company Settings, Product Dimensions

## Overview
Adds 4 new tables and new columns to existing products table.
Since the app now has authentication (email/password), new tables use authenticated-only RLS.
Existing tables keep their current policies unchanged.

## New Tables
1. vehicle_compatibilities — links products to vehicle brands/models/years/engines
2. suppliers — vendor directory with RUT, contact info, address
3. purchase_orders — orders sent to suppliers with JSONB items and status tracking
4. company_settings — single-row company config: name, logo, colors, font, active modules

## Modified Tables
- products: ADD barcode (TEXT, already exists from earlier migration so IF NOT EXISTS), height_cm, width_cm, length_cm, weight_kg (DECIMAL)
- NOTE: weight_kg was added in a prior migration as numeric; we use IF NOT EXISTS so this is safe.

## Security
- New tables: RLS enabled, authenticated-only CRUD with auth.uid() ownership via user_id columns.
- company_settings: authenticated-only (single shared row per company).
- Existing tables: no changes to existing policies.
*/

-- ========================================================
-- 1. vehicle_compatibilities
-- ========================================================
CREATE TABLE IF NOT EXISTS vehicle_compatibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  year_from int NOT NULL,
  year_to int NOT NULL,
  engine text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_compatibilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_vehicle_compat" ON vehicle_compatibilities;
CREATE POLICY "auth_select_vehicle_compat" ON vehicle_compatibilities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_insert_vehicle_compat" ON vehicle_compatibilities;
CREATE POLICY "auth_insert_vehicle_compat" ON vehicle_compatibilities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_update_vehicle_compat" ON vehicle_compatibilities;
CREATE POLICY "auth_update_vehicle_compat" ON vehicle_compatibilities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_delete_vehicle_compat" ON vehicle_compatibilities;
CREATE POLICY "auth_delete_vehicle_compat" ON vehicle_compatibilities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_compat_product ON vehicle_compatibilities(product_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_compat_brand_model ON vehicle_compatibilities(brand, model);

-- ========================================================
-- 2. suppliers
-- ========================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rut text,
  contact_name text,
  phone text,
  email text,
  address text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_suppliers" ON suppliers;
CREATE POLICY "auth_select_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_insert_suppliers" ON suppliers;
CREATE POLICY "auth_insert_suppliers" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_update_suppliers" ON suppliers;
CREATE POLICY "auth_update_suppliers" ON suppliers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_delete_suppliers" ON suppliers;
CREATE POLICY "auth_delete_suppliers" ON suppliers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========================================================
-- 3. purchase_orders
-- ========================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'enviada', 'recibida')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_select_purchase_orders" ON purchase_orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_insert_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_insert_purchase_orders" ON purchase_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_update_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_update_purchase_orders" ON purchase_orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_delete_purchase_orders" ON purchase_orders;
CREATE POLICY "auth_delete_purchase_orders" ON purchase_orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- ========================================================
-- 4. company_settings
-- ========================================================
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'BRAKE FILTER',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#DC2626',
  font_family text NOT NULL DEFAULT 'Inter',
  active_modules jsonb NOT NULL DEFAULT '{"inventario": true, "facturacion": true, "historial": true, "costos": true, "metricas": true, "vehiculos": true, "proveedores": true, "ordenes": true, "ajustes": true}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_company_settings" ON company_settings;
CREATE POLICY "auth_select_company_settings" ON company_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_insert_company_settings" ON company_settings;
CREATE POLICY "auth_insert_company_settings" ON company_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_update_company_settings" ON company_settings;
CREATE POLICY "auth_update_company_settings" ON company_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "auth_delete_company_settings" ON company_settings;
CREATE POLICY "auth_delete_company_settings" ON company_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========================================================
-- 5. Add product dimension columns (IF NOT EXISTS for idempotency)
-- ========================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm numeric DEFAULT 0;
-- weight_kg already exists from prior migration; safe with IF NOT EXISTS
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT 0;

-- Add unique constraint on barcode (only non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_barcode_key'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
  END IF;
END $$;

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_compatibilities;
ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE company_settings;
