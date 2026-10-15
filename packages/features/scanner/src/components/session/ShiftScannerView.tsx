"use client";

import { CheckCircle2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import type { ShiftOption, ScannerFlowState } from "../../types";
import { QrCameraViewport } from "../capture/QrCameraViewport";
import { ShiftSelector } from "./ShiftSelector";

export interface ShiftScannerViewProps {
  activeShift: ShiftOption | null;
  shiftOptions: ShiftOption[];
  selectedShiftId: string | null;
  isLoadingShifts: boolean;
  shiftLoadError: string | null;
  flowState: ScannerFlowState;
  facingMode: "user" | "environment";
  cameraToast: string | null;
  onSelectShift: (shift: ShiftOption) => void;
  onToggleFacingMode: () => void;
  onOpenCamera: () => void;
  onScan: (rawQr: string) => void;
  onCameraError: (err: string) => void;
}

export function ShiftScannerView({
  activeShift,
  shiftOptions,
  selectedShiftId,
  isLoadingShifts,
  shiftLoadError,
  flowState,
  facingMode,
  cameraToast,
  onSelectShift,
  onToggleFacingMode,
  onOpenCamera,
  onScan,
  onCameraError,
}: ShiftScannerViewProps) {
  if (!activeShift) {
    return (
      <section className="px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <ShiftSelector
            options={shiftOptions}
            selectedId={selectedShiftId}
            isLoading={isLoadingShifts}
            loadError={shiftLoadError}
            onSelect={onSelectShift}
          />
        </div>
      </section>
    );
  }

  const canStartCameraTurno = Boolean(
    Number.isInteger(activeShift.postServiceId) &&
      activeShift.postServiceId > 0 &&
      (flowState === "starting-camera" || flowState === "scanning"),
  );

  return (
    <section className="px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-col gap-3 rounded-[26px] border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
              Puesto confirmado
            </p>
            <h2 className="mt-1 text-xl font-bold text-brand-text">
              {activeShift.label} · {activeShift.courtName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleFacingMode}
              className="rounded-full border border-brand-border bg-brand-control px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
            >
              Cambiar cámara
            </button>
            <button
              type="button"
              onClick={onOpenCamera}
              disabled={
                !Number.isInteger(activeShift.postServiceId) ||
                activeShift.postServiceId <= 0
              }
              className="rounded-full bg-brand-accent px-4 py-2 text-xs font-bold text-brand-on-accent transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              {flowState === "scanning" ? "Cámara activa" : "Iniciar cámara"}
            </button>
          </div>
        </div>

        {cameraToast && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-2xl border border-brand-danger-border bg-brand-danger-bg px-4 py-3 text-sm text-brand-danger-text"
          >
            {cameraToast}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div>
            <QrCameraViewport
              enabled={canStartCameraTurno}
              facingMode={facingMode}
              onScan={onScan}
              onCameraError={onCameraError}
            />
          </div>

          <motion.aside
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-[28px] border border-brand-border bg-brand-surface p-5"
          >
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
                Estado del turno
              </p>
              <h3 className="mt-2 text-xl font-bold text-brand-text">
                {activeShift.courtName}
              </h3>
            </div>

            <div className="space-y-3 text-sm text-brand-muted">
              <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                <span>ID del puesto/servicio</span>
                <span className="font-semibold text-brand-text">
                  {activeShift.postServiceId}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                <span>Validación</span>
                <span className="font-semibold text-brand-accent">
                  {flowState}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
                {flowState === "scanning" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                {flowState === "scanning" ? "Escaneando activo" : "Esperando QR"}
              </div>
              <p className="mt-2 text-sm text-brand-text">
                {flowState === "scanning"
                  ? "Apunte al QR firmado del ticket para confirmar el canje."
                  : "Seleccione un puesto/servicio válido para habilitar la lectura."}
              </p>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}

export default ShiftScannerView;
