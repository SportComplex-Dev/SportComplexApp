/**
 * Limitador de tasa en memoria (TSK-BE-03).
 *
 * Diseño intencional sin estado persistente: la ventana de un token es corta
 * (15 min) y el costo por abuso queda acotado por composición con el rate
 * limit de reenvío (1 token cada 60 s). Limitación conocida: el conteo es
 * por instancia del proceso; con >1 réplica el límite efectivo se multiplica.
 * Para rate limiting distribuido se requeriría un almacén compartido (Redis),
 * fuera del alcance de F0.
 */

export interface RateLimitResult {
  /** `true` si la petición está dentro del presupuesto, `false` si excede. */
  allowed: boolean;
  /** Intentos restantes antes de agotar la ventana. */
  remaining: number;
  /** Segundos hasta que la ventana se reinicia (0 si aún hay presupuesto). */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Máximo de entradas antes de forzar una poda completa de vencidas. */
const MAX_BUCKETS = 10_000;

/**
 * Elimina entradas vencidas para evitar crecimiento ilimitado del Map.
 * @param {number} now - Instante de referencia en ms (Date.now()).
 */
function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Consume un intento del presupuesto para `key` en la ventana dada.
 *
 * Si la ventana expiró, el conteo se reinicia. Si el conteo excede `limit`,
 * retorna `allowed: false` con los segundos restantes de la ventana.
 *
 * @param {string} key - Identificador del presupuesto (ej. `verify:<usuarioId>`, `ip:<ip>`).
 * @param {number} limit - Máximo de intentos por ventana.
 * @param {number} windowMs - Duración de la ventana en milisegundos.
 * @param {number} [now=Date.now()] - Instante de referencia (inyectable para tests).
 * @returns {RateLimitResult} Resultado del consumo.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size >= MAX_BUCKETS) pruneExpired(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(0, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Reinicia el presupuesto para `key` (ej. tras verificación exitosa).
 * @param {string} key - Identificador del presupuesto.
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Regresa el número actual de presupuestos rastreados (diagnóstico).
 * @returns {number} Cantidad de entradas en el limitador.
 */
export function rateLimitSize(): number {
  return buckets.size;
}
