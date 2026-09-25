-- B5+B6: Add unique constraints on barcode and sku, add deleted_at for soft-delete safety
-- Since products table has no deleted_at column, we add it for soft-delete filtering.
-- Then add UNIQUE indexes on barcode and sku WHERE deleted_at IS NULL (partial unique index).

-- Add deleted_at column to products (nullable, defaults to null = not deleted)
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial unique index on barcode (only for non-deleted rows)
DROP INDEX IF EXISTS idx_products_barcode_unique;
CREATE UNIQUE INDEX idx_products_barcode_unique ON products (barcode) 
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

-- Partial unique index on sku (only for non-deleted rows)  
-- sku already has a UNIQUE constraint from table creation. We need to drop it and replace with partial.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX idx_products_sku_unique ON products (sku)
  WHERE deleted_at IS NULL;

-- Add sale_items table for tracking individual sale line items (for "productos más vendidos")
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid REFERENCES movements(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  sale_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  net_margin numeric NOT NULL DEFAULT 0,
  sale_channel text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sale_items" ON sale_items;
CREATE POLICY "anon_select_sale_items" ON sale_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sale_items" ON sale_items;
CREATE POLICY "anon_insert_sale_items" ON sale_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sale_items" ON sale_items;
CREATE POLICY "anon_update_sale_items" ON sale_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sale_items" ON sale_items;
CREATE POLICY "anon_delete_sale_items" ON sale_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_created_at ON sale_items(created_at DESC);

-- Enable realtime for sale_items
ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;
