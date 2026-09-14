import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Usb, ScanLine, Flashlight, FlashlightOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

type ScanMode = 'camera' | 'hardware';

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  products: Array<{ sku: string; barcode: string | null; name: string }>;
}

const STORAGE_KEY = 'bf_scanner_mode';
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function getStoredMode(): ScanMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'camera' || stored === 'hardware') return stored;
  } catch {
    /* ignore */
  }
  return isMobile ? 'camera' : 'hardware';
}

export function ScanModal({ open, onClose, onScan, products }: ScanModalProps) {
  const [mode, setMode] = useState<ScanMode>(getStoredMode);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [hardwareInput, setHardwareInput] = useState('');
  const [foundProduct, setFoundProduct] = useState<string | null>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const persistMode = (m: ScanMode) => {
    setMode(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const lookupProduct = useCallback(
    (code: string): boolean => {
      const found = products.find(
        (p) =>
          p.barcode === code ||
          p.sku.toLowerCase() === code.toLowerCase(),
      );
      if (found) {
        setFoundProduct(`${found.name} (${found.sku})`);
        return true;
      }
      setFoundProduct(null);
      return false;
    },
    [products],
  );

  const handleCodeDetected = useCallback(
    (code: string) => {
      // Beep + vibrate
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } catch {
        /* ignore */
      }
      try {
        navigator.vibrate?.(200);
      } catch {
        /* ignore */
      }

      lookupProduct(code);
      onScan(code);
    },
    [onScan, lookupProduct],
  );

  // Camera mode
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      const html5Qr = new Html5Qrcode('scan-camera-view');
      html5QrRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 180 } },
        (decodedText: string) => {
          handleCodeDetected(decodedText);
        },
        () => {
          /* per-frame error, ignore */
        },
      );
      setCameraActive(true);

      // Check torch support
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!capabilities?.torch);
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'No se pudo acceder a la cámara. Verifica los permisos.',
      );
      setCameraActive(false);
    }
  }, [handleCodeDetected]);

  const stopCamera = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        await html5QrRef.current.clear();
      } catch {
        /* ignore */
      }
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
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn(!torchOn);
    } catch {
      /* ignore */
    }
  }, [torchOn]);

  // Hardware submit
  const handleHardwareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = hardwareInput.trim();
    if (code.length >= 1) {
      handleCodeDetected(code);
      setHardwareInput('');
    }
  };

  // Effects: start/stop camera on mode change
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
      setTimeout(() => hardwareInputRef.current?.focus(), 100);
    }
    return () => {
      stopCamera();
    };
  }, [open, mode, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
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
          <button
            onClick={() => persistMode('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'camera'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" />
            Cámara
          </button>
          <button
            onClick={() => persistMode('hardware')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'hardware'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Usb className="w-4 h-4" />
            Escáner Físico
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'camera' && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                  <p className="text-sm text-red-600 text-center mb-3">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                  >
                    Reintentar
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                    <div id="scan-camera-view" className="w-full h-full" />
                    {/* Overlay frame */}
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
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Cámara activa — enfoca el código
                      </p>
                      {torchSupported && (
                        <button
                          onClick={toggleTorch}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            torchOn
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
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
                <p className="text-sm text-slate-300 font-medium">
                  Listo para escanear...
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Dispara con el lector Bluetooth o USB
                </p>
              </div>

              <form onSubmit={handleHardwareSubmit}>
                <input
                  ref={hardwareInputRef}
                  type="text"
                  value={hardwareInput}
                  onChange={(e) => setHardwareInput(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 text-center font-mono"
                  placeholder="Código detectado..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="search"
                />
                <button
                  type="submit"
                  disabled={!hardwareInput.trim()}
                  className="w-full mt-3 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  Buscar Producto
                </button>
              </form>

              <p className="text-xs text-slate-400 text-center">
                El campo se enfoca automáticamente. Escanea con el lector y presiona Enter.
              </p>
            </div>
          )}

          {/* Result feedback */}
          {foundProduct && (
            <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 animate-slide-up">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-800">Producto encontrado</p>
                <p className="text-xs text-green-600 truncate">{foundProduct}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
