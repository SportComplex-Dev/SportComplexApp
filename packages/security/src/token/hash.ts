import { randomInt } from "node:crypto";

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
 * Carga dinámica aislada de argon2 para evitar que Turbopack/Next.js
 * lo resuelva en el bundle de cliente mediante su entrypoint 'browser.js'.
 */
async function getArgon2() {
  if (typeof window !== "undefined") {
    throw new Error("Argon2 solo está disponible en el entorno de servidor.");
  }
  return import("@node-rs/argon2");
}

/**
 * Hashea un secreto (código de 6 dígitos) con Argon2id.
 * Parámetros: memoryCost=19456 KiB (19 MiB), timeCost=2, parallelism=1.
 * Equivalente a "costo" ≥ 12 en términos de resistencia a GPU/ASIC.
 * @param {string} plain - Código en claro (nunca persistir)
 * @returns {Promise<string>} Hash codificado en formato PHC ($argon2id$v=19$m=19456,t=2,p=1$...)
 */
export async function hashSecret(plain: string): Promise<string> {
  const { hash } = await getArgon2();
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
    const { verify } = await getArgon2();
    return await verify(hash, plain);
  } catch {
    return false;
  }
}
