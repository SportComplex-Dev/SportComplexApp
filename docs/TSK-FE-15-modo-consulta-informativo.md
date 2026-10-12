# TSK-FE-15 — Modo consulta informativo (HU-15 / RF-13)

> **Tarea ID:** `TSK-FE-15`  
> **Historia de Usuario:** `HU-15` (`RF-13`)  
> **Fase:** F3 · **Story Points:** 1 pt  
> **Responsable:** Leonardo  
> **Microcelda / Componente:** Frontend (`apps/web`)  
> **Depende de:** `TSK-BE-15` (`GET /api/tickets/verify/{code}`)  
> **Estado:** Resuelto / Implementado  
> **Rama sugerida:** `feature/tsk-fe-15-modo-consulta-informativo` (hacia `develop`)

---

## 1. Qué se hizo y por qué

En la operación de control de acceso de **SportComplex / AKROS Club**, el personal de portería o recepción (`Empleado_Lector` o `Administrador`) necesita consultar los detalles de una reserva cuando un socio o visitante presenta su código QR, sin que dicha consulta consuma el ticket ni descuente aforo.

Anteriormente, la ruta `/scanner` era solo un placeholder básico (`apps/web/src/app/(staff)/scanner/page.tsx`). Con esta tarea se implementó la interfaz completa del **Modo Consulta Informativo**:

| # | Componente / Archivo | Qué hace |
|---|----------------------|----------|
| 1 | `apps/web/src/app/(staff)/scanner/page.tsx` | Pantalla del escáner con toggle de Modo Consulta (sin puesto asignado), decodificador de cámara (`html5-qrcode`), vista de detalle del boleto y formulario alternativo para simulación/QA. **Sin botón de canje.** |
| 2 | `apps/web/src/components/scanner/consultation-result-card.tsx` | Componente modular de presentación del resultado de la consulta. Renderiza servicio, fecha, franja, titular y badge de estado con garantías de no consumo. |
| 3 | `apps/web/src/lib/qr-client.ts` | Parser cliente seguro y desacoplado de `node:crypto` para deserializar el payload estándar `SC1:<uuid>:<firma>`, JSON alternativo o pares delimitados. |
| 4 | `apps/web/src/lib/__tests__/qr-client.test.ts` | Suite de 4 pruebas unitarias para el parser de códigos QR en el cliente. |
| 5 | `apps/web/src/app/(staff)/scanner/__tests__/scanner-modo-consulta.test.ts` | Suite de 4 pruebas unitarias certificando contrato de datos, los 4 campos obligatorios y el criterio de aceptación. |
| 6 | `apps/web/src/app/(staff)/scanner/__tests__/visual-consultation-render.test.tsx` | Suite de 4 pruebas visuales de renderizado UI (`react-dom/server`) certificando la presencia visual de los campos, estados `EMITIDO`/`USADO` y ausencia total de botones de canje en el DOM. |

---

## 2. Alcance Técnico y Arquitectura

```
                        ┌────────────────────────────────────────────────────────┐
                        │             apps/web/(staff)/scanner                   │
                        │                                                        │
                        │  [Toggle: Modo Consulta (Sin puesto asignado)]         │
                        │                                                        │
                        │  Cámara (html5-qrcode)  ó  Ingreso Manual QA           │
                        │              SC1:<ticketId>:<signature>                │
                        └──────────────────────────┬─────────────────────────────┘
                                                   │
                                                   │ parseTicketQr()
                                                   │
                                                   ▼
                        ┌────────────────────────────────────────────────────────┐
                        │             GET /api/tickets/verify/{code}             │
                        │             Header: x-ticket-signature: <sig>          │
                        │                  (TSK-BE-15 / Backend)                 │
                        └──────────────────────────┬─────────────────────────────┘
                                                   │
                                                   │ 200 OK (Audita CONSULTA, 0 updates)
                                                   ▼
                        ┌────────────────────────────────────────────────────────┐
                        │              Pantalla de Detalle del Boleto            │
                        │                                                        │
                        │  • Servicio:       "Cancha Sintética 1"                │
                        │  • Fecha:          "2026-10-10"                        │
                        │  • Franja Horaria: "10:00:00 – 11:00:00"               │
                        │  • Titular:        "Leonardo Perez"                    │
                        │  • Estado:         [ EMITIDO ]                         │
                        │                                                        │
                        │  🔒 Modo Informativo: No permite gastos ni canjes.     │
                        │  [ Botón: "Consultar otro boleto" ] (Sin botón canje)  │
                        └────────────────────────────────────────────────────────┘
```

### 2.1. Integración con el Backend (`TSK-BE-15`)

La vista consume exclusivamente el endpoint de solo lectura:
```http
GET /api/tickets/verify/{code}
x-ticket-signature: {signature}
```

* **Sesión requerida:** `Administrador` o `Empleado_Lector` (verificado vía cookie de sesión).
* **Firma HMAC:** Viaja en la cabecera `x-ticket-signature` y se valida en servidor antes de consultar la base de datos.
* **Comportamiento en BD:** Registra exactamente 1 fila en `LECTURA_ACCESO` con `modo = 'CONSULTA'`, `resultado = 'CONSULTA'`, `asignacion_id = NULL`.
* **Garantía:** `canjeado: false`, cero sentencias `UPDATE` sobre `ticket_qr`.

---

## 3. Criterio de Aceptación Clave

> **Criterio Contractual:**  
> *El boleto permanece en `EMITIDO` tras la consulta y el empleado no puede gastos desde esta vista.*

