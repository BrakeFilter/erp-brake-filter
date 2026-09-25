/*
# Shipping rates table + weight kg→g conversion + Filtro de Polen category

1. New Tables
- `shipping_rates`: Mercado Libre shipping cost matrix
  - `id` (uuid, primary key)
  - `weight_min_g` (int, min weight in grams, inclusive)
  - `weight_max_g` (int, max weight in grams, inclusive)
  - `price_tier_1` (int, shipping cost for sales up to $89.990 CLP)
  - `price_tier_2` (int, shipping cost for sales $89.990–$119.990 CLP)
  - `price_tier_3` (int, shipping cost for sales from $119.990 CLP)
  - `created_at` (timestamptz)

2. Data Migrations
- Convert existing `products.weight_kg` values from kilograms to grams (multiply by 1000).
  Existing values like 0.5 kg become 500 g. Zero values stay zero.

3. New Category
- Insert "Filtro de Polen" category if it doesn't already exist.

4. Security
- Enable RLS on `shipping_rates`.
- Allow anon + authenticated CRUD (same pattern as all other tables in this project).
*/

-- 1. Create shipping_rates table
CREATE TABLE IF NOT EXISTS shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weight_min_g integer NOT NULL,
  weight_max_g integer NOT NULL,
  price_tier_1 integer NOT NULL,
  price_tier_2 integer NOT NULL,
  price_tier_3 integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_shipping_rates" ON shipping_rates;
CREATE POLICY "anon_select_shipping_rates" ON shipping_rates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_shipping_rates" ON shipping_rates;
CREATE POLICY "anon_insert_shipping_rates" ON shipping_rates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_shipping_rates" ON shipping_rates;
CREATE POLICY "anon_update_shipping_rates" ON shipping_rates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_shipping_rates" ON shipping_rates;
CREATE POLICY "anon_delete_shipping_rates" ON shipping_rates FOR DELETE
  TO anon, authenticated USING (true);

-- 2. Insert shipping rate data (all weights in grams, prices in CLP)
INSERT INTO shipping_rates (weight_min_g, weight_max_g, price_tier_1, price_tier_2, price_tier_3) VALUES
  (0, 300, 3910, 3120, 5180),
  (301, 500, 3910, 3120, 5180),
  (501, 1000, 3910, 3120, 5180),
  (1001, 2000, 3970, 3130, 5420),
  (2001, 3000, 3900, 3100, 5880),
  (3001, 4000, 3140, 3140, 5880),
  (4001, 5000, 3150, 3140, 6420),
  (5001, 6000, 3150, 3140, 6820),
  (6001, 7000, 3170, 3160, 7220),
  (7001, 8000, 3170, 3160, 7220),
  (8001, 9000, 3170, 3160, 7220),
  (9001, 10000, 3240, 3240, 10020),
  (10001, 20000, 3240, 3260, 10100),
  (20001, 30000, 3260, 3360, 10100),
  (30001, 40000, 3280, 3360, 7700),
  (40001, 50000, 3280, 3360, 7700),
  (50001, 60000, 3280, 3360, 10120),
  (60001, 70000, 3280, 3740, 10120),
  (70001, 80000, 3980, 3980, 10120),
  (80001, 90000, 3980, 3980, 10320),
  (90001, 100000, 3780, 3780, 10320),
  (100001, 110000, 3980, 3980, 9840),
  (110001, 120000, 3980, 3780, 9480),
  (120001, 140000, 3460, 3780, 9140),
  (140001, 170000, 3470, 3780, 9140),
  (170001, 200000, 3760, 3870, 8820),
  (200001, 230000, 3910, 3870, 8760),
  (230001, 270000, 3910, 10180, 9760),
  (270001, 300000, 3780, 10180, 9840)
ON CONFLICT DO NOTHING;

-- 3. Convert existing weight_kg values to grams (multiply by 1000)
-- Only convert values that are still in kg range (< 100, since 100kg = 100000g)
UPDATE products
SET weight_kg = weight_kg * 1000
WHERE weight_kg > 0 AND weight_kg < 100;

-- 4. Insert "Filtro de Polen" category if it doesn't exist
INSERT INTO categories (name, sort_order)
SELECT 'Filtro de Polen', COALESCE(MAX(sort_order), 0) + 1
FROM categories
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Filtro de Polen');
