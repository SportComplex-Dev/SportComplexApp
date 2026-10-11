/**
 * Utilidades puras para el temporizador regresivo de checkout (TSK-FE-09 / SCRUM-117 / HU-09).
 */

export const CHECKOUT_TTL_SECONDS = 1800; // 30 minutos según HU-09 / RF-08 / RN-04
export const WARNING_THRESHOLD_SECONDS = 300; // Últimos 5 minutos

/**
 * Formatea segundos en formato MM:SS garantizando padding de 2 dígitos.
 */
export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00';
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calcula los segundos restantes contra un timestamp de expiración en ms.
 */
export function calculateRemainingSeconds(
  expiresAt: number | undefined,
  nowMs: number = Date.now(),
  defaultSeconds: number = CHECKOUT_TTL_SECONDS
): number {
  if (expiresAt === undefined || expiresAt === null || !Number.isFinite(expiresAt)) {
    return defaultSeconds;
  }
  const diffMs = expiresAt - nowMs;
  return Math.max(0, Math.floor(diffMs / 1000));
}

export type TimerStatus = 'active' | 'warning' | 'expired';

/**
 * Determina el estado del cupo según los segundos restantes.
 */
export function getTimerStatus(remainingSeconds: number): TimerStatus {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return 'expired';
  if (remainingSeconds <= WARNING_THRESHOLD_SECONDS) return 'warning';
  return 'active';
}

/**
 * Verifica si la acción de pago debe ser bloqueada por expiración del cupo.
 * Falla de forma cerrada (fail-secure): valores no finitos (NaN, Infinity) bloquean el pago.
 */
export function isPaymentBlocked(remainingSeconds: number): boolean {
  if (!Number.isFinite(remainingSeconds)) return true;
  return remainingSeconds <= 0;
}

/**
 * Calcula el porcentaje restante de la barra de progreso (0..100).
 */
export function calculateProgressPercentage(
  remainingSeconds: number,
  totalSeconds: number = CHECKOUT_TTL_SECONDS
): number {
  if (!Number.isFinite(remainingSeconds) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  const ratio = (remainingSeconds / totalSeconds) * 100;
  return Math.min(100, Math.max(0, ratio));
}
