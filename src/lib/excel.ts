import * as XLSX from 'xlsx';
import type { Product } from '@/types';

interface ParsedRow {
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  location: string | null;
  stock_current: number;
  stock_min: number;
  price_net: number;
  price_sale: number;
  category_name: string | null;
}

const COLUMN_SYNONYMS: Record<string, keyof ParsedRow> = {
  sku: 'sku',
  codigo: 'sku',
  cod: 'sku',
  code: 'sku',
  'codigo interno': 'sku',
  'codigo sku': 'sku',
  barcode: 'barcode',
  'codigo de barras': 'barcode',
  'cod barras': 'barcode',
  ean: 'barcode',
  nombre: 'name',
  producto: 'name',
  descripcion: 'description',
  description: 'description',
  marca: 'brand',
  brand: 'brand',
  ubicacion: 'location',
  location: 'location',
  pasillo: 'location',
  stock: 'stock_current',
  'stock actual': 'stock_current',
  existencia: 'stock_current',
  cantidad: 'stock_current',
  'stock minimo': 'stock_min',
  minimostock: 'stock_min',
  'stock min': 'stock_min',
  'precio compra': 'price_net',
  costo: 'price_net',
  'precio neto': 'price_net',
  price: 'price_net',
  cost: 'price_net',
  'precio venta': 'price_sale',
  'precio de venta': 'price_sale',
  venta: 'price_sale',
  saleprice: 'price_sale',
  categoria: 'category_name',
  category: 'category_name',
  rubro: 'category_name',
};

function sanitizeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\s+/g, ' ');
}

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val)
    .replace(/[$\s]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function mapRow(row: Record<string, unknown>): ParsedRow {
  const mapped: Partial<ParsedRow> = {};
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().trim();
    const target = COLUMN_SYNONYMS[normalized];
    if (target) {
      const value = row[key];
      if (target === 'barcode') {
        const bc = sanitizeString(value);
        mapped[target] = bc || null;
      } else if (
        target === 'stock_current' ||
        target === 'stock_min' ||
        target === 'price_net' ||
        target === 'price_sale'
      ) {
        mapped[target] = parseNumber(value);
      } else {
        (mapped as Record<string, unknown>)[target] = sanitizeString(value);
      }
    }
  }
  return {
    sku: mapped.sku || '',
    barcode: mapped.barcode ?? null,
    name: mapped.name || '',
    description: mapped.description || null,
    brand: mapped.brand || null,
    location: mapped.location || null,
    stock_current: mapped.stock_current || 0,
    stock_min: mapped.stock_min || 0,
    price_net: mapped.price_net || 0,
    price_sale: mapped.price_sale || 0,
    category_name: mapped.category_name || null,
  };
}

export interface ImportResult {
  rows: ParsedRow[];
  successCount: number;
  errorCount: number;
  errors: string[];
}

export function parseExcelFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
        });

        const errors: string[] = [];
        const seenSkus = new Set<string>();
        const validRows: ParsedRow[] = [];

        rawRows.forEach((row, idx) => {
          const parsed = mapRow(row);
          if (!parsed.sku) {
            errors.push(`Fila ${idx + 2}: SKU vacío, omitida`);
            return;
          }
          if (seenSkus.has(parsed.sku.toUpperCase())) {
            errors.push(`Fila ${idx + 2}: SKU duplicado "${parsed.sku}", omitida`);
            return;
          }
          seenSkus.add(parsed.sku.toUpperCase());
          validRows.push(parsed);
        });

        resolve({
          rows: validRows,
          successCount: validRows.length,
          errorCount: errors.length,
          errors,
        });
      } catch {
        resolve({
          rows: [],
          successCount: 0,
          errorCount: 1,
          errors: ['Error al leer el archivo. Verifique el formato.'],
        });
      }
    };
    reader.onerror = () => {
      resolve({
        rows: [],
        successCount: 0,
        errorCount: 1,
        errors: ['Error al cargar el archivo.'],
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

export function exportProductsToExcel(products: Product[], filename = 'inventario_bf.xlsx') {
  const data = products.map((p) => ({
    SKU: p.sku,
    'Código de Barras': p.barcode || '',
    Nombre: p.name,
    'Imagen URL': p.image_url || '',
    Descripción: p.description || '',
    Marca: p.brand || '',
    Ubicación: p.location || '',
    'Stock Actual': p.stock_current,
    'Stock Mínimo': p.stock_min,
    'Precio Compra Neto': p.price_net,
    'IVA (19%)': Math.round(p.price_net * 0.19),
    'Precio Total c/IVA': p.price_total,
    'Precio Venta': p.price_sale,
    'Valor Bodega (c/IVA)': p.price_total * p.stock_current,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, filename);
}

export function downloadTemplate() {
  const template = [
    {
      SKU: 'EJEMPLO-001',
      'Código de Barras': '7800000000017',
      Nombre: 'Filtro de Aceite Motor',
      Descripción: 'Filtro de aceite para motor 1.6L',
      Marca: 'BOSCH',
      Ubicación: 'A-01-03',
      'Stock Actual': 10,
      'Stock Mínimo': 3,
      'Precio Compra Neto': 3500,
      'Precio Venta': 5900,
      Categoría: 'Filtros de Aceite',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, 'plantilla_inventario_bf.xlsx');
}

export function exportMovementsToExcel(
  movements: Array<{
    movement_type: string;
    quantity: number;
    total_amount: number;
    user_name: string;
    notes: string | null;
    created_at: string;
    products?: { sku: string; name: string };
  }>,
  filename = 'movimientos_bf.xlsx',
) {
  const data = movements.map((m) => ({
    Fecha: new Date(m.created_at).toLocaleString('es-CL'),
    Tipo: m.movement_type,
    SKU: m.products?.sku || '',
    Producto: m.products?.name || '',
    Cantidad: m.quantity,
    'Monto Total': m.total_amount,
    Usuario: m.user_name,
    Notas: m.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, filename);
}
