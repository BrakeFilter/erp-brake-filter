import { useState } from 'react';
import { Plus, Minus, MapPin, Tag, Barcode, Pencil, Trash2, Weight, ShoppingCart } from 'lucide-react';
import type { Product } from '@/types';
import { formatCurrency, stockLabel } from '@/lib/utils';
import { ProductImage } from '@/components/ProductImage';

interface ProductCardProps {
  product: Product;
  onStockChange: (product: Product, delta: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onSell: (product: Product) => void;
}

export function ProductCard({ product, onStockChange, onEdit, onDelete, onSell }: ProductCardProps) {
  const [updating, setUpdating] = useState(false);
  const stock = stockLabel(product.stock_current, product.stock_min);

  const handleStock = (delta: number) => {
    setUpdating(true);
    onStockChange(product, delta);
    setTimeout(() => setUpdating(false), 400);
  };

  const badgeColors: Record<string, string> = {
    red: 'bg-red-100 text-red-700 border-red-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {product.sku}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColors[stock.color]}`}
                  >
                    {stock.text}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mt-1.5 truncate">
                  {product.name}
                </h3>
                {product.brand && (
                  <p className="text-xs text-slate-500 mt-0.5">{product.brand}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => onEdit(product)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(product)}
                  className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-3.5 sm:px-4 py-3 space-y-1.5 text-xs text-slate-500">
        {product.barcode && (
          <div className="flex items-center gap-1.5">
            <Barcode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{product.barcode}</span>
          </div>
        )}
        {product.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{product.location}</span>
          </div>
        )}
        {product.categories && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{product.categories.name}</span>
          </div>
        )}
        {product.weight_kg > 0 && (
          <div className="flex items-center gap-1.5">
            <Weight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{product.weight_kg} kg</span>
          </div>
        )}
      </div>

      {/* Prices */}
      <div className="px-3.5 sm:px-4 pb-3 grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Compra (IVA Inc.)</p>
          <p className="text-sm font-bold text-slate-700">{formatCurrency(product.price_total)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Venta (IVA Inc.)</p>
          <p className="text-sm font-bold text-slate-700">{formatCurrency(product.price_sale)}</p>
        </div>
      </div>

      {/* Stock Controls */}
      <div className="flex items-center gap-1.5 px-3.5 sm:px-4 pb-3.5 sm:pb-4">
        <button
          onClick={() => onSell(product)}
          disabled={product.stock_current === 0}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Vender"
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleStock(-1)}
          disabled={product.stock_current === 0 || updating}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Salida -1"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div
          className={`flex-1 text-center py-1.5 rounded-lg text-sm font-bold transition-all ${
            updating ? 'bg-red-50 text-red-600 scale-105' : 'bg-slate-50 text-slate-800'
          }`}
        >
          {product.stock_current}
          <span className="text-xs font-normal text-slate-400 ml-1">/ {product.stock_min} mín</span>
        </div>
        <button
          onClick={() => handleStock(1)}
          disabled={updating}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40"
          title="Entrada +1"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
