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

En el flujo de **Modo Turno** del escáner (`/scanner` con puesto asignado), cuando el empleado lector escanea un tiquete de otro servicio, el backend deniega con HTTP `403` y mensaje literal (ej. *"Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas"*). El modal mostraba una alerta roja **genérica** sin destacar a qué zona dirigir al usuario.

Con esta tarea, el estado `access-denied` con `code = SERVICE_MISMATCH` presenta:

| # | Componente / Archivo | Qué hace |
|---|----------------------|----------|
| 1 | `apps/web/src/components/scanner/service-mismatch-alert.tsx` | Nuevo: parsea ambos servicios del literal del 403 y renderiza alerta roja (`role="alert"`) con el mensaje íntegro, la zona destino destacada (`Dirija al usuario a: {servicio}`) y el puesto actual como contexto. Fallback robusto si el mensaje no sigue el formato. **Sin acciones de canje.** |
| 2 | `apps/web/src/components/scanner/ticket-validation-modal.tsx` | En `access-denied` con `SERVICE_MISMATCH` renderiza el nuevo alert (nueva prop opcional `postServiceName`); los demás códigos conservan la alerta genérica. |
| 3 | `apps/web/src/app/(staff)/scanner/page.tsx` | Pasa `postServiceName={activeShift?.courtName}` al modal (1 línea). |
| 4 | `apps/web/src/components/scanner/__tests__/service-mismatch-alert.test.ts` | 3 pruebas unitarias del parser (formato estándar, nombres con espacios, mensajes inválidos → `null`). |
| 5 | `apps/web/src/components/scanner/__tests__/service-mismatch-alert-render.test.tsx` | 4 pruebas visuales (`react-dom/server`): alerta roja + literal + destino destacado, invariante sin canje, puesto desde el mensaje y fallback. |

---

## 2. Contrato consumido (TSK-BE-16) y doble formato

```http
POST /api/access/redeem
{ "ticketId": "<uuid>", "signature": "<hmac>", "postServiceId": 2 }

→ 403 { success: false, error: { code: "SERVICE_MISMATCH",
      message: "Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas" },
      timestamp }
```

* `scanner.service.redeemTicket` ya normalizaba este 403 a `{access:"DENIED", resultado:"DENEGADO_SERVICIO", code:"SERVICE_MISMATCH", message}` (sin `ticket`: el 403 no lo trae, por eso no se renderiza `TicketDetails`).
* Las demás denegaciones (usado, horario) siguen en HTTP `200` con `data.access = DENIED`; esta tarea no las toca.
* El tiquete denegado permanece en `EMITIDO` (auditoría `DENEGADO_SERVICIO`); la alerta no ofrece canje, solo *"Escanear siguiente"*.

---

## 3. Criterio de Aceptación Clave

> *El empleado puede leer en un vistazo a qué zona debe dirigir al usuario.*

* El nombre del **servicio del tiquete** (destino) se destaca en tipografía grande (`Dirija al usuario a: Piscina`).
* El **texto literal del mensaje** se muestra íntegro debajo, más el puesto actual como contexto (`Puesto actual: Canchas`).

---

## 4. Verificación

```bash
pnpm typecheck
pnpm lint
pnpm --filter web exec tsx --test "src/components/scanner/__tests__/service-mismatch-alert.test.ts" "src/components/scanner/__tests__/service-mismatch-alert-render.test.tsx"
pnpm --filter web build
```

**Resultados:** typecheck 5/5 OK · lint 5/5 (0 errores) · tests 7/7 · build OK.
