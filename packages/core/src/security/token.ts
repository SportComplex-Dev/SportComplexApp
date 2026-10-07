import { randomInt } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/**
 * Tiempo de vida del token de verificación: 15 minutos.
 * @constant {number} TOKEN_TTL_MS
 */
export const TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Enfriamiento entre reenvíos: 60 segundos.
 * Validado contra `creado_en` del token más reciente.
 * @constant {number} RESEND_COOLDOWN_MS
 */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Longitud del código de verificación: 6 dígitos.
 * @constant {number} VERIFICATION_CODE_LENGTH
 */
export const VERIFICATION_CODE_LENGTH = 6;

/**
 * Algoritmo Argon2id (valor 2 según especificación RFC 9106).
 * @constant {number} ARGON2ID_ALGORITHM
 */
const ARGON2ID_ALGORITHM = 2;

/**
 * Genera un código de verificación criptográficamente seguro de 6 dígitos.
 * Usa `crypto.randomInt` (CSPRNG) para entropía uniforme.
 * @returns {string} Código cero-rellenado, ej. "048291"
 */
export function generateVerificationCode(): string {
  const code = randomInt(0, 10 ** VERIFICATION_CODE_LENGTH);
  return code.toString().padStart(VERIFICATION_CODE_LENGTH, "0");
}

/**
 * Hashea un secreto (código de 6 dígitos) con Argon2id.
 * Parámetros: memoryCost=19456 KiB (19 MiB), timeCost=2, parallelism=1.
 * Equivalente a "costo" ≥ 12 en términos de resistencia a GPU/ASIC.
 * @param {string} plain - Código en claro (nunca persistir)
 * @returns {Promise<string>} Hash codificado en formato PHC ($argon2id$v=19$m=19456,t=2,p=1$...)
 */
export async function hashSecret(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: ARGON2ID_ALGORITHM,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verifica un secreto contra su hash Argon2id en tiempo constante.
 * @param {string} hash - Hash almacenado en BD (formato PHC)
 * @param {string} plain - Código proporcionado por el usuario
 * @returns {Promise<boolean>} `true` si coinciden, `false` en caso contrario o error
 */
export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Comprueba si un token ha expirado comparando `expiraEn` con `now`.
 * Un código de hace 15:01 minutos retorna `true` (expirado).
 * @param {Date} expiraEn - Fecha de expiración del token
 * @param {Date} [now=new Date()] - Instante de referencia (inyectable para tests)
 * @returns {boolean} `true` si expiró, `false` si aún vigente
 */
export function isTokenExpired(expiraEn: Date, now = new Date()): boolean {
  return now.getTime() > expiraEn.getTime();
}

/**
 * Comprueba si ha pasado el enfriamiento de 60s desde `creadoEn`.
 * Valida rate limit de reenvío contra timestamp de creación del token.
 * @param {Date} creadoEn - Fecha de creación del token más reciente
 * @param {Date} [now=new Date()] - Instante de referencia (inyectable para tests)
 * @returns {boolean} `true` si permite reenvío, `false` si aún en enfriamiento (HTTP 429)
 */
export function isResendAllowed(creadoEn: Date, now = new Date()): boolean {
  return now.getTime() - creadoEn.getTime() >= RESEND_COOLDOWN_MS;
}