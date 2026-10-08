# TSK-BD-09 + TSK-BD-10 — Idempotencia de pagos (Stripe) y canje de ticket con auditoría

> Rama de trabajo: `feature/tsk-bd-09-10-pagos-y-canje-ticket` (hacia `develop`)
> Tasks: **TSK-BD-09** (Idempotencia de pagos con Stripe · HU-10 / RF-09 · 3 pts)
> y **TSK-BD-10** (Canje de ticket + auditoría de accesos · HU-14..17 / RF-13·14·15 / RN-05)
> Sprint: SP1 - Core & Reservas Cashless · Fecha: 2026-10-08
> Doc detallado de la 09: [`TSK-BD-09-idempotencia-pagos-stripe.md`](./TSK-BD-09-idempotencia-pagos-stripe.md)

## 1. Qué se hizo (resumen)

**TSK-BD-09 — pagos idempotentes.** El `UNIQUE (stripe_payment_intent_id)` ya
existía, pero el webhook devolvía `501`. Ahora `POST /api/payments` verifica la
firma de Stripe y ejecuta `procesarPagoWebhook()` en **una transacción**: upsert
de `PAGO` (reintenta ante `P2002`), `reserva PENDIENTE_PAGO → CONFIRMADA` y
activación de membresía, ambos con `WHERE` condicional. Reenviar el mismo
evento N veces deja **1 fila en `PAGO` y 1 reserva `CONFIRMADA`**.

**TSK-BD-10 — canje de ticket + pista de auditoría.** `POST /api/access`
reemplaza el stub `501`: valida la firma HMAC del QR **antes** de tocar la BD,
aplica `decideAccess()` (core) y ejecuta `ejecutarLectura()` en **una
transacción**: `UPDATE ticket_qr SET estado='USADO' WHERE estado='EMITIDO'` +
**exactamente 1 fila** en `LECTURA_ACCESO` por escaneo. Un boleto `USADO` jamás
vuelve a `EMITIDO` (RN-05) y el modo CONSULTA no lo altera nunca.

| # | Cambio | Archivo |
|---|--------|---------|
| 1 | Repositorio de pagos idempotente (BD-09) | `packages/db/src/repositories/payments.ts` |
| 2 | Repositorio de tickets: canje + auditoría transaccional (BD-10) | `packages/db/src/repositories/tickets.ts` |
| 3 | Export de ambos repositorios | `packages/db/src/index.ts` |
| 4 | Webhook Stripe real | `apps/web/src/app/api/payments/route.ts` |
| 5 | Orquestador del escáner (firma → decide → transacción) | `apps/web/src/lib/access.ts` |
| 6 | Endpoint de escaneo (reemplaza stub 501) | `apps/web/src/app/api/access/route.ts` |
| 7 | Fix `postServiceId` (`z.uuid()` → `z.coerce.number()`, era FK a `servicio.id Int`) | `packages/validation/src/access.schema.ts` |
| 8 | Helpers de metadatos/monto Stripe | `packages/core/src/integrations/stripe.ts` |
| 9 | Tests: 7 BD-09 + 5 BD-10 (repo), 4 webhook, 8 escáner, 3 schema | ver §6 |

**No hubo migraciones nuevas**: `ticket_qr`, `lectura_acceso`, `asignacion_puesto`
y los enums `EstadoTicket` / `ModoLectura` / `ResultadoLectura` ya existían
(desde `TSK-BD-06`); lo que faltaba era el código que los usa.

## 2. Cómo funciona el canje y la auditoría (BD-10)

```
Escáner QR (content = ticket_qr.codigo_uuid) + firma HMAC + puesto (o null)
        │
        ▼
POST /api/access ──► sesión + rol Administrador | Empleado_Lector  (401/403)
        │
        ▼
procesarEscaneo()  (apps/web/src/lib/access.ts)
        │
        ├─ 1) verifyTicketSignature()  ← ANTES de la BD; mal QR → 400, 0 escrituras
        ├─ 2) getTicketForScan()       ← carga reserva + titular + servicio + franja
        ├─ 3) decideAccess() (core)    ← estado, ventana horaria, servicio vs puesto
        ├─ 4) getAsignacionVigente()   ← turno del lector (best-effort → nulo)
        │
        ▼
ejecutarLectura()   ← UNA transacción (packages/db/.../tickets.ts):
        │
        ├─ 5) UPDATE ticket_qr SET estado='USADO', usado_por, usado_en
        │      WHERE id = :id AND estado='EMITIDO'        ← exactamente 1 gana
        │      (count=0 → carrera: NO toca el boleto → DENEGADO_USADO)
        │      solo si modo=TURNO y la decisión fue "consumir"
        │
        └─ 6) INSERT en lectura_acceso                    ← SIEMPRE 1 fila
               · TURNO concede  → CONCEDIDO
               · servicio/horario/usado → DENEGADO_SERVICIO | DENEGADO_HORARIO | DENEGADO_USADO
               · CONSULTA       → CONSULTA (asignacion_id = NULL, 0 updates)
```

