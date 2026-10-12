# TSK-FE-17 — Visualización de límites de franja horaria

## Objetivo y cambio

La tarea FE-17 hace visibles los límites contractuales de acceso para que el
cliente conozca el estado de su ventana antes de acercarse al lector y el
operador reciba un resultado de expiración inequívoco. La ventana es inclusiva:
el acceso solo se permite dentro de `[hora_inicio, hora_fin]`; fuera de ella,
el backend deniega el acceso sin consumir el boleto.

## Componentes intervenidos

- `apps/web/src/components/portal/portal-utils.ts`: normaliza las horas y
  calcula el estado de la ventana usando `TIMEZONE` de `@sportcomplex/core`.
- `apps/web/src/components/portal/access-window-indicator.tsx`: muestra el
  rango horario y el badge dinámico `Franja Próxima`, `Acceso Abierto` o
  `Franja Vencida`; actualiza su estado mientras el portal está abierto.
- `apps/web/src/app/(customer)/portal/page.tsx` y
  `apps/web/src/app/(customer)/portal/tickets/page.tsx`: incorporan el indicador
  en los pases confirmados y en la visualización del QR.
- `apps/web/src/components/scanner/scanner.service.ts` y
  `apps/web/src/components/scanner/ExpiredSlotScreen.tsx`: mapean
  `WINDOW_EXPIRED`, priorizan el mensaje de la API y exponen la franja, el
  instante del intento y el estado `EMITIDO`.
- `apps/web/src/app/(staff)/scanner/page.tsx`: pasa a la alerta el mensaje
  devuelto por la validación.
- `apps/web/src/app/(customer)/portal/__tests__/portal.test.ts` y
  `apps/web/src/components/scanner/__tests__/scanner.service.test.ts`: verifican
  los límites y el contrato visual de expiración.

## RN-06, hora legal de Colombia y mensaje contractual

El portal compara las horas de reserva con la hora local de `TIMEZONE`
(`America/Bogota`, UTC-5), no con la zona horaria configurada en el dispositivo.
El inicio y el fin exactos pertenecen a la ventana abierta.

Para respuestas de escaneo `code: "WINDOW_EXPIRED"`, la pantalla utiliza primero
`data.message` de la API y recurre a
`ACCESS_WINDOW_EXPIRED_MESSAGE` de `@sportcomplex/core` si no viene en la
respuesta. El aviso indica que el intento quedó denegado únicamente por
restricción horaria y que el boleto sigue `EMITIDO`; no se consumió.

## Guía de verificación

1. Iniciar sesión en el portal y abrir `/portal/tickets` o el panel `/portal`.
2. Revisar un pase confirmado con una hora de inicio futura: debe mostrar
   `Franja Próxima` junto a la ventana de entrada en hora Colombia.
3. Dentro de `[hora_inicio, hora_fin]`, incluyendo ambos instantes exactos, el
   badge debe mostrar `Acceso Abierto`.
4. Después del fin de la ventana, el badge debe mostrar `Franja Vencida`.
5. Desde `/scanner`, seleccionar el servicio correspondiente y escanear un QR
   válido fuera de la ventana. La alerta debe mostrar el mensaje contractual,
   identificar la reserva y servicio, indicar `BOLETO EMITIDO` y aclarar que el
   intento se denegó únicamente por horario.
6. Ejecutar las pruebas y verificaciones de la aplicación web:

   ```bash
   pnpm --dir apps/web run typecheck
   pnpm --dir apps/web run lint
   pnpm --filter web test
   ```
