"use client";

import { useEffect } from "react";
import { MapPin, ShieldAlert } from "lucide-react";
import { parseZoneMismatch } from "../services/scannerService";

export interface ZoneMismatchScreenProps {
  /** Mensaje literal devuelto por el backend (HTTP 403 SERVICE_MISMATCH). */
  message: string;
  /** Ticket escaneado (solo referencia, sin acciones). */
  ticketId?: string;
  /** Nombre del puesto actual; si se omite se usa el extraído del mensaje. */
  postServiceName?: string;
  onContinue: () => void;
}

/**
 * TSK-FE-16 (HU-16 / RF-14): alerta roja de discrepancia de zona.
 * Presenta el texto literal del 403 con el servicio correcto (destino del
 * usuario) destacado para lectura de un vistazo. Pantalla bloqueante sin
 * acciones de canje: el boleto permanece EMITIDO.
 */
export function ZoneMismatchScreen({
  message,
  ticketId,
  postServiceName,
  onContinue,
}: ZoneMismatchScreenProps) {
  const parsed = parseZoneMismatch(message);
  const destination = parsed?.ticketService;
  const currentPost = postServiceName?.trim() || parsed?.postService;

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
      aria-labelledby="zone-mismatch-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-md dark:bg-[#111815] sm:p-6"
      role="alertdialog"
    >
      <div className="my-auto w-full max-w-3xl rounded-3xl border border-rose-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-rose-500/30 dark:bg-[#1a2420] dark:text-white sm:p-8">
        <header className="text-center">
          <div className="mx-auto mb-4 flex size-16 animate-pulse items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <ShieldAlert aria-hidden="true" size={34} strokeWidth={1.8} />
          </div>
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-mono text-xs font-bold tracking-wide text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300">
            [ESTADO: DENEGADO_SERVICIO / BOLETO EMITIDO]
          </p>
          <h1
            className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl"
            id="zone-mismatch-title"
          >
            {message}
          </h1>
          {ticketId ? (
            <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
              Ticket: {ticketId}
            </p>
          ) : null}
        </header>

        {destination ? (
          <div className="mt-7 rounded-2xl border border-rose-500/40 bg-rose-600 p-5 text-center text-white shadow-lg dark:bg-rose-800 sm:p-6">
            <p className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.2em]">
              <MapPin aria-hidden="true" size={14} />
              DIRIJA AL USUARIO A
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {destination}
            </p>
          </div>
        ) : null}

        {currentPost ? (
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
            Puesto actual: <strong>{currentPost}</strong>
          </p>
        ) : null}

        <aside className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-700 dark:bg-[#111815] dark:text-slate-200 sm:p-5">
          <p className="font-bold">Guía para el empleado</p>
          <p className="mt-1">
            El tiquete no pertenece a este puesto: el acceso fue denegado
            únicamente por discrepancia de zona. El boleto permanece{" "}
            <strong className="font-mono">EMITIDO</strong> y no fue consumido.
            Esta pantalla es solo informativa: no concede accesos.
          </p>
        </aside>

        <div className="mt-6">
          <button
            autoFocus
            className="min-h-14 w-full rounded-xl bg-rose-700 px-5 py-4 text-base font-bold text-white transition hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 dark:bg-rose-800 dark:hover:bg-rose-700"
            onClick={onContinue}
            type="button"
          >
            Entendido / Continuar escaneando
          </button>
        </div>
      </div>
    </section>
  );
}

export default ZoneMismatchScreen;
