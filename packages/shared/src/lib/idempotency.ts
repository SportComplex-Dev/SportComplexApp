export interface CachedResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  cachedAt: number;
  expiresAt: number;
}

export interface IdempotencyEntry {
  response?: CachedResponse;
  inFlight?: Promise<Response>;
  expiresAt: number;
}

export interface IdempotencyCacheOptions {
  ttlMs?: number;
  now?: number;
}

/**
 * IdempotencyCache
 *
 * Administra el control de idempotencia en memoria con TTL configurable (por defecto 10 segundos).
 * Evita condiciones de carrera en peticiones concurrentes mediante resolución de promesas in-flight
 * y asegura que solicitudes repetidas devuelvan la respuesta idéntica sin re-ejecutar transacciones.
 */
export class IdempotencyCache {
  private readonly entries = new Map<string, IdempotencyEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 10_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string, now: number = Date.now()): IdempotencyEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  setResponse(
    key: string,
    response: Omit<CachedResponse, "cachedAt" | "expiresAt">,
    ttlMs?: number,
    now: number = Date.now(),
  ): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = now + ttl;
    this.entries.set(key, {
      response: {
        ...response,
        cachedAt: now,
        expiresAt,
      },
      expiresAt,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  private buildReplayedResponse(cached: CachedResponse): Response {
    const headers = new Headers(cached.headers);
    headers.set("x-idempotent-replayed", "true");
    return Response.json(cached.body, {
      status: cached.status,
      headers,
    });
  }

  async execute(
    key: string | undefined | null,
    fn: () => Promise<Response>,
    options?: IdempotencyCacheOptions,
  ): Promise<Response> {
    if (!key || !key.trim()) {
      return fn();
    }

    const cleanKey = key.trim();
    const now = options?.now ?? Date.now();
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;

    const existing = this.get(cleanKey, now);
    if (existing?.response) {
      return this.buildReplayedResponse(existing.response);
    }

    if (existing?.inFlight) {
      await existing.inFlight;
      const completed = this.get(cleanKey, options?.now ?? Date.now());
      if (completed?.response) {
        return this.buildReplayedResponse(completed.response);
      }
    }

    const inFlightPromise = (async () => {
      try {
        const res = await fn();

        if (res.status < 500) {
          let body: unknown = null;
          try {
            const cloned = res.clone();
            body = await cloned.json();
          } catch {
            body = null;
          }

          const headersObj: Record<string, string> = {};
          res.headers.forEach((val, k) => {
            headersObj[k] = val;
          });

          this.setResponse(
            cleanKey,
            {
              status: res.status,
              body,
              headers: headersObj,
            },
            ttlMs,
            options?.now ?? Date.now(),
          );
        } else {
          this.delete(cleanKey);
        }

        return res;
      } catch (err) {
        this.delete(cleanKey);
        throw err;
      }
    })();

    this.entries.set(cleanKey, {
      inFlight: inFlightPromise,
      expiresAt: now + ttlMs,
    });

    return inFlightPromise;
  }
}
