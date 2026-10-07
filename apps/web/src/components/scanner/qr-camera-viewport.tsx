"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CameraOff, QrCode, ShieldAlert } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type QrCameraViewportProps = {
  enabled: boolean;
  facingMode: "user" | "environment";
  onScan: (decodedText: string) => void;
  onCameraError: (message: string) => void;
};

export function QrCameraViewport({ enabled, facingMode, onScan, onCameraError }: QrCameraViewportProps) {
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerId = useId();
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (!qrCodeRef.current) {
      return;
    }

    try {
      await qrCodeRef.current.stop();
      await qrCodeRef.current.clear();
    } catch {
      // la cámara ya se detuvo o aún no se había iniciado.
    }

    qrCodeRef.current = null;
    setCameraReady(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!scannerRef.current || !enabled) {
      return;
    }

    await stopScanner();

    const deviceId = facingMode === "environment" ? { facingMode } : { facingMode };
    const qrCode = new Html5Qrcode(`reader-${readerId}`);
    qrCodeRef.current = qrCode;

    try {
      await qrCode.start(
        deviceId,
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          if (!enabled) {
            return;
          }
          void stopScanner();
          onScan(decodedText);
        },
        (message) => {
          if (message) {
            setError(message);
          }
        },
      );

      setCameraReady(true);
      setError(null);
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "No se pudo iniciar la cámara.";
      setError(message);
      onCameraError(message);
      setCameraReady(false);
      await stopScanner();
    }
  }, [enabled, facingMode, onCameraError, onScan, readerId, stopScanner]);

  useEffect(() => {
    if (!enabled) {
      void stopScanner();
      setError(null);
      return;
    }

    void startScanner();

    return () => {
      void stopScanner();
    };
  }, [enabled, startScanner, stopScanner]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-brand-surface/95 p-2 shadow-[0_30px_80px_rgba(9,15,12,0.7)]">
      <div className="relative overflow-hidden rounded-[22px] border border-brand-accent/20 bg-[#0b1410]">
        <div id={`reader-${readerId}`} ref={scannerRef} className="h-[420px] w-full bg-[#09120f] sm:h-[520px]" />

        <AnimatePresence>
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-4 top-4 z-20 rounded-2xl border border-red-500/40 bg-red-500/15 p-3 text-sm text-red-100"
            >
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                Error de cámara
              </div>
              <p className="mt-1 text-red-100/90">{error}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-2 border-brand-accent/80 bg-transparent shadow-[0_0_25px_rgba(201,239,117,0.3)]">
            <div className="absolute -left-2 -top-2 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-brand-accent" />
            <div className="absolute -right-2 -top-2 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-brand-accent" />
            <div className="absolute -bottom-2 -left-2 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-brand-accent" />
            <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-brand-accent" />
            <motion.div
              className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-brand-accent shadow-[0_0_18px_rgba(201,239,117,0.8)]"
              animate={{ y: [0, 210, 0], opacity: [0.35, 1, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            {cameraReady ? <QrCode className="h-4 w-4 text-brand-accent" /> : <CameraOff className="h-4 w-4 text-slate-400" />}
            <span>{cameraReady ? "Escaneando" : "Esperando cámara"}</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-limeSoft">
            {facingMode === "environment" ? "Trasera" : "Frontal"}
          </div>
        </div>
      </div>
    </div>
  );
}
