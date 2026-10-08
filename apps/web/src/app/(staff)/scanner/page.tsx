"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ShieldAlert, WifiOff } from "lucide-react";

import { QrCameraViewport } from "@/components/scanner/qr-camera-viewport";
import { ScannerHeader } from "@/components/scanner/scanner-header";
import { ShiftSelector } from "@/components/scanner/shift-selector";
import { TicketValidationModal } from "@/components/scanner/ticket-validation-modal";
import {
  type ScannerFlowState,
  type ShiftOption,
  type TicketValidationResponse,
  scannerService,
} from "@/components/scanner/scanner.service";
import { useAudioFeedback } from "@/components/scanner/use-audio-feedback";

export default function ScannerPage() {
  const [flowState, setFlowState] = useState<ScannerFlowState>("idle");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [shiftLoadError, setShiftLoadError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftOption | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [ticket, setTicket] = useState<TicketValidationResponse | null>(null);
  const [modalMessage, setModalMessage] = useState("Se debe validar el QR para confirmar acceso.");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [cameraToast, setCameraToast] = useState<string | null>(null);

  const { playSuccess, playError } = useAudioFeedback(audioEnabled);

  useEffect(() => {
    let isCurrent = true;

    scannerService.getShiftOptions()
      .then((options) => {
        if (isCurrent) setShiftOptions(options);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setShiftLoadError(error instanceof Error ? error.message : "No se pudieron cargar los puestos de turno.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingShifts(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const setStateAndMessage = useCallback((nextState: ScannerFlowState, nextMessage: string) => {
    setFlowState(nextState);
    setModalMessage(nextMessage);
  }, []);

  const handleSelectShift = useCallback((shift: ShiftOption) => {
    setSelectedShiftId(shift.id);
    setActiveShift(shift);
    setTicket(null);
    setIsModalOpen(false);
    setCameraToast(null);
    setFlowState("configuring-shift");
  }, []);

  const handleOpenCamera = useCallback(() => {
    if (!activeShift) {
      return;
    }

    setFlowState("starting-camera");
    setCameraToast("Preparando la cámara del puesto seleccionado...");
  }, [activeShift]);

  const handleChangeShift = useCallback(() => {
    setSelectedShiftId(null);
    setActiveShift(null);
    setTicket(null);
    setIsModalOpen(false);
    setFlowState("idle");
    setCameraToast(null);
    setModalMessage("Se debe validar el QR para confirmar acceso.");
  }, []);

  useEffect(() => {
    if (!activeShift) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (flowState === "configuring-shift" || flowState === "starting-camera") {
        setFlowState("starting-camera");
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeShift, flowState]);

  useEffect(() => {
    if (!activeShift) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeShift, isModalOpen]);

  const handleScan = useCallback(
    async (rawQr: string) => {
      if (!activeShift) {
        return;
      }

      setFlowState("validating-ticket");
      setModalMessage("Validando QR del ticket y comprobando coincidencia de turno...");
      setIsModalOpen(true);

      try {
        const result = await scannerService.validateTicket(rawQr, activeShift);
        if (result.isValid && !result.ticketId) {
          setTicket(null);
          setStateAndMessage("ticket-invalid", "La respuesta de validación no incluye el identificador requerido para el canje.");
          if (audioEnabled) playError();
          return;
        }

        if (!result.isValid) {
          const nextState = result.status === "WRONG_COURT" ? "access-denied" : "ticket-invalid";
          setStateAndMessage(nextState, result.message);
          setTicket(null);
          if (audioEnabled) playError();
          return;
        }

        setTicket(result);
        setStateAndMessage("ticket-valid", result.message);
        if (audioEnabled) {
          playSuccess();
        }
      } catch (error: unknown) {
        const message = error instanceof Error
          ? `No se pudo validar el ticket: ${error.message}`
          : "No se pudo validar el ticket por un error de conexión.";
        setTicket(null);
        setStateAndMessage("ticket-invalid", message);
        if (audioEnabled) playError();
      }
    },
    [activeShift, audioEnabled, playError, playSuccess, setStateAndMessage],
  );

  const handleRedeem = useCallback(async () => {
    if (!ticket?.isValid || !ticket.ticketId || !activeShift) {
      return;
    }

    setFlowState("redeeming");
    setIsRedeeming(true);
    setModalMessage("Registrando acceso y confirmando el paso del cliente...");

    try {
      const result = await scannerService.redeemTicket(ticket.ticketId, activeShift);
      if (!result.success) {
        setStateAndMessage("redeem-error", result.message);
        if (audioEnabled) {
          playError();
        }
        return;
      }

      setStateAndMessage("access-granted", result.message);
      if (audioEnabled) {
        playSuccess();
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? `No se pudo registrar el canje: ${error.message}`
        : "No se pudo registrar el canje por un error de conexión.";
      setStateAndMessage("redeem-error", message);
      if (audioEnabled) {
        playError();
      }
    } finally {
      setIsRedeeming(false);
    }
  }, [activeShift, audioEnabled, playError, playSuccess, setStateAndMessage, ticket]);

  const handleCameraError = useCallback(
    (message: string) => {
      setCameraToast(message);
      setFlowState("camera-error");
      setStateAndMessage("camera-error", message);
    },
    [setStateAndMessage],
  );

  const handleScanNext = useCallback(() => {
    setTicket(null);
    setIsModalOpen(false);
    setFlowState("scanning");
    setModalMessage("Escaneando siguiente QR...");
  }, []);

  const canStartCamera = Boolean(activeShift) && (flowState === "starting-camera" || flowState === "scanning" || flowState === "validating-ticket");

  return (
    <main data-scanner-theme={theme} className="min-h-screen bg-brand-dark text-brand-text">
      <ScannerHeader
        activeShift={activeShift}
        audioEnabled={audioEnabled}
        theme={theme}
        onToggleAudio={() => setAudioEnabled((current) => !current)}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onChangeShift={handleChangeShift}
      />

      {!activeShift ? (
        <section className="px-4 pb-10 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <ShiftSelector
              options={shiftOptions}
              selectedId={selectedShiftId}
              isLoading={isLoadingShifts}
              loadError={shiftLoadError}
              onSelect={handleSelectShift}
            />
          </div>
        </section>
      ) : (
        <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 flex flex-col gap-3 rounded-[26px] border border-brand-border bg-brand-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">Puesto confirmado</p>
                <h2 className="mt-1 text-xl font-bold text-brand-text">{activeShift.label} · {activeShift.courtName}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFacingMode((current) => (current === "environment" ? "user" : "environment"))}
                  className="rounded-full border border-brand-border bg-brand-control px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
                >
                  Cambiar cámara
                </button>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="rounded-full bg-brand-accent px-4 py-2 text-xs font-bold text-brand-on-accent transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  {flowState === "scanning" ? "Cámara activa" : "Iniciar cámara"}
                </button>
              </div>
            </div>

            {cameraToast ? (
              <div role="alert" className="mb-4 flex items-center gap-2 rounded-2xl border border-brand-danger-border bg-brand-danger-bg px-4 py-3 text-sm text-brand-danger-text">
                <WifiOff className="h-4 w-4" />
                {cameraToast}
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
              <div>
                <QrCameraViewport
                  enabled={canStartCamera}
                  facingMode={facingMode}
                  onScan={handleScan}
                  onCameraError={handleCameraError}
                />
              </div>

              <motion.aside
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-[28px] border border-brand-border bg-brand-surface p-5"
              >
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent">Estado del turno</p>
                  <h3 className="mt-2 text-xl font-bold text-brand-text">{activeShift.courtName}</h3>
                </div>

                <div className="space-y-3 text-sm text-brand-muted">
                  <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                    <span>Horario</span>
                    <span className="font-semibold text-brand-text">{activeShift.startTime} - {activeShift.endTime}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                    <span>Instalación</span>
                    <span className="font-semibold text-brand-text">{activeShift.venueName}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-control px-3 py-2">
                    <span>Validación</span>
                    <span className="font-semibold text-brand-accent">{flowState}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
                    {flowState === "scanning" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    {flowState === "scanning" ? "Escaneando activo" : "Esperando QR"}
                  </div>
                  <p className="mt-2 text-sm text-brand-text">
                    {flowState === "scanning"
                      ? "Apunte al código del ticket para validar el acceso del cliente."
                      : "Confirme el turno y active la cámara para iniciar lectura."}
                  </p>
                </div>

                {flowState === "validating-ticket" ? (
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-brand-border bg-brand-control px-3 py-3 text-sm text-brand-text">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
                    Validando reserva y comprobando coincidencia con el puesto activo...
                  </div>
                ) : null}
              </motion.aside>
            </div>
          </div>
        </section>
      )}

      <TicketValidationModal
        isOpen={isModalOpen}
        state={flowState}
        ticket={ticket}
        message={modalMessage}
        isRedeeming={isRedeeming}
        onClose={() => setIsModalOpen(false)}
        onRedeem={handleRedeem}
        onScanNext={handleScanNext}
      />
    </main>
  );
}
