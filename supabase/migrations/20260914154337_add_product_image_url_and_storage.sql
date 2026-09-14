/*
# Add image_url column to products + create product-images storage bucket

## Changes
1. Adds `image_url` (TEXT, nullable) column to `products` table for storing product photo URLs.
2. Creates a public storage bucket `product-images` for uploading product photos.
3. Sets storage policies to allow anon+authenticated to upload, read, and delete images (single-tenant demo).

## Security
- The new column is nullable — existing products are unaffected.
- Storage bucket is public (images readable by anyone with the URL).
- Upload/delete policies allow anon+authenticated (no-auth demo app).
*/

-- Add image_url column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

-- Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow anon + authenticated to manage product images
DROP POLICY IF EXISTS "anon_select_product_images" ON storage.objects;
CREATE POLICY "anon_select_product_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "anon_insert_product_images" ON storage.objects;
CREATE POLICY "anon_insert_product_images" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "anon_update_product_images" ON storage.objects;
CREATE POLICY "anon_update_product_images" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "anon_delete_product_images" ON storage.objects;
CREATE POLICY "anon_delete_product_images" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'product-images');
