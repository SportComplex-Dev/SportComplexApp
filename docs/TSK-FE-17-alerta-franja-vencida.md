# TSK-FE-17 — Alerta de franja vencida

**Historia de usuario:** HU-17  
**Requerimiento funcional:** RF-15  
**Dependencia de backend:** TSK-BE-17  
**Estado de implementación:** Implementado

## Objetivo

Cuando el endpoint de acceso deniega un ticket porque su franja horaria venció,
el escáner debe mostrar una vista de denegación completa que ayude al personal
de recepción a explicar el motivo del rechazo. No debe presentarse como un toast
ni permitir conceder el acceso.

## Experiencia implementada

- La respuesta `WINDOW_EXPIRED` se normaliza al estado de UI `EXPIRED`.
- La pantalla bloqueante presenta titular, ticket, cancha, horario contratado,
  hora del escaneo y minutos de retraso.
- La pantalla usa estilos compatibles con modo claro y oscuro, y tiempos en
  fuente monoespaciada.
- No se muestra una acción para conceder entrada.
- **Entendido / Continuar Escaneando** cierra la pantalla y vuelve a iniciar
  `html5-qrcode` en la misma página, sin recarga.
- **Derivar a Taquilla / POS** enlaza a `/pos`.

## Contrato utilizado y límite de tolerancia

La UI consume `POST /api/access`, enviando `ticketId`, `signature` y
`postServiceId`. El backend actual responde denegaciones de negocio con HTTP
200 y `data.code: "WINDOW_EXPIRED"`; los datos de la franja y del titular vienen
en `data.ticket`.

El contrato actual no devuelve la tolerancia configurada para la cancha. Además,
la regla activa deniega si `now > end` y no aplica minutos de gracia. En
consecuencia, el frontend calcula la demora a partir del `timestamp` de la
respuesta y muestra `courtToleranceMinutes: 0`, reflejando el comportamiento
actual sin inventar una tolerancia. Una tolerancia positiva requiere que
TSK-BE-17 amplíe el contrato y la regla de negocio.

## Archivos

- `apps/web/src/components/scanner/scanner.service.ts`: contrato tipado,
  parsing del QR y adaptación de respuesta de `/api/access`.
- `apps/web/src/components/scanner/ExpiredSlotScreen.tsx`: vista de denegación.
- `apps/web/src/app/(staff)/scanner/page.tsx`: flujo de cámara, validación y
  reactivación del escáner.
- `apps/web/src/components/scanner/__tests__/scanner.service.test.ts`: pruebas
  de parsing y normalización de respuestas expiradas.

## Validación ejecutada

- `pnpm --filter web typecheck`
- ESLint sobre los archivos del escáner y el layout.
- `pnpm --filter web test`
- `pnpm --filter web exec next build`
