"use client";

import { MapPin, ShieldAlert } from "lucide-react";

export interface ServiceMismatch {
  /** Servicio al que pertenece el tiquete: zona a la que se debe dirigir al usuario. */
  ticketService: string;
  /** Servicio del puesto actual donde se realizó la lectura. */
  postService: string;
}

const MISMATCH_PATTERN = /pertenece a (.+?) y se encuentra en (.+?)\s*$/i;

/**
 * Extrae ambos servicios del mensaje literal del backend (TSK-BE-16):
 * "Acceso denegado: El tiquete pertenece a {X} y se encuentra en {Y}".
 * Devuelve `null` si el mensaje no sigue ese formato.
 */
export function parseServiceMismatch(message: string): ServiceMismatch | null {
  const match = MISMATCH_PATTERN.exec(message.trim());
  if (!match) return null;
  const ticketService = match[1].trim();
  const postService = match[2].trim();
  if (ticketService.length === 0 || postService.length === 0) return null;
  return { ticketService, postService };
}

type ServiceMismatchAlertProps = {
  /** Mensaje literal devuelto por el backend (HTTP 403 SERVICE_MISMATCH). */
  message: string;
  /** Nombre del puesto actual; si se omite se usa el extraído del mensaje. */
  postServiceName?: string;
};

/**
 * TSK-FE-16 (HU-16 / RF-14): alerta roja de discrepancia de zona.
 * Muestra el texto literal del 403 con el servicio correcto (destino del
 * usuario) destacado para lectura de un vistazo. Sin acciones de canje.
 */
export function ServiceMismatchAlert({ message, postServiceName }: ServiceMismatchAlertProps) {
  const parsed = parseServiceMismatch(message);
  const destination = parsed?.ticketService;
  const currentPost = postServiceName?.trim() || parsed?.postService;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-brand-danger-border bg-brand-danger-bg p-4 text-brand-danger-text"
    >
      <div className="flex items-center gap-2 text-base font-semibold">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        Discrepancia de zona
      </div>

      {destination ? (
        <div className="mt-3 rounded-xl border border-brand-danger-border bg-brand-surface p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Dirija al usuario a
          </p>
          <p className="mt-1 flex items-center gap-2 text-xl font-bold text-brand-text">
            <MapPin className="h-5 w-5 shrink-0 text-brand-danger-text" />
            <strong>{destination}</strong>
          </p>
        </div>
      ) : null}

      <p className="mt-2 text-sm">{message}</p>

      {currentPost ? (
        <p className="mt-1 text-xs text-brand-muted">
          Puesto actual: <span className="font-semibold">{currentPost}</span>
        </p>
      ) : null}
    </div>
  );
}
