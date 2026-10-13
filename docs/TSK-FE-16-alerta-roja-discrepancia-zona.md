# TSK-FE-16 — Alerta roja de discrepancia de zona (HU-16 / RF-14)

> **Tarea ID:** `TSK-FE-16`
> **Historia de Usuario:** `HU-16` (`RF-14`)
> **Fase:** F3 · **Story Points:** 1 pt
> **Responsable:** Sebastián Mendoza
> **Microcelda / Componente:** Frontend (`apps/web`)
> **Depende de:** `TSK-BE-16` (`POST /api/access/redeem` → 403 `SERVICE_MISMATCH`)
> **Estado:** Resuelto / Implementado
> **Rama sugerida:** `feature/tsk-fe-16-alerta-roja-de-discrepancia-de` (hacia `develop`)

---

## 1. Qué se hizo y por qué

En el flujo de **Modo Turno** del escáner (`/scanner` con puesto asignado), cuando el empleado lector escanea un tiquete de otro servicio, el backend deniega con HTTP `403` y mensaje literal (ej. *"Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas"*). El servicio ya normalizaba ese 403, pero la UI solo lo mostraba como texto plano dentro del modal de validación, sin destacar a qué zona dirigir al usuario.

Con esta tarea, el estado `access-denied` con `code = SERVICE_MISMATCH` presenta una **pantalla bloqueante de alerta roja**:

| # | Componente / Archivo | Qué hace |
|---|----------------------|----------|
| 1 | `apps/web/src/components/scanner/scanner.service.ts` | Nuevo helper `parseZoneMismatch(message)` (+ tipo `ZoneMismatch`) que extrae `{ ticketService, postService }` del literal del 403. Devuelve `null` si el mensaje no sigue el formato. |
| 2 | `apps/web/src/components/scanner/ZoneMismatchScreen.tsx` | Nueva pantalla bloqueante (`role="alertdialog"`, cierre con Escape): texto literal del 403, tarjeta gigante **DIRIJA AL USUARIO A: {servicio}**, puesto actual, nota de que el boleto permanece `EMITIDO` y botón *Entendido / Continuar escaneando*. **Sin acciones de canje.** |
| 3 | `apps/web/src/app/(staff)/scanner/page.tsx` | En modo turno, `SERVICE_MISMATCH` cierra el modal y muestra la pantalla (nuevo estado `zoneMismatch`); al continuar se reanuda el escaneo (`handleScanNextTurno`). Los demás códigos conservan el modal genérico. |
| 4 | `apps/web/src/components/scanner/__tests__/zone-mismatch.test.ts` | 3 pruebas unitarias del parser (formato estándar, nombres con espacios/tildes, mensajes inválidos → `null`). |
| 5 | `apps/web/src/components/scanner/__tests__/zone-mismatch-screen.test.ts` | 3 pruebas de renderizado (`react-dom/server`): literal + destino destacado, invariante crítico sin canje, y fallback robusto sin inventar zona. |

---

## 2. Contrato consumido (TSK-BE-16) y doble formato

```http
POST /api/access/redeem
{ "ticketId": "<uuid>", "signature": "<hmac>", "postServiceId": 2 }
→ 403 { success: false, error: { code: "SERVICE_MISMATCH",
    message: "Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas" } }
```

* `scanner.service.ts → redeemTicket()` ya normaliza ese 403 a `{ access: "DENIED", resultado: "DENEGADO_SERVICIO", code: "SERVICE_MISMATCH", message }` (sin datos de ticket: el 403 no los trae).
* La pantalla trabaja solo con el literal + el puesto activo (`activeShift.courtName`); no requiere cambios de contrato.
* El intento denegado conserva la auditoría (`DENEGADO_SERVICIO`) y **no modifica el estado del tiquete** (`EMITIDO`), como exige `TSK-BE-16`.

---

## 3. Criterio de Aceptación Clave

> *El empleado puede leer en un vistazo a qué zona debe dirigir al usuario.*

1. **Lectura de un vistazo:** tarjeta roja de alto contraste con `DIRIJA AL USUARIO A: {servicio del tiquete}` en tipografía grande.
2. **Texto literal:** el `h1` reproduce íntegro el `error.message` del 403 (trazabilidad con el backend).
3. **Sin canje:** la pantalla no renderiza *"Dar acceso"*, *"Canjear"*, *"Conceder"* ni *"Registrar canje"*; la única acción es continuar escaneando (el ticket sigue `EMITIDO`).

---

## 4. Verificación y Pruebas

```bash
# Tests del parser + renderizado TSK-FE-16
pnpm --filter web exec tsx --test "src/components/scanner/__tests__/zone-mismatch.test.ts" "src/components/scanner/__tests__/zone-mismatch-screen.test.ts"

# Verificación completa (igual que CI)
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm --filter web build
```

---

## 5. Ficha para Registro en Jira / Pull Request

* **Task ID:** `TSK-FE-16`
* **Historia de Usuario:** `HU-16` (`RF-14`)
* **Rama:** `feature/tsk-fe-16-alerta-roja-de-discrepancia-de`
* **Estado:** Resuelto / Listo para Code Review
