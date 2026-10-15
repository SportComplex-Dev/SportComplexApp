"use client";

import { Camera, CameraOff, QrCode, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sportcomplex/ui";

export interface ScannerCameraViewProps {
  consultationCameraActive: boolean;
  consultationLoading: boolean;
  consultationCameraError: string | null;
  onStartCamera: () => void;
  onStopCamera: () => void;
}

export function ScannerCameraView({
  consultationCameraActive,
  consultationLoading,
  consultationCameraError,
  onStartCamera,
  onStopCamera,
}: ScannerCameraViewProps) {
  return (
    <Card className="border-[var(--brand-border)] bg-[var(--surface)] shadow-xs overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Camera className="size-4" />
              Lector de Cámara
            </CardTitle>
            <CardDescription className="text-xs">
              Enfoca el código QR del cliente con la cámara de tu dispositivo.
            </CardDescription>
          </div>

          <Button
            variant={consultationCameraActive ? "destructive" : "default"}
            size="sm"
            onClick={consultationCameraActive ? onStopCamera : onStartCamera}
            disabled={consultationLoading}
            className="flex items-center gap-1.5 text-xs"
          >
            {consultationCameraActive ? (
              <>
                <CameraOff className="size-3.5" />
                Pausar
              </>
            ) : (
              <>
                <Camera className="size-3.5" />
                Iniciar cámara
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contenedor DOM para html5-qrcode */}
        <div
          id="qr-reader"
          className={`w-full overflow-hidden rounded-xl border border-[var(--brand-border)] bg-black/5 dark:bg-black/40 min-h-[260px] flex items-center justify-center ${
            consultationCameraActive ? "block" : "hidden"
          }`}
        />

        {!consultationCameraActive && (
          <div className="p-8 border border-dashed border-[var(--brand-border)] rounded-xl flex flex-col items-center justify-center text-center space-y-2 text-[var(--subtle)]">
            <QrCode className="size-10 text-muted-foreground/60" />
            <p className="text-xs">
              La cámara se encuentra pausada. Haz clic en <strong>Iniciar cámara</strong> o usa
              el ingreso manual.
            </p>
          </div>
        )}

        {consultationCameraError && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {consultationCameraError}
          </p>
        )}

        {consultationLoading && (
          <div className="p-4 rounded-lg bg-[var(--surface-soft)] text-xs flex items-center justify-center gap-2 text-[var(--subtle)]">
            <RefreshCw className="size-4 animate-spin text-[#123e30] dark:text-[#c9ef75]" />
            <span>Consultando información en el servidor...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScannerCameraView;
