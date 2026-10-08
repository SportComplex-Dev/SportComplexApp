"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";

import type { ScannerFlowState, TicketValidationResponse } from "@/components/scanner/scanner.service";

type TicketValidationModalProps = {
  isOpen: boolean;
  state: ScannerFlowState;
  ticket: TicketValidationResponse | null;
  message: string;
  isRedeeming: boolean;
  onClose: () => void;
  onRedeem: () => void;
  onScanNext: () => void;
};

export function TicketValidationModal({
  isOpen,
  state,
  ticket,
  message,
  isRedeeming,
  onClose,
  onRedeem,
  onScanNext,
}: TicketValidationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isOpen, onClose]);

  const isGranted = state === "access-granted";
  const isValidating = state === "validating-ticket";
  const isValidTicket = state === "ticket-valid" || isGranted;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-dialog-title"
            className="relative w-full max-w-xl overflow-hidden rounded-[30px] border border-brand-border bg-brand-surface p-5 text-brand-text shadow-[0_30px_80px_rgba(3,8,6,0.35)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-2xl",
                    isValidTicket ? "bg-brand-emerald text-brand-accent" : "bg-brand-danger-bg text-brand-danger-text",
                  ].join(" ")}
                >
                  {isValidTicket ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">Validación</p>
                  <h3 id="ticket-dialog-title" className="text-xl font-bold text-brand-text">
                    {isGranted ? "Acceso concedido" : isValidTicket ? "Acceso válido" : "Acceso denegado"}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                aria-label="Cerrar diálogo"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-brand-control text-brand-muted transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isValidating ? (
              <div role="status" className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-control p-5 text-sm text-brand-text">
                <Loader2 className="h-5 w-5 animate-spin text-brand-accent" />
                {message}
              </div>
            ) : isValidTicket && ticket ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-accent/30 bg-brand-emerald p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
                      {isGranted ? "Canje registrado" : "Ticket validado"}
                    </p>
                    <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                      {isGranted ? "Concedido" : "Válido"}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-brand-text">{ticket.userName ?? "Titular del ticket"}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-brand-border bg-brand-control p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Código del ticket</p>
                    <p className="mt-2 break-all font-medium text-brand-text">{ticket.ticketId}</p>
                  </div>
                  <div className="rounded-2xl border border-brand-border bg-brand-control p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Cancha/Instalación</p>
                    <p className="mt-2 font-medium text-brand-text">{ticket.targetCourtName ?? "Puesto activo"}</p>
                  </div>
                </div>

                <p role="status" className="rounded-2xl border border-brand-border bg-brand-control px-4 py-3 text-sm text-brand-muted">
                  {message}
                </p>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  {isGranted ? (
                    <button
                      type="button"
                      onClick={onScanNext}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-accent px-4 py-3 text-sm font-bold text-brand-on-accent transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Escanear siguiente
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onRedeem}
                      disabled={isRedeeming}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-accent px-4 py-3 text-sm font-bold text-brand-on-accent transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    >
                      {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {isRedeeming ? "Dando acceso..." : "Dar Acceso"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-brand-border bg-brand-control px-4 py-3 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-danger-border bg-brand-danger-bg p-4 text-brand-danger-text">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <ShieldAlert className="h-5 w-5" />
                    {state === "access-denied"
                      ? "ACCESO DENEGADO"
                      : state === "redeem-error"
                        ? "Canje no confirmado"
                        : "Código no válido"}
                  </div>
                  <p className="mt-2 text-sm">{message}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={onScanNext}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-danger-solid px-4 py-3 text-sm font-bold text-brand-on-danger transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger-solid"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Escanear siguiente
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-brand-border bg-brand-control px-4 py-3 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
