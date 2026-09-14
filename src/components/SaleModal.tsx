import { useState, useMemo } from 'react';
import { X, ShoppingCart, Store, Truck, TrendingUp, AlertCircle } from 'lucide-react';
import type { Product, SaleChannel } from '@/types';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { ProductImage } from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils';
import { calculateMargenML, calculateMargenDirect, getShippingCost } from '@/lib/mercadolibre';

interface SaleModalProps {
  product: Product;
  onClose: () => void;
  onSold: () => void;
}

export function SaleModal({ product, onClose, onSold }: SaleModalProps) {
  const [channel, setChannel] = useState<SaleChannel>('directa');
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(product.price_sale);
  const [overrideShipping, setOverrideShipping] = useState(false);
  const [customShipping, setCustomShipping] = useState(0);
  const [saving, setSaving] = useState(false);

  const purchasePrice = product.price_total;

  const calc = useMemo(() => {
    if (channel === 'mercadolibre') {
      return calculateMargenML(
        salePrice,
        purchasePrice,
        product.weight_kg || 0,
        overrideShipping ? customShipping : undefined,
      );
    }
    return calculateMargenDirect(salePrice, purchasePrice, overrideShipping ? customShipping : 0);
  }, [channel, salePrice, purchasePrice, product.weight_kg, overrideShipping, customShipping]);

  const autoShipping = useMemo(
    () => getShippingCost(product.weight_kg || 0, salePrice),
    [product.weight_kg, salePrice],
  );

  const totalMargin = calc.netMargin * quantity;
  const totalShipping = (overrideShipping ? customShipping : calc.shippingCost) * quantity;
  const totalCommission = calc.commission * quantity;

  const handleSale = async () => {
    if (quantity < 1 || quantity > product.stock_current) {
      showToast('Cantidad inválida', 'error');
      return;
    }
    if (salePrice <= 0) {
      showToast('El precio de venta debe ser mayor a 0', 'error');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc('process_movement', {
      p_product_id: product.id,
      p_movement_type: 'salida',
      p_quantity: quantity,
      p_user_name: 'Operador',
      p_notes: `Venta ${channel === 'mercadolibre' ? 'Mercado Libre' : 'Directa'} - ${quantity} un.`,
    });

    if (error || !data) {
      showToast('Error al procesar venta', 'error');
      setSaving(false);
      return;
    }

    // Update the movement record with sale details
    const { data: movementData } = await supabase
      .from('movements')
      .select('id')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (movementData) {
      await supabase
        .from('movements')
        .update({
          sale_channel: channel,
          sale_price: salePrice * quantity,
          shipping_cost: totalShipping,
          commission: totalCommission,
          net_margin: totalMargin,
        })
        .eq('id', movementData.id);
    }

    showToast(
      `Venta registrada: ${quantity}x ${product.name} — Margen: ${formatCurrency(totalMargin)}`,
      totalMargin < 0 ? 'error' : 'success',
    );

    setSaving(false);
    onSold();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-slate-900">Registrar Venta</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Product Info */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
            <ProductImage src={product.image_url} alt={product.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
              <p className="text-xs text-slate-500">{product.sku} · Stock: {product.stock_current}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Compra: {formatCurrency(purchasePrice)} · {product.weight_kg || 0} kg
              </p>
            </div>
          </div>

          {/* Channel Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Canal de Venta</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setChannel('directa')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all ${
                  channel === 'directa'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Store className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Venta Directa</p>
                  <p className="text-[10px] opacity-70">Sin comisión</p>
                </div>
              </button>
              <button
                onClick={() => setChannel('mercadolibre')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all ${
                  channel === 'mercadolibre'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Mercado Libre</p>
                  <p className="text-[10px] opacity-70">Comisión 19%</p>
                </div>
              </button>
            </div>
          </div>

          {/* Quantity + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={product.stock_current}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Precio Venta Unit. ($)
              </label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                min={0}
                step="any"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
              />
            </div>
          </div>

          {/* Shipping (ML only) */}
          {channel === 'mercadolibre' && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-yellow-600" />
                <p className="text-xs font-medium text-yellow-800">Costo de Envío (Mercado Libre)</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Calculado automáticamente:</span>
                <span className="font-bold text-slate-800">{formatCurrency(autoShipping)}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideShipping}
                  onChange={(e) => setOverrideShipping(e.target.checked)}
                  className="rounded"
                />
                Sobrescribir manualmente
              </label>
              {overrideShipping && (
                <input
                  type="number"
                  value={customShipping}
                  onChange={(e) => setCustomShipping(parseFloat(e.target.value) || 0)}
                  min={0}
                  step="any"
                  className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/30 bg-white"
                  placeholder="Costo de envío manual"
                />
              )}
            </div>
          )}

          {/* Margin Breakdown */}
          <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h4 className="text-sm font-semibold">Desglose de Margen</h4>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Precio Venta ({quantity}x)</span>
              <span className="font-medium text-white">{formatCurrency(salePrice * quantity)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Costo Compra ({quantity}x)</span>
              <span className="text-red-400">-{formatCurrency(purchasePrice * quantity)}</span>
            </div>
            {channel === 'mercadolibre' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Comisión ML 19%</span>
                  <span className="text-red-400">-{formatCurrency(totalCommission)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Envío ({quantity}x)</span>
                  <span className="text-red-400">-{formatCurrency(totalShipping)}</span>
                </div>
              </>
            )}
            {channel === 'directa' && overrideShipping && customShipping > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Envío ({quantity}x)</span>
                <span className="text-red-400">-{formatCurrency(totalShipping)}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-300 font-medium">Margen Neto Total</span>
              <span
                className={`text-lg font-bold ${totalMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {formatCurrency(totalMargin)}
              </span>
            </div>
          </div>

          {totalMargin < 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2.5 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Esta venta genera pérdida. Verifica precios o costo de envío.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSale}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? 'Procesando...' : 'Confirmar Venta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
