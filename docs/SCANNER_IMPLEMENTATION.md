# TSK-FE-14 — Escáner QR con selección de puesto de turno

## Objetivo y estado

La ruta `/scanner` permite a administradores y empleados lectores activos
seleccionar un servicio deportivo, leer un ticket QR firmado y solicitar su
canje. La integración está conectada al backend; no se utilizan tickets ni
respuestas de demostración.

## Integración con API

- `GET /api/access/services` carga la lista de puestos/servicios disponibles.
  El lector valida la forma de la respuesta y transforma cada ID en un entero
  positivo. La cámara no se activa hasta seleccionar un puesto válido.
- `POST /api/access/redeem` recibe `ticketId`, `signature` y `postServiceId`.
  El escáner solo extrae los datos del QR; el backend comprueba la firma, el
  rol/cuenta del operador, el servicio, la franja horaria y el estado del
  boleto.

El QR firmado sigue el formato:

```text
SC1:<ticket UUID>:<firma HMAC-SHA256 hexadecimal>
```

El servicio envía `postServiceId` como número entero positivo, nunca como
texto ni booleano. La pantalla muestra acceso concedido únicamente cuando la
respuesta contiene `access: "GRANTED"`.

| Respuesta | Presentación |
| --- | --- |
| `GRANTED` / `CONCEDIDO` | Acceso concedido y detalles disponibles del titular, reserva, servicio y horario |
| `DENIED` / `ALREADY_USED` | Boleto ya utilizado anteriormente |
| `DENIED` / `SERVICE_MISMATCH` | El ticket pertenece a otro escenario deportivo |
| `DENIED` / `WINDOW_EXPIRED` | Franja horaria vencida o no disponible; el boleto no se consume |

Las respuestas de denegación no se convierten en concesiones. Los fallos de
red y las respuestas mal formadas se propagan como errores visibles, separados
de los resultados de negocio.

## Ciclo de vida de cámara, diálogo y audio

La cámara se inicia solo después de elegir el puesto. Los fallos reales de
permisos o inicialización se presentan en la interfaz; los callbacks de
fotogramas sin QR se ignoran para evitar alertas repetitivas. Cerrar el diálogo
con Escape o con el botón de cerrar ejecuta el mismo reinicio que **Escanear
siguiente**: se limpia el ticket, se cierra el diálogo y se devuelve el flujo a
escaneo para reactivar la cámara.

El audio es opcional. Al habilitarlo desde el control del lector, el contexto
Web Audio se crea o reanuda directamente dentro del gesto del usuario, en
cumplimiento de las políticas de autoplay del navegador.

## Componentes

- `apps/web/src/app/(staff)/scanner/page.tsx`: coordina puesto, cámara, canje y estados.
- `apps/web/src/components/scanner/scanner.service.ts`: parser QR y cliente de los endpoints de servicios y canje.
- `apps/web/src/components/scanner/shift-selector.tsx`: selección del puesto antes de iniciar la lectura.
- `apps/web/src/components/scanner/scanner-header.tsx`: muestra el turno y controles de audio/tema.
- `apps/web/src/components/scanner/qr-camera-viewport.tsx`: ciclo de vida de la cámara y lectura QR.
- `apps/web/src/components/scanner/ticket-validation-modal.tsx`: estados de validación, denegación y confirmación.
- `apps/web/src/components/scanner/use-audio-feedback.ts`: tonos opcionales de éxito y error.
- `apps/web/src/components/scanner/__tests__/scanner.service.test.ts`: pruebas de parsing, listado de servicios y respuestas del canje.

## Verificación

Desde la raíz del monorepo:

```bash
pnpm --dir apps/web run typecheck
pnpm --dir apps/web run lint
pnpm --filter web test
```

Prueba manual sugerida: abrir `/scanner` con una cuenta autorizada, confirmar
que la cámara no inicia sin puesto, seleccionar un servicio y leer un QR
firmado. Verificar un canje concedido, un segundo intento (`ALREADY_USED`), un
ticket de otro servicio (`SERVICE_MISMATCH`) y un ticket fuera de horario
(`WINDOW_EXPIRED`). Cerrar el diálogo mediante Escape y X y confirmar que queda
listo para el siguiente escaneo. Los resultados finales siempre dependen de la
respuesta autoritativa del backend.
