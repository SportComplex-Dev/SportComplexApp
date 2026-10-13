# TSK-BE-16 — Denegación explícita por discrepancia de zona

## Objetivo

Al escanear un tiquete desde un puesto asociado a otro servicio, denegar el acceso de forma explícita e indicar los nombres de ambos servicios. Por ejemplo:

> Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas

La validación compara el servicio de la reserva del tiquete con `postServiceId`, que identifica el servicio del puesto actual.

## Comportamiento implementado

- La discrepancia devuelve HTTP `403` con `error.code = SERVICE_MISMATCH` y el mensaje con los nombres del servicio del tiquete y del puesto.
- Este `403` usa el formato estándar de error (`success: false`, `error.message`); las denegaciones por horario o tiquete usado conservan el formato anterior HTTP `200` con `data.access = DENIED`. El frontend de TSK-FE-16 debe manejar ambos contratos.
- La regla aplica tanto a `POST /api/access/redeem` como a `POST /api/access`, que comparten el procesamiento de escaneo.
- El intento denegado conserva la auditoría existente (`DENEGADO_SERVICIO`) y no modifica el estado, el empleado ni la fecha de uso del tiquete.
- Si el identificador del puesto no corresponde a un servicio existente, la petición devuelve `404 SERVICE_NOT_FOUND`; no registra una lectura ni modifica el tiquete.
- Un servicio de puesto existente pero inhabilitado sigue participando en la comparación de zona: si el servicio no coincide con el del tiquete, aplica el mismo `403 SERVICE_MISMATCH`. La habilitación operativa del puesto no forma parte de esta task.
- Los demás resultados de acceso conservan sus respuestas actuales.

## Persistencia

No se modifica el esquema de Prisma ni se agrega una migración. Para construir el mensaje se consulta el nombre del servicio asociado al puesto; la auditoría de acceso ya existente registra la denegación.

## Cobertura automatizada

- `apps/web/src/app/api/access/redeem/__tests__/route.test.ts`: comprueba el HTTP `403`, el mensaje de aceptación, la auditoría de denegación y que el tiquete permanece `EMITIDO`.
- `apps/web/src/app/api/access/redeem/__tests__/route.test.ts` y `apps/web/src/app/api/access/__tests__/access.test.ts`: cubren ambos contratos HTTP `403`, el servicio inhabilitado y el servicio de puesto inexistente.
- Las pruebas existentes siguen cubriendo firma HMAC inválida antes de consultar la base de datos, autenticación, autorización, canje exitoso, doble escaneo y denegaciones por estado o franja horaria.
# TSK-BE-17 — Validación de franja horaria de ingreso

> **Jira:** SCRUM-130  
> **Tarea:** TSK-BE-17  
> **Historia de Usuario:** `HU-17` (RF-15 / RN-06)  
> **Fase:** F3 · **Story Points:** 1 pt · **Componente:** Backend  
> **Depende de:** `TSK-BE-14`  
> **Rama sugerida / activa:** `feature/tsk-be-17-validación-de-franja-horaria-de`  

---

## 1. Alcance Técnico y Reglas de Negocio

- **RN-06 (Ventana de Acceso):** El ingreso físico a las instalaciones únicamente se autoriza dentro del rango cerrado $[HoraInicio, HoraFin]$ de la franja horaria reservada.
- **Zona Horaria Canónica (`America/Bogota` / UTC-5):** Todo cálculo y comparación de instantes temporales se normaliza bajo la hora legal de Colombia (`America/Bogota`), combinando la fecha del calendario de la reserva (`fecha` `@db.Date`) con las marcas de tiempo de la franja (`hora_inicio` y `hora_fin` `@db.Time`).
- **Idempotencia e Integridad del Boleto:** Un intento extemporáneo deniega el acceso con `code = "WINDOW_EXPIRED"` y resultado de auditoría `DENEGADO_HORARIO`, registrando exactamente una fila en `LECTURA_ACCESO` sin consumir ni alterar el boleto (`ticket.estado` permanece en `EMITIDO`).
- **Mensaje Contractual:** `ACCESS_WINDOW_EXPIRED_MESSAGE = "Acceso denegado: Franja horaria vencida"` exportado desde `@sportcomplex/core` y devuelto en las respuestas denegadas tanto en `POST /api/access/redeem` como en `POST /api/access`.

---

## 2. Criterio de Aceptación Clave

> **Criterio de Aceptación:**  
> Tiquete con franja 10:00–11:00 con hora actual 10:15 se valida; a las 11:01 se deniega con **"Acceso denegado: Franja horaria vencida"**.

### Comportamiento de Fronteras (Intervalo Cerrado $[10:00:00, 11:00:00]$)

