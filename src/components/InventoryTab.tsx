import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category, ProcessMovementResult } from '@/types';
import { tenantConfig } from '@/config/tenantConfig';
import { showToast } from '@/components/ToastContainer';
import { DashboardMetrics } from '@/components/DashboardMetrics';
import { SearchAndActions } from '@/components/SearchAndActions';
import { CategoryFilter } from '@/components/CategoryFilter';
import { ProductCard } from '@/components/ProductCard';
import { ProductFormModal, type ProductFormData } from '@/components/ProductFormModal';
import { SaleModal } from '@/components/SaleModal';
import { ScanModal } from '@/components/ScanModal';
import { exportProductsToExcel, parseExcelFile, downloadTemplate } from '@/lib/excel';
import { Plus, PackageX } from 'lucide-react';

interface InventoryTabProps {
  products: Product[];
  categories: Category[];
  onProductsChange: () => void;
  onCategoriesChange: () => void;
}

export function InventoryTab({
  products,
  categories,
  onProductsChange,
  onCategoriesChange,
}: InventoryTabProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [criticalFilter, setCriticalFilter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const totalValue = products.reduce(
    (sum, p) => sum + p.price_total * p.stock_current,
    0,
  );
  const totalSkus = products.length;
  const criticalCount = products.filter(
    (p) => p.stock_current === 0 && p.stock_min > 0,
  ).length;
  const lowStockCount = products.filter(
    (p) => p.stock_current <= p.stock_min,
  ).length;

  const filtered = products.filter((p) => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (criticalFilter && p.stock_current > p.stock_min) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStockChange = useCallback(
    async (product: Product, delta: number) => {
      const movementType = delta > 0 ? 'entrada' : 'salida';
      const { data, error } = await supabase.rpc('process_movement', {
        p_product_id: product.id,
        p_movement_type: movementType,
        p_quantity: Math.abs(delta),
        p_user_name: 'Operador',
        p_notes: delta > 0 ? 'Entrada rápida +1' : 'Salida rápida -1',
      });

      if (error || !data) {
        showToast('Error al actualizar stock', 'error');
        return;
      }

      const result = data as ProcessMovementResult;
      if (!result.success) {
        showToast(result.error || 'Error en el movimiento', 'error');
        return;
      }

      onProductsChange();
    },
    [onProductsChange],
  );

  const handleSaveProduct = async (data: ProductFormData) => {
    const payload = {
      sku: data.sku,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      brand: data.brand,
      category_id: data.category_id,
      location: data.location,
      stock_current: data.stock_current,
      stock_min: data.stock_min,
      price_net: data.price_total,
      tax_rate: tenantConfig.taxRate,
      price_total: data.price_total,
      price_sale: data.price_sale,
      weight_kg: data.weight_kg,
      image_url: data.image_url,
    };

    if (data.id) {
      const { error } = await supabase
        .from('products')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', data.id);
      if (error) {
        showToast(`Error: ${error.message}`, 'error');
        return;
      }
      showToast('Producto actualizado', 'success');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) {
        if (error.code === '23505') {
          showToast('SKU ya existe. Use uno diferente.', 'error');
        } else {
          showToast(`Error: ${error.message}`, 'error');
        }
        return;
      }
      showToast('Producto creado correctamente', 'success');
    }

    setShowForm(false);
    setEditProduct(null);
    onProductsChange();
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar "${product.name}" (${product.sku})?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      showToast('Error al eliminar producto', 'error');
    } else {
      showToast('Producto eliminado', 'success');
      onProductsChange();
    }
  };

  const handleCreateCategory = async (name: string) => {
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0);
    const { error } = await supabase.from('categories').insert({
      name,
      sort_order: maxOrder + 1,
    });
    if (error) {
      showToast('Error al crear categoría', 'error');
    } else {
      showToast('Categoría creada', 'success');
      onCategoriesChange();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      showToast('Error al eliminar categoría', 'error');
    } else {
      showToast('Categoría eliminada', 'success');
      onCategoriesChange();
    }
  };

  const handleBarcodeScan = useCallback(
    (code: string) => {
      const found = products.find(
        (p) =>
          p.barcode === code ||
          p.sku.toLowerCase() === code.toLowerCase(),
      );

      if (found) {
        showToast(`Encontrado: ${found.name} (SKU: ${found.sku})`, 'success');
        setSearch(found.sku);
      } else {
        showToast(`Código no encontrado: ${code}`, 'info');
        setSearch(code);
      }
      setShowScan(false);
    },
    [products],
  );

  const handleImport = async (file: File) => {
    showToast('Procesando archivo...', 'info');
    const result = await parseExcelFile(file);

    if (result.rows.length === 0) {
      showToast('No se encontraron filas válidas', 'error');
      return;
    }

    const taxRate = tenantConfig.taxRate / 100;
    const seenSkus = new Set<string>();
    const rowsToInsert: Array<Record<string, unknown>> = [];

    for (const row of result.rows) {
      const skuUpper = row.sku.toUpperCase();
      if (seenSkus.has(skuUpper)) continue;
      seenSkus.add(skuUpper);

      let categoryId: string | null = null;
      if (row.category_name) {
        const cat = categories.find(
          (c) => c.name.toLowerCase() === row.category_name!.toLowerCase(),
        );
        if (cat) categoryId = cat.id;
      }

      const priceTotal = Math.round(row.price_net * (1 + taxRate));

      rowsToInsert.push({
        sku: row.sku.toUpperCase(),
        barcode: row.barcode,
        name: row.name,
        description: row.description,
        brand: row.brand,
        category_id: categoryId,
        location: row.location,
        stock_current: row.stock_current,
        stock_min: row.stock_min,
        price_net: row.price_net,
        tax_rate: tenantConfig.taxRate,
        price_total: priceTotal,
        price_sale: row.price_sale,
        weight_kg: 0,
      });
    }

    const { data, error } = await supabase
      .from('products')
      .upsert(rowsToInsert, { onConflict: 'sku' });

    if (error) {
      showToast(`Error importación: ${error.message}`, 'error');
      return;
    }

    showToast(
      `${result.successCount} productos importados${result.errorCount > 0 ? `, ${result.errorCount} omitidos` : ''}`,
      'success',
    );

    if (result.errors.length > 0 && result.errors.length <= 5) {
      result.errors.forEach((err) => showToast(err, 'info'));
    }

    onProductsChange();
    void data;
  };

  return (
    <div className="space-y-4">
      <DashboardMetrics
        totalValue={totalValue}
        totalSkus={totalSkus}
        criticalCount={criticalCount}
        lowStockCount={lowStockCount}
        onCriticalClick={() => setCriticalFilter(!criticalFilter)}
        criticalFilterActive={criticalFilter}
      />

      <SearchAndActions
        search={search}
        onSearchChange={setSearch}
        onScanClick={() => setShowScan(true)}
        onImportClick={() => importFileRef.current?.click()}
        onExportClick={() => {
          if (products.length === 0) {
            showToast('No hay productos para exportar', 'info');
            return;
          }
          exportProductsToExcel(products);
          showToast('Inventario exportado', 'success');
        }}
        onTemplateClick={() => {
          downloadTemplate();
          showToast('Plantilla descargada', 'success');
        }}
        scanActive={showScan}
      />

      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImport(file);
            importFileRef.current!.value = '';
          }
        }}
      />

      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        onCreate={handleCreateCategory}
        onDelete={handleDeleteCategory}
      />

      {/* Add Product Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
          {criticalFilter && ' en stock crítico'}
        </p>
        <button
          onClick={() => {
            setEditProduct(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <PackageX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {search || criticalFilter
              ? 'No se encontraron productos con los filtros actuales'
              : 'No hay productos. Crea uno o importa desde Excel.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onStockChange={handleStockChange}
              onEdit={(p) => {
                setEditProduct(p);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              onSell={(p) => setSellProduct(p)}
            />
          ))}
        </div>
      )}

      <ProductFormModal
        open={showForm}
        initialData={
          editProduct
            ? {
                id: editProduct.id,
                sku: editProduct.sku,
                barcode: editProduct.barcode,
                name: editProduct.name,
                description: editProduct.description,
                brand: editProduct.brand,
                category_id: editProduct.category_id,
                location: editProduct.location,
                stock_current: editProduct.stock_current,
                stock_min: editProduct.stock_min,
                price_total: editProduct.price_total,
                price_sale: editProduct.price_sale,
                weight_kg: editProduct.weight_kg,
                image_url: editProduct.image_url,
              }
            : null
        }
        categories={categories}
        onSave={handleSaveProduct}
        onClose={() => {
          setShowForm(false);
          setEditProduct(null);
        }}
      />

      {sellProduct && (
        <SaleModal
          product={sellProduct}
          onClose={() => setSellProduct(null)}
          onSold={() => {
            onProductsChange();
            setSellProduct(null);
          }}
        />
      )}

      <ScanModal
        open={showScan}
        onClose={() => setShowScan(false)}
        onScan={handleBarcodeScan}
        products={products}
      />
    </div>
  );
}
