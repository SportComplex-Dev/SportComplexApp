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
 * Comprueba si un token ha expirado comparando `expiraEn` con `now`.
 * Retorna `true` al alcanzar o superar la fecha de expiración.
 * @param {Date} expiraEn - Fecha de expiración del token
 * @param {Date} [now=new Date()] - Instante de referencia (inyectable para tests)
 * @returns {boolean} `true` si expiró, `false` si aún vigente
 */
export function isTokenExpired(expiraEn: Date, now = new Date()): boolean {
  return now.getTime() >= expiraEn.getTime();
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
