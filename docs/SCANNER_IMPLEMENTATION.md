# TSK-FE-14 — Escáner QR con selección de puesto de turno

## Alcance y estado

La ruta `/scanner` permite seleccionar un puesto, iniciar la cámara bajo demanda, validar un QR contra la cancha activa y solicitar el canje de un ticket. La UI está desacoplada de la red por un adapter tipado. Mientras TSK-BE-14 no publique sus rutas y contrato definitivo, el adapter conectado es una implementación de demostración local; no representa validación ni canje persistentes.

> ## ⚠️ BLOQUEANTE — información que necesitamos de TSK-BE-14
>
> **La conexión real no se puede activar hasta recibir y acordar lo siguiente con backend:**
>
> - [ ] **Endpoints y entorno:** URL base por entorno, método HTTP y ruta para consultar puestos asignados, validar QR y canjear acceso. Indicar si el endpoint de puestos ya existe o si la asignación llega en el contexto de sesión.
> - [ ] **Autenticación y autorización:** mecanismo de autenticación requerido y cómo obtiene backend al empleado autenticado. Confirmar si `empleadoId`, `venueId` y `courtId` se derivan de sesión/asignación en servidor o cuáles campos acepta el payload.
> - [ ] **Contrato de turnos:** JSON real de una asignación, identificadores que corresponden a puesto, empleado, instalación y servicio/cancha, nombres y horas de turno; reglas de asignación vigente y zona horaria.
> - [ ] **Formato y seguridad del QR:** contenido exacto del QR (UUID de `TicketQr.id`, `codigoUuid`, URL u otro), firma/token requerido y procedimiento de verificación. No enviar secretos al frontend.
> - [ ] **Contrato de validación:** payload y respuesta JSON completos, incluyendo la fuente de titular/cancha, y correspondencia de errores HTTP/códigos de dominio con `VALID`, `WRONG_COURT`, `EXPIRED`, `ALREADY_USED` e `INVALID`. El esquema actual solo tiene estados de ticket `EMITIDO | USADO`; backend debe definir cómo identifica expiración y ticket inexistente/QR inválido.
> - [ ] **Contrato de canje:** payload y respuesta JSON, incluidos formato y origen autoritativo de `redeemedAt`; acordar si se registra `LecturaAcceso`, cómo se relaciona la asignación y cómo responde un ticket ya canjeado.
> - [ ] **Atomicidad e idempotencia:** garantías ante doble lectura, reintentos, latencia o pérdida de respuesta, además del resultado que el frontend debe mostrar en cada caso.
> - [ ] **Errores de red y negocio:** estructura JSON estable para errores, códigos y mensajes recuperables; confirmar política para timeout, sesión vencida y falta de conectividad.
>
> **Punto de conexión:** implementar el adapter HTTP en `apps/web/src/components/scanner/scanner.service.ts`, validar allí las respuestas de red y sustituir `scannerAdapter = mockScannerAdapter` por el adapter real. La UI no debe llamar endpoints ni reinterpretar respuestas. Hasta que se complete este checklist, la demostración local no debe usarse para conceder accesos reales.

El modelo Prisma ya contiene `TicketQr`, `Reserva`, `AsignacionPuesto` y `LecturaAcceso`. `TicketQr.id` es UUID, su estado de persistencia es `EMITIDO | USADO` y `LecturaAcceso` registra el empleado, el modo, resultado y fecha/hora. La respuesta del servicio de frontend normaliza estos datos al contrato de validación de TSK-FE-14. El backend es responsable de verificar autenticidad/firma, vigencia, estado, cancha, permisos y atomicidad del canje.

## Componentes

- `apps/web/src/app/(staff)/scanner/page.tsx`: coordina turnos, cámara, validación, canje y feedback.
- `apps/web/src/components/scanner/scanner.service.ts`: contratos públicos, adapter activo y traducción del contexto de turno a payloads. Es el único módulo de la UI que debe conocer la implementación de integración.
- `apps/web/src/components/scanner/shift-selector.tsx`: selección del puesto antes de permitir iniciar la cámara.
- `apps/web/src/components/scanner/scanner-header.tsx`: contexto de turno, control de audio, cambio de puesto y alternancia de tema.
- `apps/web/src/components/scanner/qr-camera-viewport.tsx`: ciclo de vida de `html5-qrcode`, permisos y marco de lectura.
- `apps/web/src/components/scanner/ticket-validation-modal.tsx`: estados de validación, rechazo, carga y canje.
- `apps/web/src/components/scanner/use-audio-feedback.ts`: feedback acústico opcional.

## Diseño claro y oscuro

No había un proveedor de tema ni configuración JavaScript de Tailwind en la aplicación. La app usa Tailwind CSS 4; los tokens se definen como variables semánticas con `@theme inline` en `apps/web/src/styles/globals.css`, y el escáner selecciona la paleta mediante `data-scanner-theme="dark|light"`. El control de tema del header alterna ambos modos; por defecto se conserva el diseño oscuro original.

| Token semántico | Oscuro | Claro |
|---|---|---|
| Fondo (`brand-dark`) | `#111815` | `#f4f7f1` |
| Superficie (`brand-surface`) | `#17211b` | `#ffffff` |
| Superficie secundaria | `#202b24` | `#f0f4ed` |
| Texto (`brand-text`) | `#f5f7f4` | `#17211a` |
| Texto secundario (`brand-muted`) | `#b5c0b7` | `#4b5d50` |
| Acento | `#c9ef75` | `#496817` |

