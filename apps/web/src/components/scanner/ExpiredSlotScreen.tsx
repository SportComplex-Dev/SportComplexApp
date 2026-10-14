"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Clock3, Ticket } from "lucide-react";
import { ACCESS_WINDOW_EXPIRED_MESSAGE, TIMEZONE } from "@sportcomplex/core";
import type { ExpiredSlotDetails } from "@/components/scanner/scanner.service";

interface ExpiredSlotScreenProps {
  userName: string;
  ticketId: string;
  reservationId: string;
  targetCourtName: string;
  expiredDetails: ExpiredSlotDetails;
  message?: string;
  cameraError?: string;
  onContinue: () => void;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIMEZONE,
  }).format(new Date(value));
}

export default function ExpiredSlotScreen({
  userName,
  ticketId,
  reservationId,
  targetCourtName,
  expiredDetails,
  message,
  cameraError,
  onContinue,
}: ExpiredSlotScreenProps) {
  const isBeforeWindow = expiredDetails.windowPosition === "BEFORE";
  const distance = expiredDetails.minutesFromBoundary;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onContinue();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  return (
    <section
      aria-labelledby="expired-slot-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-md dark:bg-[#111815] sm:p-6"
      role="alertdialog"
    >
      <div className="my-auto w-full max-w-3xl rounded-3xl border border-rose-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-rose-500/30 dark:bg-[#1a2420] dark:text-white sm:p-8">
        <header className="text-center">
          <div className="mx-auto mb-4 flex size-16 animate-pulse items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <Clock3 aria-hidden="true" size={34} strokeWidth={1.8} />
          </div>
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-mono text-xs font-bold tracking-wide text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300">
            <Ticket aria-hidden="true" size={14} />
            [ESTADO: DENEGADO_HORARIO / BOLETO EMITIDO]
          </p>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl" id="expired-slot-title">
            {message ?? ACCESS_WINDOW_EXPIRED_MESSAGE}
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {userName} <span aria-hidden="true">·</span> {targetCourtName}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
            Ticket: {ticketId}
          </p>
          {reservationId ? (
            <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
              Reserva: {reservationId}
            </p>
          ) : null}
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-950/30">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-600 dark:text-slate-300">
              HORA RESERVADA
            </p>
            <p className="mt-3 font-mono text-2xl font-bold text-amber-800 dark:text-amber-400">
              {expiredDetails.slotStart} - {expiredDetails.slotEnd}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Hora legal de Colombia ({TIMEZONE})
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-500/30 dark:bg-rose-950/30">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-600 dark:text-slate-300">
              HORA DEL INTENTO ({TIMEZONE})
            </p>
            <p className="mt-3 font-mono text-3xl font-bold text-rose-700 dark:text-white">
              {formatTime(expiredDetails.scannedAt)}
            </p>
            <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-100 px-3 py-1 font-mono text-sm font-bold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-300">
              {isBeforeWindow ? `Faltan ${distance} min para iniciar` : `Finalizó hace ${distance} min`}
            </span>
          </div>
        </div>

        <aside className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-700 dark:bg-[#111815] dark:text-slate-200 sm:p-5">
          <p className="font-bold">Guía para el empleado</p>
          <p className="mt-1">
            {isBeforeWindow
              ? <>El intento se registró antes del inicio de la franja. El acceso solo está permitido entre <strong className="font-mono">{expiredDetails.slotStart}</strong> y <strong className="font-mono">{expiredDetails.slotEnd}</strong>.</>
              : <>El intento se registró después de finalizar la franja reservada.</>}
            {" "}El acceso fue denegado únicamente por la restricción horaria: el boleto permanece
            <strong className="font-mono"> EMITIDO</strong> y no fue consumido.
          </p>
        </aside>

        <div className="mt-6 grid gap-3">
          {cameraError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-200" role="alert">
              {cameraError}
            </p>
          )}
          <button
            autoFocus
            className="min-h-14 w-full rounded-xl bg-rose-700 px-5 py-4 text-base font-bold text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 dark:bg-rose-800 dark:hover:bg-rose-700"
            onClick={onContinue}
            type="button"
          >
            Entendido / Continuar Escaneando
          </button>
          <Link
            className="min-h-12 rounded-xl border border-slate-300 px-5 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/5"
            href="/pos"
          >
            Derivar a Taquilla / POS
          </Link>
        </div>
      </div>
    </section>
  );
}
