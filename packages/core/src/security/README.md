# Utilidades de Seguridad

## `token.ts` — Hashing de Códigos de Verificación y Rate Limiting

### Propósito
Implementa TSK-BE-03: hashing Argon2id de códigos de 6 dígitos, TTL de 15 minutos y rate limiting de reenvío a 60 segundos.

### Exportaciones

#### Constantes
- `TOKEN_TTL_MS` — 15 minutos (900,000 ms)
- `RESEND_COOLDOWN_MS` — 60 segundos (60,000 ms)
- `VERIFICATION_CODE_LENGTH` — 6 dígitos

#### Funciones
| Función | Descripción |
|---------|-------------|
| `generateVerificationCode()` | Retorna código criptográficamente seguro de 6 dígitos (`000000`–`999999`) |
| `hashSecret(plain: string)` | Hash Argon2id (memoryCost: 19456 KiB, timeCost: 2, parallelism: 1) |
| `verifySecret(hash, plain)` | Verificación en tiempo constante; retorna `boolean` |
| `isTokenExpired(expiraEn, now?)` | `true` si `now > expiraEn` (rechaza códigos con 15:01 min) |
| `isResendAllowed(creadoEn, now?)` | `true` si `now - creadoEn >= 60s` (aplica rate limit) |

### Parámetros del Algoritmo (Argon2id)
| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| `memoryCost` | 19456 (19 MiB) | Equivalente a "costo" ≥ 12; resistente a GPU |
| `timeCost` | 2 | 2 pasadas sobre memoria |
| `parallelism` | 1 | Hilo único; salida determinista |
| `algorithm` | Argon2id (2) | Híbrido Argon2i/Argon2d; mejor balance |

### Uso
```typescript
import { hashSecret, verifySecret, generateVerificationCode, TOKEN_TTL_MS, isTokenExpired, isResendAllowed } from "@sportcomplex/core/security";

// Registro: crear código, hashear, persistir
const code = generateVerificationCode();           // ej. "847291"
const tokenHash = await hashSecret(code);          // "$argon2id$v=19$m=19456,t=2,p=1$..."
const expiraEn = new Date(Date.now() + TOKEN_TTL_MS);
await createToken(usuarioId, tokenHash, expiraEn);

// Reenvío: verificación de rate limit
const latest = await findLatestByUsuarioId(usuarioId);
if (latest && !isResendAllowed(latest.creadoEn)) {
  throw new RateLimitedError(); // HTTP 429
}

// Verificación: comprobar expiración + hash
if (isTokenExpired(token.expiraEn)) throw new ExpiredError();
const valid = await verifySecret(token.tokenHash, inputCode);
if (!valid) throw new InvalidCodeError();
```

### Notas de Seguridad
- **Nunca loguear ni persistir códigos en claro** — solo el hash Argon2id se guarda en `token_verificacion.token_hash`
- `verifySecret` usa comparación en tiempo constante internamente (vía `@node-rs/argon2`)
- Rate limit validado contra `creado_en` del token más reciente, no contra reloj de pared
- Generación de código usa `crypto.randomInt` (CSPRNG)

## `rate-limit.ts` — Limitador de Tasa en Memoria

### Propósito
Mitiga fuerza bruta del código de 6 dígitos (1M combinaciones) y DoS por CPU
de Argon2id en `POST /api/auth/verify`, sin requerir migración de BD.

### Exportaciones
| Función | Descripción |
|---------|-------------|
| `consumeRateLimit(key, limit, windowMs, now?)` | Consume 1 intento; retorna `{ allowed, remaining, retryAfterSeconds }`. Ventana deslizante con reinicio al expirar. Poda oportunista de entradas vencidas (máx 10.000). |
| `resetRateLimit(key)` | Reinicia el presupuesto (ej. tras verificación exitosa). |
| `rateLimitSize()` | Cantidad de presupuestos rastreados (diagnóstico). |

### Composición en `verify`
1. **Por usuario** — `verify:<usuarioId>`, 5 intentos por vida del token (ventana = `expiraEn - creadoEn`). Al exceder: `markUsed(token)` + `429 TOKEN_LOCKED`.
2. **Por IP** — `verify:ip:<ip>`, 30 req/min → `429 RATE_LIMITED` (defensa directa contra agotamiento de CPU).
3. Cada token nuevo cuesta 60 s de cooldown (reenvío) ⇒ cota de ~75 hashes Argon2id por usuario cada 15 min.

### Limitación conocida
Estado por instancia del proceso: con >1 réplica el límite efectivo se multiplica, y el conteo se pierde al reiniciar. Aceptado para F0 por decisión del equipo; para rate limiting distribuido se requeriría un almacén compartido (Redis), fuera de alcance.