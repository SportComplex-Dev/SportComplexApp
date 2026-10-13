"use client";

import { useCallback, useEffect, useState } from "react";

export const SCANNER_TICKET_CACHE_KEY = "scanner_ticket_cache_v1";

/**
 * Información de consulta permitida para almacenamiento en caché local.
 * Conforme a TSK-FE-24: Únicamente datos informativos de visualización
 * (titular, servicio, fecha y franja horaria).
 * NO almacena secretos, firmas criptográficas ni resultados transaccionales.
 */
export interface TicketConsultationData {
  ticketId: string;
  titularNombre: string;
  servicioNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cachedAt?: string;
}

export interface NetworkResilienceState {
  isOnline: boolean;
  executeWithRetry: <T>(
    fn: () => Promise<T>,
    maxRetries?: number,
  ) => Promise<T>;
  getCachedTicket: (
    ticketCode: string,
  ) => TicketConsultationData | null;
  setCachedTicket: (
    ticketCode: string,
    data: TicketConsultationData,
  ) => void;
}

export class HttpError extends Error {
  status: number;
  isTransient: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    // 502, 503, 504 son fallos transitorios de red / pasarela
    this.isTransient = status === 502 || status === 503 || status === 504;
  }
}

/**
 * Determina si un error corresponde a un fallo transitorio de red
 * susceptible de ser reintentado.
 * Descarta errores de negocio (4xx), autenticación, permisos o validación.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      status?: number;
      statusCode?: number;
      isTransient?: boolean;
    };

    if (typeof candidate.isTransient === "boolean") {
      return candidate.isTransient;
    }

    const status = candidate.status ?? candidate.statusCode;
    if (typeof status === "number") {
      if (status >= 400 && status < 500) {
        return false;
      }
      if (status === 502 || status === 503 || status === 504) {
        return true;
      }
      return false;
    }
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const msg = error.message.toLowerCase();

    if (
      name === "typeerror" ||
      name === "fetcherror" ||
      name === "networkerror" ||
      name === "timeouterror" ||
      name === "aborterror"
    ) {
      return true;
    }

    if (
      msg.includes("failed to fetch") ||
      msg.includes("fetch failed") ||
      msg.includes("network error") ||
      msg.includes("networkrequestfailed") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("connection refused") ||
      msg.includes("timeout") ||
      msg.includes("sin conexión") ||
      msg.includes("offline")
    ) {
      return true;
    }
  }

  return false;
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Ejecuta una operación asíncrona con backoff exponencial estricto (1s, 2s, 4s)
 * reintentando ÚNICAMENTE ante fallos transitorios de red.
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayFn: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      attempt += 1;
      if (attempt > maxRetries || !isTransientNetworkError(error)) {
        throw error;
      }
      const delayMs = DEFAULT_RETRY_DELAYS_MS[attempt - 1] ?? 4000;
      await delayFn(delayMs);
    }
  }
}

/**
 * Sanitiza los datos de un ticket para asegurar que ÚNICAMENTE se guarden
 * los campos informativos permitidos por TSK-FE-24.
 */
export function sanitizeTicketConsultationData(
  data: unknown,
): TicketConsultationData | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const d = data as Record<string, unknown>;
  const ticketId =
    typeof d.ticketId === "string"
      ? d.ticketId
      : typeof d.id === "string"
        ? d.id
        : null;
  const titularNombre =
    typeof d.titularNombre === "string" ? d.titularNombre : null;
  const servicioNombre =
    typeof d.servicioNombre === "string" ? d.servicioNombre : null;
  const fecha = typeof d.fecha === "string" ? d.fecha : null;
  const horaInicio = typeof d.horaInicio === "string" ? d.horaInicio : null;
  const horaFin = typeof d.horaFin === "string" ? d.horaFin : null;
  const cachedAt =
    typeof d.cachedAt === "string" ? d.cachedAt : new Date().toISOString();

  if (
    !ticketId ||
    !titularNombre ||
    !servicioNombre ||
    !fecha ||
    !horaInicio ||
    !horaFin
  ) {
    return null;
  }

  return {
    ticketId,
    titularNombre,
    servicioNombre,
    fecha,
    horaInicio,
    horaFin,
    cachedAt,
  };
}

export function readCacheFromStorage(
  storage?: Storage,
): Record<string, TicketConsultationData> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(SCANNER_TICKET_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, TicketConsultationData>;
  } catch {
    return {};
  }
}

export function writeCacheToStorage(
  cache: Record<string, TicketConsultationData>,
  storage?: Storage,
): void {
  if (!storage) return;
  try {
    storage.setItem(SCANNER_TICKET_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Manejo seguro ante cuotas excedidas o almacenamiento deshabilitado
  }
}

export function getCachedTicketHelper(
  ticketCode: string,
  storage?: Storage,
): TicketConsultationData | null {
  if (!ticketCode || typeof ticketCode !== "string") return null;
  const key = ticketCode.trim();
  if (!key) return null;

  try {
    const targetStorage =
      storage ??
      (typeof window !== "undefined" ? window.localStorage : undefined);
    const cache = readCacheFromStorage(targetStorage);
    const entry = cache[key];
    return sanitizeTicketConsultationData(entry);
  } catch {
    return null;
  }
}

export function setCachedTicketHelper(
  ticketCode: string,
  data: TicketConsultationData,
  storage?: Storage,
): void {
  if (!ticketCode || typeof ticketCode !== "string") return;
  const key = ticketCode.trim();
  if (!key) return;

  const sanitized = sanitizeTicketConsultationData(data);
  if (!sanitized) return;

  try {
    const targetStorage =
      storage ??
      (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!targetStorage) return;
    const cache = readCacheFromStorage(targetStorage);
    cache[key] = sanitized;
    writeCacheToStorage(cache, targetStorage);
  } catch {
    // Almacenamiento inaccesible o fallo silenciado de forma segura
  }
}

/**
 * Hook de resiliencia de red para el escáner de boletos (TSK-FE-24).
 * Proporciona:
 * 1. Estado reactivo de conectividad (`isOnline`) con soporte SSR.
 * 2. `executeWithRetry` con backoff exponencial para lecturas.
 * 3. `getCachedTicket` y `setCachedTicket` con clave `scanner_ticket_cache_v1`.
 */
export function useNetworkResilience(): NetworkResilienceState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return true; // Inicialización segura compatible con SSR
    }
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getCachedTicket = useCallback(
    (ticketCode: string): TicketConsultationData | null => {
      return getCachedTicketHelper(ticketCode);
    },
    [],
  );

  const setCachedTicket = useCallback(
    (ticketCode: string, data: TicketConsultationData): void => {
      setCachedTicketHelper(ticketCode, data);
    },
    [],
  );

  const executeWithRetryCb = useCallback(
    <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
      return executeWithRetry(fn, maxRetries);
    },
    [],
  );

  return {
    isOnline,
    executeWithRetry: executeWithRetryCb,
    getCachedTicket,
    setCachedTicket,
  };
}
