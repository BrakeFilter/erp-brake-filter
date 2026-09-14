import { useEffect, useRef, useState, useCallback } from 'react';

interface BarcodeScannerOptions {
  onScan: (code: string) => void;
  minLength?: number;
  maxInterval?: number;
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  minLength = 4,
  maxInterval = 35,
  enabled = true,
}: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const [isScanning, setIsScanning] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (timeSinceLastKey > maxInterval && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          const code = bufferRef.current;
          bufferRef.current = '';
          setIsScanning(true);
          onScan(code);
          setTimeout(() => setIsScanning(false), 300);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    },
    [enabled, maxInterval, minLength, onScan],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { isScanning };
}
