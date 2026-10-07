"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ShieldAlert, WifiOff } from "lucide-react";

import { QrCameraViewport } from "@/components/scanner/qr-camera-viewport";
import { ScannerHeader } from "@/components/scanner/scanner-header";
import { ShiftSelector } from "@/components/scanner/shift-selector";
import { TicketValidationModal } from "@/components/scanner/ticket-validation-modal";
import {
  type ResolvedTicket,
  type ScannerFlowState,
  type ShiftOption,
  redeemTicketAccess,
  scannerShiftOptions,
  validateTicketForShift,
} from "@/components/scanner/mock-access";
import { useAudioFeedback } from "@/components/scanner/use-audio-feedback";

export default function ScannerPage() {
  const [flowState, setFlowState] = useState<ScannerFlowState>("idle");
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftOption | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [ticket, setTicket] = useState<ResolvedTicket | null>(null);
  const [modalMessage, setModalMessage] = useState("Se debe validar el QR para confirmar acceso.");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [cameraToast, setCameraToast] = useState<string | null>(null);

  const { playSuccess, playError } = useAudioFeedback(audioEnabled);

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

      const result = await validateTicketForShift(rawQr, activeShift);

      if (!result.ok) {
        const nextState = result.reason === "wrong-court" ? "access-denied" : "ticket-invalid";
        setStateAndMessage(nextState, result.message);
        setTicket(null);
        if (audioEnabled) {
          playError();
        }
        return;
      }

      setTicket(result.ticket);
      setStateAndMessage("ticket-valid", result.message);
      setModalMessage(result.message);
      if (audioEnabled) {
        playSuccess();
      }
    },
    [activeShift, audioEnabled, playError, playSuccess, setStateAndMessage],
  );

  const handleRedeem = useCallback(async () => {
    if (!ticket || !activeShift) {
      return;
    }

    setFlowState("redeeming");
    setIsRedeeming(true);
    setModalMessage("Registrando acceso y confirmando el paso del cliente...");

    try {
      const result = await redeemTicketAccess(ticket, activeShift);
      if (!result.ok) {
        setStateAndMessage("redeem-error", "No se pudo registrar el canje del ticket.");
        if (audioEnabled) {
          playError();
        }
        return;
      }

      setStateAndMessage("access-granted", `Acceso concedido para ${ticket.holderName}.`);
      setModalMessage(`Acceso concedido para ${ticket.holderName}.`);
      if (audioEnabled) {
        playSuccess();
      }
    } catch {
      setStateAndMessage("redeem-error", "Se produjo un error durante el canje del ticket.");
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
    <main className="min-h-screen bg-brand-dark text-white">
      <ScannerHeader
        activeShift={activeShift}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled((current) => !current)}
        onChangeShift={handleChangeShift}
      />

      {!activeShift ? (
        <section className="px-4 pb-10 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <ShiftSelector options={scannerShiftOptions} selectedId={selectedShiftId} onSelect={handleSelectShift} />
          </div>
        </section>
      ) : (
        <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 flex flex-col gap-3 rounded-[26px] border border-white/10 bg-brand-surface/80 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent/80">Puesto confirmado</p>
                <h2 className="mt-1 text-xl font-bold text-white">{activeShift.label} · {activeShift.courtName}</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFacingMode((current) => (current === "environment" ? "user" : "environment"))}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-accent/40 hover:text-brand-accent"
                >
                  Cambiar cámara
                </button>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="rounded-full bg-brand-accent px-4 py-2 text-xs font-bold text-brand-dark transition hover:bg-brand-accent/90"
                >
                  {flowState === "scanning" ? "Cámara activa" : "Iniciar cámara"}
                </button>
              </div>
            </div>

            {cameraToast ? (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
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
                className="rounded-[28px] border border-white/10 bg-brand-surface/90 p-5"
              >
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-accent/80">Estado del turno</p>
                  <h3 className="mt-2 text-xl font-bold text-white">{activeShift.courtName}</h3>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                    <span>Horario</span>
                    <span className="font-semibold text-white">{activeShift.startTime} - {activeShift.endTime}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                    <span>Instalación</span>
                    <span className="font-semibold text-white">{activeShift.venueName}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                    <span>Validación</span>
                    <span className="font-semibold text-brand-accent">{flowState}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-brand-accent/25 bg-brand-accent/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
                    {flowState === "scanning" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                    {flowState === "scanning" ? "Escaneando activo" : "Esperando QR"}
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    {flowState === "scanning"
                      ? "Apunte al código del ticket para validar el acceso del cliente."
                      : "Confirme el turno y active la cámara para iniciar lectura."}
                  </p>
                </div>

                {flowState === "validating-ticket" ? (
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
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
