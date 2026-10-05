import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Usb, ScanLine, Flashlight, FlashlightOff, AlertCircle, CheckCircle2, ShoppingCart, PlusCircle, Trash2, Minus } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';

type ScanMode = 'camera' | 'hardware';

interface ScannedItem {
  code: string;
  product: Product;
  qty: number;
}

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onNewCode: (code: string) => void;
  onPurchase: (items: Map<string, { product: Product; qty: number }>) => void;
  onSell: (items: Map<string, { product: Product; qty: number }>) => void;
}

const STORAGE_KEY = 'bf_scanner_mode';
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const MIN_CODE_LENGTH = 8;

function getStoredMode(): ScanMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'camera' || stored === 'hardware') return stored;
  } catch { /* ignore */ }
  return isMobile ? 'camera' : 'hardware';
}

// BarcodeDetector types
interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorClass {
  new (options?: { formats?: string[] }): {
    detect: (source: CanvasImageSource) => Promise<BarcodeDetectorResult[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
}

export function ScanModal({ open, onClose, products, onNewCode, onPurchase, onSell }: ScanModalProps) {
  const [mode, setMode] = useState<ScanMode>(getStoredMode);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [hardwareInput, setHardwareInput] = useState('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const barcodeDetectorRef = useRef<InstanceType<BarcodeDetectorClass> | null>(null);
  const detectLoopRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const CAMERA_COOLDOWN_MS = 1000;

  const persistMode = (m: ScanMode) => {
    setMode(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  };

  const normalizeCode = (code: string) => code.trim().toUpperCase();

  // Async lookup in database — only opens new product modal if truly not in DB
  const processCode = useCallback(async (rawCode: string, isCamera = false) => {
    const code = normalizeCode(rawCode);

    // Min length validation to prevent false positives
    if (code.length < MIN_CODE_LENGTH) return;

    // Cooldown ONLY for camera mode
    if (isCamera) {
      const now = Date.now();
      if (now - lastScanTimeRef.current < CAMERA_COOLDOWN_MS) return;
      lastScanTimeRef.current = now;
    }

    // Beep + vibrate
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    } catch { /* ignore */ }
    try { navigator.vibrate?.(200); } catch { /* ignore */ }

    // First: check if already in cart — if so, just increment
    let inCart = false;
    setScannedItems((prev) => {
      const existing = prev.find((i) => normalizeCode(i.code) === code);
      if (existing) {
        inCart = true;
        return prev.map((i) =>
          normalizeCode(i.code) === code ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return prev;
    });
    if (inCart) {
      setLastScanned(code);
      setTimeout(() => setLastScanned(null), 1500);
      return;
    }

    // Second: check in-memory products list (fast path)
    const localFound = products.find(
      (p) => normalizeCode(p.barcode || '') === code || normalizeCode(p.sku) === code,
    );

    if (localFound) {
      setScannedItems((prev) => [...prev, { code: rawCode.trim(), product: localFound, qty: 1 }]);
      setLastScanned(code);
      setTimeout(() => setLastScanned(null), 1500);
      return;
    }

    // Third: async DB lookup — only open new product modal if truly not in DB
    const { data: dbProduct } = await supabase
      .from('products')
      .select('*')
      .or(`barcode.eq.${code},sku.eq.${code}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (dbProduct) {
      const product = dbProduct as Product;
      setScannedItems((prev) => [...prev, { code: rawCode.trim(), product, qty: 1 }]);
      setLastScanned(code);
      setTimeout(() => setLastScanned(null), 1500);
    } else {
      // Only now — truly new product, open the modal
      onNewCode(rawCode.trim());
    }
  }, [products, onNewCode]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;

      // Try BarcodeDetector first (native, more reliable on Android)
      const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;

      if (BarcodeDetectorCtor) {
        try {
          barcodeDetectorRef.current = new BarcodeDetectorCtor({
            formats: ['ean_13', 'code_128', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
          });

          // Create a video element for BarcodeDetector
          const video = document.createElement('video');
          video.srcObject = stream;
          video.playsInline = true;
          video.muted = true;
          videoRef.current = video;
          await video.play();

          // Mount video into the camera view container
          const container = document.getElementById('scan-camera-view');
          if (container) {
            container.innerHTML = '';
            container.appendChild(video);
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
          }

          // Detection loop
          const detectLoop = async () => {
            if (!barcodeDetectorRef.current || !videoRef.current || videoRef.current.readyState < 2) {
              detectLoopRef.current = requestAnimationFrame(detectLoop);
              return;
            }
            try {
              const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                if (code && code.length >= MIN_CODE_LENGTH) {
                  void processCode(code, true);
                }
              }
            } catch { /* ignore detection errors */ }
            detectLoopRef.current = requestAnimationFrame(detectLoop);
          };
          detectLoop();
        } catch {
          // Fallback to Html5Qrcode if BarcodeDetector fails
          await startHtml5Qr(stream);
        }
      } else {
        // No BarcodeDetector — use Html5Qrcode
        await startHtml5Qr(stream);
      }

      setCameraActive(true);
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!caps?.torch);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara');
      setCameraActive(false);
    }
  }, [processCode]);

  const startHtml5Qr = async (stream: MediaStream) => {
    streamRef.current = stream;
    const html5Qr = new Html5Qrcode('scan-camera-view');
    html5QrRef.current = html5Qr;
    await html5Qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 180 } },
      (decoded: string) => {
        if (decoded.length >= MIN_CODE_LENGTH) {
          void processCode(decoded, true);
        }
      },
      () => {},
    );
  };

  const stopCamera = useCallback(async () => {
    if (detectLoopRef.current) {
      cancelAnimationFrame(detectLoopRef.current);
      detectLoopRef.current = null;
    }
    if (barcodeDetectorRef.current) {
      barcodeDetectorRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); await html5QrRef.current.clear(); } catch { /* ignore */ }
      html5QrRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch { /* ignore */ }
  }, [torchOn]);

  const handleHardwareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = hardwareInput.trim();
    if (code.length >= 1) { void processCode(code, false); setHardwareInput(''); }
  };

  useEffect(() => {
    if (!open) { void stopCamera(); return; }
    if (mode === 'camera') { void startCamera(); }
    else { void stopCamera(); setTimeout(() => hardwareInputRef.current?.focus(), 100); }
    return () => { void stopCamera(); };
  }, [open, mode, startCamera, stopCamera]);

  useEffect(() => { return () => { void stopCamera(); }; }, [stopCamera]);

  // NOTE: Do NOT clear scannedItems on close — cart must persist
  // The parent component controls when to clear via onPurchase/onSell

  if (!open) return null;

  const buildMap = (): Map<string, { product: Product; qty: number }> => {
    const m = new Map<string, { product: Product; qty: number }>();
    scannedItems.forEach((i) => m.set(i.code, { product: i.product, qty: i.qty }));
    return m;
  };

  const handlePurchase = () => {
    const items = buildMap();
    onPurchase(items);
    setScannedItems([]);
  };

  const handleSell = () => {
    const items = buildMap();
    onSell(items);
    setScannedItems([]);
  };

  const adjustQty = (code: string, delta: number) => {
    setScannedItems((prev) =>
      prev
        .map((i) =>
          i.code === code ? { ...i, qty: Math.max(1, i.qty + delta) } : i,
        )
        .filter((i) => i.qty > 0),
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-slate-900">Escanear Código</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-3 bg-slate-50 border-b border-slate-200">
          <button onClick={() => persistMode('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'camera' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Camera className="w-4 h-4" /> Cámara
          </button>
          <button onClick={() => persistMode('hardware')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'hardware' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Usb className="w-4 h-4" /> Escáner Físico
          </button>
        </div>

        <div className="p-4">
          {/* Scanner */}
          {mode === 'camera' && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                  <p className="text-sm text-red-600 text-center mb-3">{cameraError}</p>
                  <button onClick={() => void startCamera()} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Reintentar</button>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                    <div id="scan-camera-view" className="w-full h-full" />
                    {cameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-[70%] h-[50%] border-2 border-red-500 rounded-lg shadow-lg" />
                      </div>
                    )}
                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-slate-600 border-t-red-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {cameraActive && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Cámara activa
                      </p>
                      {torchSupported && (
                        <button onClick={toggleTorch}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${torchOn ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          {torchOn ? <FlashlightOff className="w-3.5 h-3.5" /> : <Flashlight className="w-3.5 h-3.5" />}
                          {torchOn ? 'Apagar' : 'Linterna'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {mode === 'hardware' && (
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-xl p-6 text-center">
                <Usb className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-300 font-medium">Listo para escanear...</p>
                <p className="text-xs text-slate-500 mt-1">Dispara con el lector Bluetooth o USB</p>
              </div>
              <form onSubmit={handleHardwareSubmit}>
                <input ref={hardwareInputRef} type="text" value={hardwareInput}
                  onChange={(e) => setHardwareInput(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 text-center font-mono"
                  placeholder="Código detectado..." autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="search" />
                <button type="submit" disabled={!hardwareInput.trim()}
                  className="w-full mt-3 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40">
                  Buscar Producto
                </button>
              </form>
            </div>
          )}

          {/* Scanned items list */}
          {scannedItems.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">
                  {scannedItems.length} producto{scannedItems.length !== 1 ? 's' : ''} · {scannedItems.reduce((s, i) => s + i.qty, 0)} un.
                </p>
                <button onClick={() => setScannedItems([])}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Limpiar
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {scannedItems.map((item) => (
                  <div key={item.code} className={`flex items-center gap-2 rounded-lg p-2.5 border transition-all ${lastScanned === normalizeCode(item.code) ? 'bg-green-100 border-green-300 scale-[1.02]' : 'bg-green-50 border-green-200'}`}>
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-800 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-green-600">{item.product.sku} · {formatCurrency(item.product.price_total)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => adjustQty(item.code, -1)}
                        className="w-6 h-6 rounded bg-white border border-green-300 text-green-700 flex items-center justify-center hover:bg-green-50">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold text-green-800 w-6 text-center">{item.qty}</span>
                      <button onClick={() => adjustQty(item.code, 1)}
                        className="w-6 h-6 rounded bg-white border border-green-300 text-green-700 flex items-center justify-center hover:bg-green-50">
                        <PlusCircle className="w-3 h-3" />
                      </button>
                    </div>
                    <button onClick={() => setScannedItems(scannedItems.filter((i) => i.code !== item.code))}
                      className="text-slate-400 hover:text-red-600 p-1 flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={handlePurchase}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                  <PlusCircle className="w-4 h-4" /> Es Compra
                </button>
                <button onClick={handleSell}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
                  <ShoppingCart className="w-4 h-4" /> Es Venta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