Garantías (por diseño, no por convención):

- **1 fila de auditoría por escaneo**, concedido o denegado — la escribe la misma
  transacción que el canje; si algo falla, no queda registro huérfano.
- **Irreversibilidad**: la transición la garantiza el `WHERE estado='EMITIDO'`
  del motor; no existe camino de código que devuelva un boleto a `EMITIDO`.
- **Doble escaneo** (reintento, lector distraído, doble tap): la 1.ª corrida
  canjea; la 2.ª reporta `DENIED / ALREADY_USED` con su propia fila
  `DENEGADO_USADO` y el boleto queda intacto en `USADO`.

Mapeo decisión → resultado:

| `decideAccess()` | `access` | `lectura_acceso.resultado` |
|---|---|---|
| concede + consumir | `GRANTED` | `CONCEDIDO` |
| consulta (`postServiceId = null`) | `GRANTED` | `CONSULTA` |
| `SERVICE_MISMATCH` | `DENIED` | `DENEGADO_SERVICIO` |
| `WINDOW_EXPIRED` | `DENIED` | `DENEGADO_HORARIO` |
| `ALREADY_USED` / `INVALID_STATE` o carrera de canje | `DENIED` | `DENEGADO_USADO` |

## 3. Guía para el equipo de BACKEND

### 3.1. Variables de entorno (`apps/web/.env`)

```env
QR_HMAC_SECRET="change-me-64-hex"   # firma HMAC-SHA256 de los QR (ya en .env.example)
STRIPE_SECRET_KEY="sk_test_..."      # BD-09 (ya en .env.example)
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Sin `QR_HMAC_SECRET`, `/api/access` responde `503 QR_NOT_CONFIGURED` (no rompe).

### 3.2. Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| `POST` | `/api/payments` | Firma Stripe (no sesión) | Webhook idempotente (BD-09) |
| `POST` | `/api/access` | Sesión + rol `Administrador` o `Empleado_Lector` | Escaneo de ticket (BD-10) |

Contrato de `POST /api/access`:

```jsonc
// Request
{ "ticketId": "9f0d6f4e-…",        // contenido del QR = ticket_qr.codigo_uuid (UUIDv4)
  "signature": "hmac-sha256-hex",   // HMAC(secret, ticketId)
  "postServiceId": 3 }              // servicio del puesto; null = modo CONSULTA

// 200 — resuelto (concedido, consulta o denegado con su explicación)
{ "success": true, "data": {
    "access": "GRANTED" | "DENIED",
    "code": "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "ALREADY_USED" | "INVALID_STATE", // solo si DENIED
    "modo": "TURNO" | "CONSULTA",
    "resultado": "CONCEDIDO" | "CONSULTA" | "DENEGADO_SERVICIO" | "DENEGADO_HORARIO" | "DENEGADO_USADO",
    "canjeado": true,               // true solo si ESTA corrida pasó EMITIDO → USADO
    "lecturaId": "42",              // id de lectura_acceso (BigInt, serializado)
    "ticket": { "id", "reservaId", "estado", "servicioId", "servicioNombre",
                "fecha": "2026-10-10", "horaInicio": "10:00:00", "horaFin": "11:00:00",
                "titularId", "titularNombre" }
}, "timestamp": "…" }

// 400 INVALID_SIGNATURE | VALIDATION_ERROR · 401 UNAUTHORIZED · 403 FORBIDDEN
// 404 TICKET_NOT_FOUND · 503 QR_NOT_CONFIGURED · 500 SERVER_ERROR
```

> Una denegación **también** responde `200` con `access: "DENIED"`: es un
> resultado de negocio normal (con su fila de auditoría), no un error HTTP.

### 3.3. Uso directo del repositorio (workers / futuras integraciones)

```ts
import { getTicketForScan, getAsignacionVigente, ejecutarLectura, TicketError } from "@sportcomplex/db";