| Hora de Escaneo (Bogotá) | Equivalente UTC (`-05:00`) | Resultado | Código / Mensaje | Estado del Boleto |
|---|---|---|---|---|
| `09:59:59` | `14:59:59Z` | `DENIED` (`DENEGADO_HORARIO`) | `WINDOW_EXPIRED`<br>`"Acceso denegado: Franja horaria vencida"` | `EMITIDO` (intacto) |
| `10:00:00` | `15:00:00Z` | `GRANTED` (`CONCEDIDO`) | N/A (Canje exitoso) | Pasa a `USADO` |
| `10:15:00` | `15:15:00Z` | `GRANTED` (`CONCEDIDO`) | N/A (Canje exitoso) | Pasa a `USADO` |
| `11:00:00` | `16:00:00Z` | `GRANTED` (`CONCEDIDO`) | N/A (Canje exitoso) | Pasa a `USADO` |
| `11:00:01` | `16:00:01Z` | `DENIED` (`DENEGADO_HORARIO`) | `WINDOW_EXPIRED`<br>`"Acceso denegado: Franja horaria vencida"` | `EMITIDO` (intacto) |
| `11:01:00` | `16:01:00Z` | `DENIED` (`DENEGADO_HORARIO`) | `WINDOW_EXPIRED`<br>`"Acceso denegado: Franja horaria vencida"` | `EMITIDO` (intacto) |

---

## 3. Arquitectura y Componentes Modificados

```mermaid
sequenceDiagram
    autonumber
    actor Lector as Empleado Lector
    participant API as POST /api/access/redeem
    participant Core as decideAccess (@sportcomplex/core)
    participant DB as Base de Datos (LECTURA_ACCESO)

    Lector->>API: { ticketId, signature, postServiceId: 1 }
    Note over API: getTicketAccessWindow(fecha, franja) -> [start, end]
    API->>Core: decideAccess({ now: 10:15, start: 10:00, end: 11:00, ... })
    alt Dentro de la franja (10:15)
        Core-->>API: { allowed: true, consume: true }
        API->>DB: Canjea EMITIDO -> USADO y audita CONCEDIDO
        API-->>Lector: 200 { access: "GRANTED", resultado: "CONCEDIDO", canjeado: true }
    else Extemporáneo (11:01)
        API->>Core: decideAccess({ now: 11:01, start: 10:00, end: 11:00, ... })
        Core-->>API: { allowed: false, code: "WINDOW_EXPIRED", message: "Acceso denegado: Franja horaria vencida" }
        API->>DB: Audita DENEGADO_HORARIO (Boleto intacto)
        API-->>Lector: 200 { access: "DENIED", code: "WINDOW_EXPIRED", message: "Acceso denegado: Franja horaria vencida", resultado: "DENEGADO_HORARIO", canjeado: false }
    end
```

### Cambios Implementados

1. **`packages/core/src/services/access-control.ts`:**
   - Constante contractual exportada: `ACCESS_WINDOW_EXPIRED_MESSAGE = "Acceso denegado: Franja horaria vencida"`.
   - Constantes adicionales de denegación: `ACCESS_SERVICE_MISMATCH_MESSAGE` y `ACCESS_ALREADY_USED_MESSAGE`.
   - Función auxiliar: `isWithinAccessWindow(now: Date, start: Date, end: Date): boolean`.
   - Función centralizada: `getTicketAccessWindow(disponibilidad)` con soporte polimórfico para instancias `Date` y cadenas ISO en zona horaria legal de Colombia (`America/Bogota`, UTC-5).
   - Motor puro `decideAccess`: incluye el campo descriptivo `message` al denegar el acceso.

2. **`apps/web/src/lib/access.ts`:**
   - Re-exporta `getTicketAccessWindow` y `ACCESS_WINDOW_EXPIRED_MESSAGE` desde `@sportcomplex/core`.
   - `EscaneoResultado` extiende su contrato con `message?: string`.
   - `procesarEscaneo` propaga el mensaje explicativo contractual en todas las salidas denegadas (`access === "DENIED"`).

3. **Pruebas Automatizadas:**
   - `packages/core/src/services/access-control.test.ts`:
     - Test de aceptación unitario verificando validación a las 10:15 y denegación a las 11:01 con el mensaje exacto.
     - Pruebas de bordes exactos `[10:00:00, 11:00:00]` y rechazo en `09:59:59` y `11:00:01`.
     - Verificación de construcción de franja en `America/Bogota` para objetos `Date` y strings.
   - `apps/web/src/app/api/access/redeem/__tests__/route.test.ts`:
     - Test de aceptación end-to-end sobre el endpoint de canje en modo turno (`POST /api/access/redeem`).
     - Validación de bordes y preservación inmutable del boleto en la base de datos ante denegación horaria.
   - `apps/web/src/app/api/access/__tests__/access.test.ts`:
     - Verificación del contrato de salida con `message: "Acceso denegado: Franja horaria vencida"`.

---

## 4. Verificación de Calidad

- `pnpm --filter @sportcomplex/core test`: 55/55 tests pasando exitosamente.
- `pnpm --filter web test`: 97/97 tests pasando exitosamente.
- `pnpm test`: suite completa del monorepo en verde.
- `pnpm lint`: 0 errores y 0 advertencias de ESLint en todos los paquetes.
- `pnpm --filter @sportcomplex/core typecheck && pnpm --filter web typecheck`: 0 errores de TypeScript.