Tarjetas, controles, bordes, cabecera, modal, estados de error y botón de canje utilizan tokens de color Tailwind semánticos. Los colores de texto para mensajes de error y el color de texto sobre botones se adaptan por tema. El feed de cámara permanece oscuro en ambos modos porque muestra la imagen del dispositivo; el HUD conserva texto blanco sobre fondo oscuro y el marco de enfoque conserva el acento de marca.

Los pares principales de texto/fondo de ambas paletas superan WCAG AA para texto normal. Los controles interactivos tienen foco visible y los mensajes de error usan borde, fondo, icono y texto, no solo color.

## Contratos del servicio

`scanner.service.ts` exporta los contratos usados por el frontend:

```ts
export interface ShiftContext {
  empleadoId: string;
  venueId: string;
  courtId: string;
}

export interface TicketValidationPayload {
  qrCode: string;
  courtId: string;
}

export interface TicketValidationResponse {
  isValid: boolean;
  ticketId?: string;
  userName?: string;
  targetCourtName?: string;
  status: "VALID" | "WRONG_COURT" | "EXPIRED" | "ALREADY_USED" | "INVALID";
  message: string;
}

export interface RedeemTicketPayload {
  ticketId: string;
  empleadoId: string;
  courtId: string;
  venueId: string;
  scannedAt: string;
}

export interface RedeemTicketResponse {
  success: boolean;
  redeemedAt: string;
  message: string;
}
```

`ShiftOption` extiende `ShiftContext` con propiedades exclusivamente de presentación: identificador y etiqueta del puesto, nombres de instalación/cancha y horas de turno. El adapter debe poblar esas propiedades desde la asignación real del usuario autenticado. No se debe considerar confiable el `empleadoId`, `venueId` ni `courtId` enviado por el cliente: el backend debe validar la asignación del empleado y derivar o comprobar los identificadores permitidos.

## Conexión a TSK-BE-14

No se presupone una URL ni se crean endpoints de frontend mientras el contrato del backend siga pendiente. Cuando TSK-BE-14 esté disponible:

1. Implementar un `ScannerServiceAdapter` HTTP en `apps/web/src/components/scanner/scanner.service.ts` usando los endpoints acordados con backend y el cliente HTTP estándar de la app.
2. Implementar `getShiftOptions`, `validateTicket` y `redeemTicket` en ese adapter. Serializar los payloads tipados, validar la forma de las respuestas en el límite de red y propagar códigos/mensajes de error como errores visibles para el usuario.
3. Cambiar únicamente la asignación `scannerAdapter` de `mockScannerAdapter` al adapter HTTP. Los componentes y la página solo consumen `scannerService`.
4. Mapear el contrato real de TSK-BE-14 al contrato estable del scanner: estados Prisma `EMITIDO/USADO` y resultados de lectura a `VALID`, `WRONG_COURT`, `EXPIRED`, `ALREADY_USED` o `INVALID`. Acordar explícitamente cómo se comunica expiración, ya que el enum actual `EstadoTicket` solo distingue emitido y usado.
5. Comprobar que `redeemedAt` venga del backend y que el canje sea atómico/idempotente. El backend debe volver a validar la firma del QR, turno vigente, estado del ticket, cancha/instalación y permisos antes de escribir `LecturaAcceso` y marcar el ticket como usado.

Contrato esperado:

| Operación | Entrada | Salida |
|---|---|---|
| Listar turnos | Contexto autenticado | `ShiftOption[]` |
| Validar QR | `TicketValidationPayload` | `TicketValidationResponse` |
| Canjear acceso | `RedeemTicketPayload` | `RedeemTicketResponse` |

La respuesta de validación debe incluir `ticketId` cuando `isValid` sea `true`; de lo contrario la UI no permitirá solicitar el canje. Un error de red no debe convertirse en una respuesta `INVALID`: debe propagarse para mostrar un error de conexión recuperable.

## Adapter local y pruebas manuales

El adapter de demostración está encapsulado en `scanner.service.ts`; no hay store, parser QR ni simulación de red en los componentes. Los códigos locales son `AKR-1001` (válido para Puesto 01), `AKR-1002` (válido para Puesto 02), `AKR-1003` (expirado) y `AKR-1004` (usado). Para probar cancha incorrecta, usar `AKR-1001` en Puesto 02. Estos identificadores son fixtures de demostración y no corresponden al UUID de `TicketQr.id`.

1. Entrar a `/scanner`, confirmar que cámara permanece apagada y alternar claro/oscuro.
2. Elegir el puesto, iniciar cámara y comprobar que el viewport y el marco focal se mantienen legibles en ambos temas.
3. Validar tickets válidos, expirados, usados, inexistentes y de otra cancha; comprobar que los estados dan mensajes diferenciados.
4. Canjear un ticket válido y confirmar que el botón pasa a confirmación y no permite un segundo canje desde el mismo modal.
5. Denegar permisos de cámara, comprobar el error y cambiar de cámara/puesto.
6. Probar el audio en éxito/error con el control activado y desactivado.

La decodificación inferior a 400 ms (RNF-04) depende del dispositivo, iluminación y navegador; no se declara garantizada solo por la configuración de `html5-qrcode`.