const ticket = await getTicketForScan(codigoUuid);        // 404 TicketError si no existe
const salida = await ejecutarLectura({
  ticketId, modo: "TURNO", resultado: "CONCEDIDO",
  consumir: true,                    // false ⇒ solo audita, nunca canjea
  empleadoId, asignacionId: null, asignacionId obligatorio-null en CONSULTA
  now: new Date(),
});
// salida: { canjeado, resultado, lecturaId, ticketEstado }
```

La decisión de negocio **no** vive en el repositorio: firma (`verifyTicketSignature`),
ventana y servicio (`decideAccess`) van en el orquestador `lib/access.ts`.

### 3.4. Firmar un QR (contexto TSK-BD-06 / emisión de tickets)

```ts
import { signTicket } from "@sportcomplex/core";
const codigo = ticket.codigoUuid;                 // UUIDv4
const firma  = signTicket(codigo, process.env.QR_HMAC_SECRET!);
// QR impreso/emitido = codigo (la firma viaja aparte o como codigo.firma)
```

`verifyTicketSignature` compara en tiempo constante; una firma distinta corta
el flujo **antes** de cualquier consulta a la BD.

## 4. Guía para el equipo de FRONTEND

### 4.1. Qué garantiza el sistema hoy

1. **Denegar no gasta**: un QR de otro servicio, fuera de hora o ya usado deja
   el boleto intacto (`canjeado: false`, `ticket.estado` sin cambios).
2. **Conceder gasta exactamente una vez**: el 1.º `GRANTED` en TURNO pasa el
   boleto a `USADO` con marca de tiempo y lector; cualquier reapertura de la
   página o reenvío devuelve `DENIED / ALREADY_USED`.
3. **Consultar nunca gasta**: `postServiceId: null` devuelve los datos de la
   reserva sin tocar el boleto (HU-16) — es el modo que debe usar cualquier
   pantalla que solo muestre información.

### 4.2. Página del escáner (HU-15 / HU-17)

El placeholder `apps/web/src/app/(staff)/scanner/page.tsx` debe cablear:

1. Selector de puesto del turno (o toggle "Modo consulta" → `postServiceId: null`).
2. Decoder de cámara → `ticketId` (contenido del QR) + `signature`.
3. `POST /api/access` con el JSON de §3.2.
4. Pintar resultado:

| `data.access` / `data.code` | Alerta (Flujo 4 del SRS) |
|---|---|
| `GRANTED` + `CONCEDIDO` | 🟢 "Acceso concedido" + titular/servicio/hora |
| `GRANTED` + `CONSULTA` | 🟢 Datos: Servicio, Horario, Titular (boleto intacto) |
| `DENIED` + `SERVICE_MISMATCH` | 🔴 "El tiquete pertenece a {servicio} y te encuentras en {puesto}" (NO se gasta) |
| `DENIED` + `WINDOW_EXPIRED` | 🔴 "Fuera del horario de la reserva" (NO se gasta) |
| `DENIED` + `ALREADY_USED` | 🔴 "Tiquete ya usado" |

El `404 TICKET_NOT_FOUND` y el `400 INVALID_SIGNATURE` son QRs inválidos/adulterados
→ alerta roja genérica "Código no válido" (no exponer el detalle).

### 4.3. Roles (middleware)

`/scanner/*` y `/api/access/*` ya exigen `Administrador | Empleado_Lector`
(normalizados en `apps/web/src/lib/session.ts`); el endpoint además re-valida
sesión y rol por capa propia (defensa en profundidad).

## 5. Variables de entorno y arranque

```bash
pnpm install
pnpm db:generate
pnpm --filter web dev
```

## 6. Cómo probarlo

```bash
# Unit + integración (mock de Prisma, sin BD real)
pnpm --filter @sportcomplex/db test        # 32 tests → 5 TSK-BD-10 + 7 TSK-BD-09
pnpm --filter @sportcomplex/validation test # 13 tests → 3 access.schema
pnpm --filter web test                     # 17 tests → 8 TSK-BD-10 + 4 webhook BD-09

# Typecheck + lint
pnpm --filter @sportcomplex/db typecheck && pnpm --filter @sportcomplex/db lint
pnpm --filter @sportcomplex/validation typecheck && pnpm --filter @sportcomplex/validation lint
pnpm --filter @sportcomplex/core typecheck && pnpm --filter @sportcomplex/core lint
pnpm --filter web typecheck && pnpm --filter web lint

# BD-09 end-to-end con Stripe CLI
stripe listen --forward-to localhost:3000/api/payments
# ... y reenviar el mismo evento 2 veces: no duplica PAGO ni reservas
```

QA manual del escáner (con sesión de lector y `QR_HMAC_SECRET` definido):

```bash
# firma de prueba
node -e "const{createHmac}=require('crypto');const id='9f0d6f4e-0000-4000-8000-0000000000ff';console.log(createHmac('sha256','change-me-64-hex').update(id).digest('hex'))"

curl -X POST http://localhost:3000/api/access -H "Content-Type: application/json" \
  --cookie <sesión-del-lector> \
  -d '{"ticketId":"<codigo_uuid>","signature":"<hmac>","postServiceId":3}'
# 1.ª vez: access=GRANTED/CONCEDIDO · 2.ª: DENIED/ALREADY_USED · sin puesto: modo CONSULTA
```

## 7. Para quien docketice en Jira (copiar/pegar)

**Campos de las dos tasks:**

- **Rama:** `feature/tsk-bd-09-10-pagos-y-canje-ticket` (reemplaza a
  `feature/tsk-bd-09-idempotencia-de-pagos-con-stripe`; PR #22 se cierra)
- **Estado:** En Desarrollo → Resuelto al merge (revisar el flujo del equipo)
- **Commits:** `fa6e25c` (feat: TSK-BD-09 idempotencia de pagos con Stripe),
  `5ce020e` (feat: TSK-BD-10 canje de ticket y pista de auditoría),
  más el commit de esta documentación (ver PR para el detalle exacto)
- **PR:** hacia `develop`, cubre **TSK-BD-09 + TSK-BD-10** (misma rama)
- **Docs:** `docs/TSK-BD-09-idempotencia-pagos-stripe.md` y este archivo

**TSK-BD-09 — Criterios de aceptación (evidencia):**

- [x] *Reenviar el mismo webhook dos veces deja una sola fila en `PAGO` y una
      sola reserva `CONFIRMADA`* → `packages/db/src/repositories/payments.test.ts`
      ("reenviar el mismo webhook dos veces → 1 fila en PAGO y 1 reserva CONFIRMADA")
      + `apps/web/src/app/api/payments/__tests__/route.test.ts` (escenario HTTP
      con firma Stripe verificada).
- [x] Carrera concurrente por el `UNIQUE` no duplica (reintento ante `P2002`).
- [x] Un `FALLIDO` tardío nunca degrada un pago `APROBADO`.

**TSK-BD-10 — Criterios de aceptación (evidencia):**

- [x] *El canje es transaccional e irreversible: `EMITIDO → USADO` con
      `usado_por`/`usado_en`* → `packages/db/src/repositories/tickets.test.ts`
      ("canje TURNO transmuta EMITIDO→USADO y audita CONCEDIDO").
- [x] *Un boleto `USADO` nunca vuelve a `EMITIDO` (doble escaneo → 1 canje y 2
      filas de auditoría)* → id. ("doble canje deja 1 USADO y 2 auditorías") +
      `apps/web/src/app/api/access/__tests__/access.test.ts` ("segundo escaneo
      del mismo QR → DENIED ALREADY_USED…").
- [x] *Modo CONSULTA entrega los datos de la reserva sin gastar el boleto* →
      tests de CONSULTA en repo y API (boleto intacto, `asignacion_id` nulo).
- [x] *Toda lectura genera exactamente una fila en `LECTURA_ACCESO` con modo y
      resultado* (concedido, denegado y consulta) → misma suite.
- [x] *Denegaciones correctas: servicio ≠ puesto, horario vencido, ya usado* →
      tests `SERVICE_MISMATCH` / `WINDOW_EXPIRED` / `ALREADY_USED`.
- [x] *Firma QR validada antes de consultar la BD* → test "firma HMAC inválida
      se rechaza ANTES de tocar la BD (400, 0 auditorías)".

**QA manual sugerido (checklist):**

1. `pnpm --filter @sportcomplex/db test && pnpm --filter web test` → verdes.
2. Escanear 2 veces el mismo QR con puesto asignado → 1.ª 🟢, 2.ª 🔴 "ya usado".
3. Escanear con puesto equivocado → 🔴 sin gastar el boleto (verificar en BD).
4. Modo consulta → datos completos, boleto sigue `EMITIDO`.
5. BD-09: reenviar evento de Stripe 2 veces → 1 `PAGO`, reserva `CONFIRMADA`.
6. Sesión sin rol lector → `403`.

**Fuera de alcance de ambas tasks (no marcar):**

- UI del escáner (selector de puesto, decoder, alertas) → `feature/scanner-access-modes`.
- `POST /api/payments/intent` y checkout con Stripe Elements → `feature/pos-stripe-cashless`.
- Flujo de turnos/asignación de puestos (hoy `asignacion_id` es best-effort).
- Notificación al usuario al confirmar pago o al denegar acceso.
