"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldAlert, UserRound, X } from "lucide-react";
import { useEffect } from "react";

import type { ResolvedTicket, ScannerFlowState } from "@/components/scanner/mock-access";

type TicketValidationModalProps = {
  isOpen: boolean;
  state: ScannerFlowState;
  ticket: ResolvedTicket | null;
  message: string;
  isRedeeming: boolean;
  onClose: () => void;
  onRedeem: () => void;
  onScanNext: () => void;
};

const infoRows = [
  { label: "Código de reserva", key: "code" },
  { label: "Titular", key: "holder" },
  { label: "Cancha/Instalación", key: "court" },
  { label: "Horario", key: "slot" },
  { label: "Asistentes", key: "attendees" },
] as const;

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
    if (!isOpen) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isOpen, onClose]);

  const isValidTicket = state === "ticket-valid";

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#09110f]/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-dialog-title"
            className="relative w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-brand-surface/95 p-5 shadow-[0_30px_80px_rgba(3,8,6,0.8)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-2xl",
                    isValidTicket ? "bg-brand-emerald/20 text-brand-accent" : "bg-red-500/15 text-red-300",
                  ].join(" ")}
                >
                  {isValidTicket ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Validación</p>
                  <h3 id="ticket-dialog-title" className="text-xl font-bold text-white">
                    {isValidTicket ? "Acceso válido" : "Acceso denegado"}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                aria-label="Cerrar diálogo"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-brand-accent/40 hover:text-brand-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isValidTicket && ticket ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-accent/30 bg-brand-emerald/10 p-4 text-brand-limeSoft">
                  <p className="text-xs uppercase tracking-[0.18em] text-brand-accent">Ticket validado</p>
                  <p className="mt-2 text-lg font-semibold">{ticket.holderName}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {infoRows.map((row) => {
                    let value = "";
                    if (row.key === "code") value = ticket.code;
                    if (row.key === "holder") value = ticket.holderName;
                    if (row.key === "court") value = ticket.courtName;
                    if (row.key === "slot") value = `${ticket.startTime} - ${ticket.endTime}`;
                    if (row.key === "attendees") value = `${ticket.attendees} asistentes`;

                    return (
                      <div key={row.label} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{row.label}</p>
                        <p className="mt-2 font-medium text-white">{value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-brand-accent" />
                    {ticket.venueName}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-brand-accent" />
                    {ticket.startTime}
                  </span>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={onRedeem}
                    disabled={isRedeeming}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-accent px-4 py-3 text-sm font-bold text-brand-dark transition hover:bg-brand-accent/90 disabled:cursor-not-allowed disabled:bg-brand-accent/60"
                  >
                    {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isRedeeming ? "Dando acceso..." : "Dar Acceso"}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-brand-accent/30 hover:text-brand-accent"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <ShieldAlert className="h-5 w-5" />
                    {state === "access-denied" ? "ACCESO DENEGADO" : "Tarjeta no válida"}
                  </div>
                  <p className="mt-2 text-sm text-red-100/90">{message}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={onScanNext}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-400"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Escanear siguiente
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-brand-accent/30 hover:text-brand-accent"
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
