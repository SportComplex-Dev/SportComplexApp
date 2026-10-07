# Repositorios `packages/db`

## `verification-tokens.ts` — Acceso a Datos TokenVerificacion

### Propósito
Provee CRUD tipado y mínimo para `TokenVerificacion` usado por flujos de auth (TSK-BE-03).

### Referencia de Esquema (`prisma/schema.prisma`)
```prisma
model TokenVerificacion {
  id        String    @id @default(uuid()) @db.Uuid
  usuarioId String    @map("usuario_id") @db.Uuid
  tokenHash String    @unique @map("token_hash") @db.VarChar(255)
  creadoEn  DateTime  @default(now()) @map("creado_en") @db.Timestamptz
  expiraEn  DateTime  @map("expira_en") @db.Timestamptz
  usadoEn   DateTime? @map("usado_en") @db.Timestamptz

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@map("token_verificacion")
}
```

### Exportaciones

| Función | Firma | Descripción |
|---------|-------|-------------|
| `createToken` | `(usuarioId, tokenHash, expiraEn) => Promise<TokenVerificacion>` | Inserta nuevo token; `creado_en` auto-se a `now()` |
| `findLatestByUsuarioId` | `(usuarioId) => Promise<TokenVerificacion \| null>` | Busca el token **sin usar** (`usadoEn = null`) más reciente ordenado por `creado_en DESC` |
| `markUsed` | `(id) => Promise<TokenVerificacion>` | Establece `usado_en = now()` (invalidación suave) |

### Patrones de Uso

#### Crear en registro / reenvío
```typescript
import { createToken } from "@sportcomplex/db/repositories/verification-tokens";

const token = await createToken(
  usuario.id,
  tokenHash,           // Hash Argon2id del código de 6 dígitos
  new Date(Date.now() + 15 * 60 * 1000) // expira_en = now + 15min
);
```

#### Buscar último para rate limit / verificar
```typescript
import { findLatestByUsuarioId } from "@sportcomplex/db/repositories/verification-tokens";

const latest = await findLatestByUsuarioId(usuarioId);
// Retorna null si no existe token sin usar
```

#### Invalidar en verificación / reenvío
```typescript
import { markUsed } from "@sportcomplex/db/repositories/verification-tokens";

await markUsed(token.id); // Soft delete — preserva rastro de auditoría
```

### Decisiones de Diseño
- **Invalidación suave (`usado_en`)** en vez de borrado duro — preserva rastro de auditoría para revisiones de seguridad
- **Restricción única en `token_hash`** — previene hashes duplicados accidentales (extremadamente improbable con Argon2id + salt)
- **Índice implícito en `(usuario_id, creado_en)`** — vía `orderBy: { creadoEn: 'desc' }` + `where: { usadoEn: null }`
- **Cascade delete en Usuario** — tokens eliminados cuando se borra el usuario

## `availability.ts` — TSK-BD-07 Reserva transaccional (Overbooking = 0)

### Propósito
Único camino que **ocupa cupos** (`cupos_ocupados`) sobre `disponibilidad`.
Reserva atómica con `SELECT ... FOR UPDATE`, validación de ventana en
`America/Bogota` y creación de `reserva` en `PENDIENTE_PAGO`.

### Flujo (`reserveDisponibilidad`)
1. `$transaction` + `SELECT ... WHERE id = $1 FOR UPDATE` (serializa N competidores).
2. Rechaza `bloqueada_mantenimiento = true` → `SLOT_BLOCKED` (HTTP 409).
3. Rechaza `fecha` fuera de `[hoy, hoy+15]` Bogota → `SLOT_OUT_OF_WINDOW` (HTTP 422).
4. Rechaza `cupos_ocupados + cantidad > cupos_totales` → `SLOT_NO_CAPACITY` (HTTP 409).
5. `UPDATE cupos_ocupados += cantidad` condicional (doble barrera; si `rowCount != 1` → 409).
6. `reserva.create({ estado: PENDIENTE_PAGO, expira_en: now + 15 min })`.