### 3.1. Cumplimiento de Invariantes:
1. **Conservación de Estado:** El ticket consultado permanece exactamente en su estado (`EMITIDO`).
2. **Cero Mutaciones / Cero Gastos:** La vista no ejecuta ninguna petición mutacional (`POST /api/access` con consumo, ni endpoints de cobro).
3. **Ausencia Estricta de Botón de Canje:** La interfaz no renderiza ningún botón de *"Dar acceso"*, *"Canjear"*, *"Validar entrada"* o *"Consumir"*. El único control de avance es *"Consultar otro boleto"* para reiniciar la lectura.
4. **Alerta Explícita en Pantalla:** Se muestra un contenedor de seguridad resaltado:
   > *"Modo Consulta Informativo (RF-13): El boleto permanece en estado EMITIDO tras esta consulta. En esta vista informativa no se realizan gastos ni canjes de accesos."*

---

## 4. Pantalla de Información del Tiquete

La pantalla presenta de forma destacada y estructurada los cuatro datos obligatorios del alcance técnico, alineados con el sistema de diseño AKROS (`DESIGN.md`):

1. **Servicio:** Nombre de la instalación (`ticket.servicioNombre`), acompañado de icono de ubicación/instalación.
2. **Fecha:** Fecha programada de la reserva (`ticket.fecha` en formato `YYYY-MM-DD`).
3. **Franja Horaria:** Intervalo completo de la reserva (`ticket.horaInicio` – `ticket.horaFin`).
4. **Titular:** Nombre completo del cliente titular (`ticket.titularNombre`).
5. **Badge de Estado:** Indicador visible `EMITIDO` con estilo de éxito (`Badge variant="success"`).

---

## 5. Verificación y Pruebas

### 5.1. Pruebas Unitarias y Visuales Automatizadas

```bash
# Ejecutar tests de cliente, contrato y renderizado visual TSK-FE-15
pnpm --filter web exec tsx --test "src/lib/__tests__/qr-client.test.ts" "src/app/(staff)/scanner/__tests__/scanner-modo-consulta.test.ts" "src/app/(staff)/scanner/__tests__/visual-consultation-render.test.tsx"

# Verificación de linter
pnpm --filter web lint
```

**Resultados obtenidos:**
* `src/lib/__tests__/qr-client.test.ts`: **4/4 pasaron** (parseo SC1, JSON, pares y rechazo de corruptos).
* `src/app/(staff)/scanner/__tests__/scanner-modo-consulta.test.ts`: **4/4 pasaron** (contrato de datos, campos requeridos y preservación de `EMITIDO`).
* `src/app/(staff)/scanner/__tests__/visual-consultation-render.test.tsx`: **4/4 pasaron** (renderizado de tarjeta, presencia de 4 campos, rastro de auditoría, e invariante crítico: ausencia de botones de canje en el DOM).
* **Total:** **12/12 pruebas pasadas** (100% éxito).
* `pnpm --filter web lint`: **0 errores de lint**.

---

## 6. Ficha para Registro en Jira / Pull Request

* **Task ID:** `TSK-FE-15`
* **Historia de Usuario:** `HU-15` (`RF-13`)
* **Rama:** `feature/tsk-fe-15-modo-consulta-informativo`
* **Estado:** Resuelto / Listo para Code Review
* **Commits Clave:**
  * `feat: implementa modo consulta informativo en escáner móvil (TSK-FE-15)`
  * `test: tests unitarios para parser de QR y contrato de consulta (TSK-FE-15)`
  * `docs: documentación técnica TSK-FE-15 en docs/`

---

## 7. Seguimiento CI del PR (hacia `develop`)

Durante la revisión del PR se bloquearon los checks `ci / verificar (pull_request)` tres veces. Fixes aplicados en la misma rama:

| # | Error CI | Causa | Fix |
|---|----------|-------|-----|
| 1 | `TS7016: Could not find a declaration file for module 'react-dom/server'` en `visual-consultation-render.test.tsx` | Faltaba `@types/react-dom` en `apps/web` (solo existía `@types/react`) | `apps/web/package.json`: agregado `"@types/react-dom": "19.0.0"` exacto + `pnpm-lock.yaml` |
| 2 | `db:generate` falla solo en Windows (`"C:\Users\Leonardo" no se reconoce...`) + `WARN: "pnpm" field is no longer read` | Turbo 2.11.4 re-invoca tareas con la ruta absoluta de `pnpm.CMD` sin comillas; el usuario con espacio rompe `cmd.exe`. El campo `pnpm.onlyBuiltDependencies` está deprecado (ya vive como `allowBuilds` en `pnpm-workspace.yaml`) | Raíz `package.json`: eliminado campo `pnpm` deprecado; `db:generate` directo vía `pnpm --filter @sportcomplex/db exec prisma generate...`; `typecheck` encadenado vía `pnpm -r` sin turbo (compatible con CI en ubuntu) |
| 3 | `TS2578: Unused '@ts-expect-error' directive` en `pos/__tests__/pos-ui.test.ts(5,1)` | Interacción entre PRs: el test POS (TSK-FE-18, venido de `develop`) suprimía el error de tipos de `react-dom/server`; al agregar `@types/react-dom` (fix #1) el error suprimido desapareció y la directiva quedó huérfana. Solo visible en el merge commit del CI | `git merge origin/develop` + eliminada la directiva huérfana (el `import` queda intacto y tipado) |

**Verificación final local (equivalente a `ci.yml`):** `pnpm install --frozen-lockfile` OK · `pnpm typecheck` 5/5 OK · `pnpm lint` 5/5 OK (0 errores) · `pnpm --filter web build` OK · tests 20/20 (12 scanner TSK-FE-15 + 8 POS TSK-FE-18).
