"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";

import type {
  RedeemTicketResponse,
  ScannerFlowState,
  ScannedTicket,
} from "@/components/scanner/scanner.service";

type TicketValidationModalProps = {
  isOpen: boolean;
  state: ScannerFlowState;
  ticket: ScannedTicket | null;
  message: string;
  employeeName: string;
  isRedeeming: boolean;
  onClose: () => void;
  onRedeem: () => void;
  onScanNext: () => void;
};

function TicketDetails({ ticket }: { ticket: NonNullable<RedeemTicketResponse["ticket"]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-brand-border bg-brand-control p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Reserva</p>
        <p className="mt-2 break-all font-medium text-brand-text">{ticket.reservaId}</p>
      </div>
      <div className="rounded-2xl border border-brand-border bg-brand-control p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Servicio reservado</p>
        <p className="mt-2 font-medium text-brand-text">{ticket.servicioNombre}</p>
      </div>
      <div className="rounded-2xl border border-brand-border bg-brand-control p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Fecha y horario</p>
        <p className="mt-2 font-medium text-brand-text">
          {ticket.fecha} · {ticket.horaInicio.slice(0, 5)}–{ticket.horaFin.slice(0, 5)}
        </p>
      </div>
      <div className="rounded-2xl border border-brand-border bg-brand-control p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-brand-muted">Estado del boleto</p>
        <p className="mt-2 font-medium text-brand-text">{ticket.estado}</p>
      </div>
    </div>
  );
}

function denialLabel(code: RedeemTicketResponse["code"]): string | null {
  switch (code) {
    case "ALREADY_USED":
      return "ALREADY_USED · Boleto ya utilizado anteriormente";
    case "SERVICE_MISMATCH":
      return "SERVICE_MISMATCH · El ticket pertenece a otro escenario deportivo";
    case "WINDOW_EXPIRED":
      return "WINDOW_EXPIRED · Franja horaria vencida o no disponible";
    default:
      return code ?? null;
  }
}

export function TicketValidationModal({
  isOpen,
  state,
  ticket,
  message,
  employeeName,
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

  const result = ticket?.result;
  const isGranted = state === "access-granted";
  const isDenied = state === "access-denied";
  const isPending = state === "redeeming";
  const denial = denialLabel(result?.code);
  const detailTicket = result?.ticket;

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
                    isGranted
                      ? "bg-brand-emerald text-brand-accent"
                      : "bg-brand-danger-bg text-brand-danger-text",
                  ].join(" ")}
                >
                  {isGranted ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">Canje de ticket</p>
                  <h3 id="ticket-dialog-title" className="text-xl font-bold text-brand-text">
                    {isGranted
                      ? "Acceso Concedido"
                      : isDenied
                        ? "Acceso denegado"
                        : state === "ticket-valid"
                          ? "QR listo para canje"
                          : "No se pudo validar el QR"}
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

            {isPending ? (
              <div role="status" className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-control p-5 text-sm text-brand-text">
                <Loader2 className="h-5 w-5 animate-spin text-brand-accent" />
                {message}
              </div>
            ) : isGranted ? (
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-2xl border border-brand-accent/30 bg-brand-emerald p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Canje registrado</p>
                    <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                      Concedido
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-brand-text">
                    {detailTicket?.titularNombre ?? "Titular del ticket"}
                  </p>
                </motion.div>

                {detailTicket ? <TicketDetails ticket={detailTicket} /> : null}
                <div className="rounded-2xl border border-brand-border bg-brand-control p-3 text-sm text-brand-text">
                  <p><span className="text-brand-muted">Empleado lector:</span> {employeeName || "Sesión autorizada"}</p>
                  <p className="mt-1 break-all"><span className="text-brand-muted">Ticket:</span> {ticket?.ticketId}</p>
                </div>
                <p role="status" className="rounded-2xl border border-brand-accent/30 bg-brand-accent/10 px-4 py-3 text-sm text-brand-text">
                  {message}
                </p>
                <button
                  type="button"
                  onClick={onScanNext}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-4 py-3 text-sm font-bold text-brand-on-accent transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Escanear siguiente
                </button>
              </div>
            ) : isDenied ? (
              <div className="space-y-4">
                <div role="alert" className="rounded-2xl border border-brand-danger-border bg-brand-danger-bg p-4 text-brand-danger-text">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <ShieldAlert className="h-5 w-5" />
                    {denial ?? "ACCESO DENEGADO"}
                  </div>
                  <p className="mt-2 text-sm">{message}</p>
                </div>
                {detailTicket ? <TicketDetails ticket={detailTicket} /> : null}
                <button
                  type="button"
                  onClick={onScanNext}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-danger-solid px-4 py-3 text-sm font-bold text-brand-on-danger transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger-solid"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Escanear siguiente
                </button>
              </div>
            ) : state === "ticket-valid" && ticket ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-accent/30 bg-brand-emerald p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Firma QR válida</p>
                  <p className="mt-2 break-all text-sm font-medium text-brand-text">{ticket.ticketId}</p>
                  <p className="mt-2 text-sm text-brand-muted">{message}</p>
                </div>
                <button
                  type="button"
                  onClick={onRedeem}
                  disabled={isRedeeming}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-4 py-3 text-sm font-bold text-brand-on-accent transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  {isRedeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Dar Acceso
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div role="alert" className="rounded-2xl border border-brand-danger-border bg-brand-danger-bg p-4 text-brand-danger-text">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <ShieldAlert className="h-5 w-5" />
                    {state === "redeem-error" ? "Canje no confirmado" : "Código no válido"}
                  </div>
                  <p className="mt-2 text-sm">{message}</p>
                </div>
                <button
                  type="button"
                  onClick={onScanNext}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-danger-solid px-4 py-3 text-sm font-bold text-brand-on-danger transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger-solid"
                >
                  Escanear siguiente
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