### Uso
```typescript
import { reserveDisponibilidad, isAvailabilityError } from "@sportcomplex/db";

try {
  const reserva = await reserveDisponibilidad({
    disponibilidadId: 123n,
    titularId: usuario.id,
    cantidadCupos: 1,
    canal: "ONLINE",
    subtotal: 50000,
    total: 50000,
  });
} catch (err) {
  if (isAvailabilityError(err)) return Response.json({ code: err.code }, { status: err.httpStatus });
  throw err;
}
```

### Concurrencia (criterio de aceptación)
Lanzar N `reserveDisponibilidad` en paralelo sobre la misma fila con 1 cupo libre:
esperado `1 éxito + (N-1) SLOT_NO_CAPACITY/409` y `cupos_ocupados` final `+1`.

### Auditoría
Regla: **ningún camino que modifique `cupos_ocupados` puede omitir `FOR UPDATE`**;
todo ese write debe reutilizar `reserveDisponibilidad`. Otros writes permitidos
(sin tocar el contador) viven en `services.ts`: aprovisionamiento de calendario
(`upsert` con `update: {}`, solo crea filas con `cuposOcupados: 0`) y limpieza
admin (`deleteMany` con guarda `reservas: { none: {} }` o sin reservas activas).
No agregar otro `SELECT/UPDATE` de `disponibilidad` que toque `cupos_ocupados`
sin `FOR UPDATE`. `bookings.ts` queda solo como alias de compatibilidad que
re-exporta este módulo.

### Guía Backend (Next.js API route)

```typescript
import { reserveDisponibilidad, isAvailabilityError } from "@sportcomplex/db";

export async function POST(req: Request) {
  const body = await req.json(); // { disponibilidadId, cantidadCupos?, subtotal, total }
  try {
    const reserva = await reserveDisponibilidad({
      disponibilidadId: body.disponibilidadId,
      titularId: session.user.id,
      cantidadCupos: body.cantidadCupos ?? 1,
      canal: "ONLINE",
      subtotal: body.subtotal,
      total: body.total,
    });
    return Response.json({ reservaId: reserva.id, expiraEn: reserva.expiraEn }, { status: 201 });
  } catch (err) {
    if (isAvailabilityError(err)) {
      // 404 SLOT_NOT_FOUND · 409 SLOT_BLOCKED/SLOT_NO_CAPACITY · 422 SLOT_OUT_OF_WINDOW · 400 INVALID_QUANTITY
      return Response.json({ code: err.code, message: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
```

Reglas backend:
- No leer `disponibilidad` y luego escribir fuera de transacción; llamar siempre a `reserveDisponibilidad`.
- `cantidadCupos` por defecto `1` (modalidad `EXCLUSIVA`); para `AFORO` pasar N y el repo valida contra `cupos_totales`.
- `PENDIENTE_PAGO` nace con `expira_en = now + 15 min`; el job de expiración libera el cupo, no la API.

### Guía Frontend (fetch + UX)

```typescript
const res = await fetch("/api/bookings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ disponibilidadId, cantidadCupos: 1, subtotal, total }),
});
if (res.status === 409) {
  // SLOT_NO_CAPACITY o SLOT_BLOCKED: mostrar "Cupo agotado, elige otra franja"
  // y refrescar disponibilidad. NO reintentar a ciegas: el lock ya decidió un ganador.
} else if (res.status === 422) {
  // SLOT_OUT_OF_WINDOW: mostrar "Solo se puede reservar entre hoy y +15 días (Bogota)".
} else if (res.status === 201) {
  // Iniciar checkout: la reserva expira en 15 min (mostrar countdown con `expiraEn`).
}
```

Reglas frontend:
- Ante `409`, refrescar la grilla de slots en vez de reintentar el POST.
- Validar en UI la ventana `[hoy, hoy+15]` pero dejar la decisión final al repo (hora `America/Bogota` del servidor).
- Mostrar el TTL de pago (`expiraEn`) para `PENDIENTE_PAGO`.