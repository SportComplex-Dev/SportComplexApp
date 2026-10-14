import ky from "ky";

// Cliente Nager.Date CO con timeout estricto de 2.5s (ARCHITECTURE §9.4 / SCRUM-103)
const BASE = process.env.NAGER_DATE_BASE_URL ?? "https://date.nager.at/api/v3";
export const STRICT_TIMEOUT_MS = 2500; // 2.5 segundos

export interface NagerHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
}

export interface FetchHolidaysOptions {
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Cliente HTTP contra https://date.nager.at/api/v3/PublicHolidays/{year}/CO.
 * Aplica un timeout estricto de 2.5 segundos (2500ms) sin retries que excedan el presupuesto temporal.
 *
 * @param {number} year - Año de consulta (ej. 2026)
 * @param {FetchHolidaysOptions} [options] - Configuración opcional de timeout o URL base
 * @returns {Promise<NagerHoliday[]>} Lista de festivos de Colombia
 */
export async function fetchColombiaHolidays(
  year: number,
  options?: FetchHolidaysOptions,
): Promise<NagerHoliday[]> {
  const baseUrl = options?.baseUrl ?? BASE;
  const timeoutMs = options?.timeoutMs ?? STRICT_TIMEOUT_MS;

  return ky
    .get(`${baseUrl}/PublicHolidays/${year}/CO`, {
      timeout: timeoutMs,
      retry: 0,
    })
    .json<NagerHoliday[]>();
}
