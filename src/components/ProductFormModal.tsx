import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Package, Upload, Link2, ImageIcon, DollarSign, Weight, ScanLine, Ruler, Truck, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Category } from '@/types';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/ToastContainer';
import { ProductImage } from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils';
import { Html5Qrcode } from 'html5-qrcode';

export interface ProductFormData {
  id?: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  location: string | null;
  stock_current: number;
  stock_min: number;
  price_total: number;
  price_sale: number;
  weight_g: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  image_url: string | null;
}

interface ProductFormModalProps {
  open: boolean;
  initialData?: Partial<ProductFormData> | null;
  categories: Category[];
  onSave: (data: ProductFormData) => void;
  onClose: () => void;
}

const emptyForm: ProductFormData = {
  sku: '',
  barcode: null,
  name: '',
  description: null,
  brand: null,
  category_id: null,
  location: null,
  stock_current: 0,
  stock_min: 0,
  price_total: 0,
  price_sale: 0,
  weight_g: 0,
  height_cm: 0,
  width_cm: 0,
  length_cm: 0,
  image_url: null,
};

// Show empty string instead of 0 for numeric inputs
const numDisplay = (val: number) => (val === 0 ? '' : String(val));

export function ProductFormModal({
  open,
  initialData,
  categories,
  onSave,
  onClose,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductFormData>(
    initialData ? { ...emptyForm, ...initialData } : emptyForm,
  );
  const [uploading, setUploading] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'camera' | 'url'>('upload');
  const [showBarcodeScan, setShowBarcodeScan] = useState(false);
  const [skuStatus, setSkuStatus] = useState<'idle' | 'checking' | 'taken' | 'ok'>('idle');
  const [barcodeStatus, setBarcodeStatus] = useState<'idle' | 'checking' | 'taken' | 'ok'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const sku = form.sku.trim();
    if (!sku) { setSkuStatus('idle'); return; }
    setSkuStatus('checking');
    const timer = setTimeout(async () => {
      let query = supabase.from('products').select('id').eq('sku', sku).is('deleted_at', null);
      if (form.id) query = query.neq('id', form.id);
      const { data } = await query.maybeSingle();
      setSkuStatus(data ? 'taken' : 'ok');
    }, 400);
    return () => clearTimeout(timer);
  }, [form.sku, form.id]);

  useEffect(() => {
    const barcode = form.barcode?.trim();
    if (!barcode) { setBarcodeStatus('idle'); return; }
    setBarcodeStatus('checking');
    const timer = setTimeout(async () => {
      let query = supabase.from('products').select('id').eq('barcode', barcode).is('deleted_at', null);
      if (form.id) query = query.neq('id', form.id);
      const { data } = await query.maybeSingle();
      setBarcodeStatus(data ? 'taken' : 'ok');
    }, 400);
    return () => clearTimeout(timer);
  }, [form.barcode, form.id]);

  const autoGenSku = async (): Promise<string> => {
    const cat = categories.find((c) => c.id === form.category_id);
    let prefix = 'GEN';
    if (cat) {
      const words = cat.name.toUpperCase().split(' ');
      const significantWord = words.find((w) => !['DE', 'EL', 'LA', 'LOS', 'LAS', 'Y'].includes(w)) || words[0];
      prefix = significantWord.slice(0, 3);
    }
    const { data } = await supabase
      .from('products')
      .select('sku')
      .ilike('sku', `${prefix}-%`)
      .is('deleted_at', null);
    let maxNum = 0;
    if (data) {
      for (const row of data) {
        const match = row.sku.match(/-(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
      }
    }
    return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const mlShippingPreview = useMemo(() => {
    const h = form.height_cm || 0;
    const w = form.width_cm || 0;
    const l = form.length_cm || 0;
    const g = form.weight_g || 0;
    if (h === 0 && w === 0 && l === 0 && g === 0) return 0;
    return Math.round((h * w * l / 5000) * 1500 + (g / 1000) * 2000);
  }, [form.height_cm, form.width_cm, form.length_cm, form.weight_g]);

  if (!open) return null;

  const update = (field: keyof ProductFormData, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('El archivo debe ser una imagen', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('La imagen no debe superar 5MB', 'error');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      showToast(`Error al subir imagen: ${uploadError.message}`, 'error');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    update('image_url', urlData.publicUrl);
    showToast('Imagen subida correctamente', 'success');
    setUploading(false);
  };

  const startBarcodeCamera = async () => {
    setShowBarcodeScan(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode('barcode-scan-view');
        html5QrRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 200, height: 120 } },
          (decoded: string) => {
            update('barcode', decoded);
            showToast(`Código leído: ${decoded}`, 'success');
            stopBarcodeCamera();
          },
          () => {},
        );
      } catch { showToast('No se pudo acceder a la cámara', 'error'); }
    }, 100);
  };

  const stopBarcodeCamera = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); await html5QrRef.current.clear(); } catch {}
      html5QrRef.current = null;
    }
    setShowBarcodeScan(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalSku = form.sku.trim().toUpperCase();
    if (!finalSku) {
      finalSku = await autoGenSku();
    }
    if (!finalSku || !form.name.trim()) return;
    onSave({
      ...form,
      sku: finalSku,
      barcode: form.barcode?.trim() || null,
    });
    stopBarcodeCamera();
  };

  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const numInputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400";
  const numInputClassDark = "w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500";

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900 text-base sm:text-lg">
              {initialData?.id ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Product Image */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Foto del Producto
            </label>
            <div className="flex items-start gap-4">
              <ProductImage
                src={form.image_url}
                alt={form.name || 'Producto'}
                size="lg"
                className="!w-20 !h-20 !rounded-xl"
              />
              <div className="flex-1 space-y-2">
                <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5 w-fit">
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      imageMode === 'upload' ? 'bg-slate-900 text-white' : 'text-slate-500'
                    }`}
                  >
                    <Upload className="w-3 h-3" /> Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('camera')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      imageMode === 'camera' ? 'bg-slate-900 text-white' : 'text-slate-500'
                    }`}
                  >
                    <Camera className="w-3 h-3" /> Cámara
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      imageMode === 'url' ? 'bg-slate-900 text-white' : 'text-slate-500'
                    }`}
                  >
                    <Link2 className="w-3 h-3" /> URL
                  </button>
                </div>

                {imageMode === 'upload' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      {uploading ? 'Subiendo...' : 'Seleccionar imagen'}
                    </button>
                  </div>
                )}

                {imageMode === 'camera' && (
                  <div>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        if (cameraInputRef.current) cameraInputRef.current.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {uploading ? 'Subiendo...' : 'Tomar foto'}
                    </button>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Abre la cámara de tu celular o webcam para capturar la foto directamente.
                    </p>
                  </div>
                )}

                {imageMode === 'url' && (
                  <input
                    type="url"
                    value={form.image_url || ''}
                    onChange={(e) => update('image_url', e.target.value || null)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                    placeholder="https://ejemplo.com/filtro.jpg"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                )}

                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => update('image_url', null)}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Quitar imagen
                  </button>
                )}
                <p className="text-[11px] text-slate-400">
                  Sube una foto, toma una con la cámara o pega una URL.
                </p>
              </div>
            </div>
          </div>

          {/* SKU + Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                SKU / Código Interno
                {!initialData?.id && (
                  <span className="text-slate-400 font-normal"> (vacío = auto-generado)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => update('sku', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
                    skuStatus === 'taken' ? 'border-red-400 bg-red-50' : skuStatus === 'ok' ? 'border-green-400 bg-green-50' : 'border-slate-200'
                  }`}
                  placeholder="Auto: POL-0001"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                {skuStatus === 'taken' && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"><AlertCircle className="w-4 h-4" /></span>
                )}
                {skuStatus === 'ok' && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"><CheckCircle2 className="w-4 h-4" /></span>
                )}
              </div>
              {skuStatus === 'taken' && (
                <p className="text-[11px] text-red-500 mt-1">SKU ya existe en otro producto</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Código de Barras
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={form.barcode || ''}
                    onChange={(e) => update('barcode', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 ${
                      barcodeStatus === 'taken' ? 'border-red-400 bg-red-50' : barcodeStatus === 'ok' ? 'border-green-400 bg-green-50' : 'border-slate-200'
                    }`
                    placeholder="Ej: 7800000000017"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {barcodeStatus === 'taken' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"><AlertCircle className="w-4 h-4" /></span>
                  )}
                  {barcodeStatus === 'ok' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"><CheckCircle2 className="w-4 h-4" /></span>
                  )}
                </div>
                <button type="button" onClick={showBarcodeScan ? stopBarcodeCamera : startBarcodeCamera}
                  className={`flex items-center justify-center w-10 rounded-lg transition-colors ${showBarcodeScan ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <ScanLine className="w-4 h-4" />
                </button>
              </div>
              {showBarcodeScan && (
                <div className="mt-2 relative rounded-lg overflow-hidden bg-slate-900 aspect-[4/3]">
                  <div id="barcode-scan-view" className="w-full h-full" />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[70%] h-[40%] border-2 border-red-500 rounded-lg" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Name + Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre / Descripción corta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="Ej: Filtro de Aceite Motor 1.6L"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
              <input
                type="text"
                value={form.brand || ''}
                onChange={(e) => update('brand', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="Ej: BOSCH"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Category + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
              <select
                value={form.category_id || ''}
                onChange={(e) => update('category_id', e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 bg-white"
              >
                <option value="">Sin categoría</option>
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación Física</label>
              <input
                type="text"
                value={form.location || ''}
                onChange={(e) => update('location', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                placeholder="Ej: A-01-03"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descripción Extendida
            </label>
            <textarea
              value={form.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
              placeholder="Detalle técnico del repuesto..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stock Actual</label>
              <input
                type="number"
                value={numDisplay(form.stock_current)}
                onChange={(e) => update('stock_current', parseInt(e.target.value) || 0)}
                min={0}
                className={numInputClass}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stock Mínimo</label>
              <input
                type="number"
                value={numDisplay(form.stock_min)}
                onChange={(e) => update('stock_min', parseInt(e.target.value) || 0)}
                min={0}
                className={numInputClass}
                placeholder="0"
              />
            </div>
          </div>

          {/* Prices + Weight */}
          <div className="bg-slate-900 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-red-400" />
              <h4 className="text-sm font-semibold">Precios e Información de Envío</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Precio de Compra (IVA Incluido) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={numDisplay(form.price_total)}
                  onChange={(e) => update('price_total', parseFloat(e.target.value) || 0)}
                  min={0}
                  step="any"
                  required
                  className={numInputClassDark}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Precio de Venta Base (IVA Incluido)
                </label>
                <input
                  type="number"
                  value={numDisplay(form.price_sale)}
                  onChange={(e) => update('price_sale', parseFloat(e.target.value) || 0)}
                  min={0}
                  step="any"
                  className={numInputClassDark}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  <Weight className="w-3 h-3 inline mr-1" />Peso (g)
                </label>
                <input
                  type="number"
                  value={numDisplay(form.weight_g)}
                  onChange={(e) => update('weight_g', parseFloat(e.target.value) || 0)}
                  min={0} step="1"
                  className={numInputClassDark}
                  placeholder="500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  <Ruler className="w-3 h-3 inline mr-1" />Alto (cm)
                </label>
                <input
                  type="number"
                  value={numDisplay(form.height_cm)}
                  onChange={(e) => update('height_cm', parseFloat(e.target.value) || 0)}
                  min={0} step="0.1"
                  className={numInputClassDark}
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  <Ruler className="w-3 h-3 inline mr-1" />Ancho (cm)
                </label>
                <input
                  type="number"
                  value={numDisplay(form.width_cm)}
                  onChange={(e) => update('width_cm', parseFloat(e.target.value) || 0)}
                  min={0} step="0.1"
                  className={numInputClassDark}
                  placeholder="15"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  <Ruler className="w-3 h-3 inline mr-1" />Largo (cm)
                </label>
                <input
                  type="number"
                  value={numDisplay(form.length_cm)}
                  onChange={(e) => update('length_cm', parseFloat(e.target.value) || 0)}
                  min={0} step="0.1"
                  className={numInputClassDark}
                  placeholder="20"
                />
              </div>
            </div>

            {/* ML Shipping Preview */}
            {mlShippingPreview > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <Truck className="w-4 h-4 text-yellow-400" />
                <div className="flex-1">
                  <p className="text-[11px] text-slate-400">Costo envío ML (volumen + peso)</p>
                  <p className="text-sm font-bold text-yellow-400">{formatCurrency(mlShippingPreview)}</p>
                </div>
                <p className="text-[10px] text-slate-500 text-right">
                  (H×W×L / 5000) × $1.500<br/>+ peso × $2.000
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
            >
              {initialData?.id ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
