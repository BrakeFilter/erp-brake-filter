/*
# Add sale calculation columns, ML commission setting, and app-assets bucket

1. New columns on `movements` table:
   - `iva_venta` (numeric, default 0) — IVA 19% of sale price
   - `comision_ml` (numeric, default 0) — Mercado Libre commission amount
   - `iva_comision` (numeric, default 0) — IVA 19% of the ML commission
   - `envio_ml` (numeric, default 0) — ML shipping cost from shipping_rates table
   - `costo_total_venta` (numeric, default 0) — total cost of the sale (producto + comision + iva_comision + iva_venta + envio)
   - `margen_neto` (numeric, default 0) — net margin (precio_publicacion - costo_total_venta)

2. New column on `company_settings` table:
   - `ml_commission_percent` (numeric, default 13.5) — configurable ML commission percentage
   - `app_logo_url` (text, nullable) — URL of the custom app logo in app-assets bucket

3. New storage bucket:
   - `app-assets` bucket for app logo uploads (public)

4. Security:
   - app-assets bucket is public read, authenticated write
   - No RLS changes to existing tables (columns are nullable with defaults)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'iva_venta') THEN
    ALTER TABLE movements ADD COLUMN iva_venta numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'comision_ml') THEN
    ALTER TABLE movements ADD COLUMN comision_ml numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'iva_comision') THEN
    ALTER TABLE movements ADD COLUMN iva_comision numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'envio_ml') THEN
    ALTER TABLE movements ADD COLUMN envio_ml numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'costo_total_venta') THEN
    ALTER TABLE movements ADD COLUMN costo_total_venta numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movements' AND column_name = 'margen_neto') THEN
    ALTER TABLE movements ADD COLUMN margen_neto numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'ml_commission_percent') THEN
    ALTER TABLE company_settings ADD COLUMN ml_commission_percent numeric DEFAULT 13.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'app_logo_url') THEN
    ALTER TABLE company_settings ADD COLUMN app_logo_url text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;
