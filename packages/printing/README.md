# Impresión térmica (`packages/printing`)

> Estado: vigente 2026-10-18

## Qué es

Ticket de 58 mm para la impresora térmica de taquilla (DIG-ISH58, ESC/POS). Es un port a TypeScript del prototipo `factura58`, validado en papel.

Todo el ticket, texto y QR, se dibuja en **un único bitmap de 384 puntos** (Thermal Sans Mono 24, celda de 12×24). Ese bitmap sale por tres caminos, así que la vista previa es idéntica punto a punto a lo impreso:

| Salida | Función | Dónde se usa |
|---|---|---|
| Bytes ESC/POS (`GS v 0` en bandas de 64 filas, avance y corte parcial) | `escposImagen` + `prepararEnvio` | POS → Web Bluetooth o WebUSB |
| PDF de 58 mm (0,125 mm por punto) | `ticketPdf` | `GET /api/pdf/receipt/file` |
| RGBA para `<canvas>` | `ticketRgba` | `PosTicketPreview` |

No usa React ni depende de otros `@sportcomplex/*`, y corre igual en el navegador y en Node. Decisión en el [ADR 008](../../docs/architecture/adrs/008-impresion-termica-navegador.md).

## Estructura / Exports

```
src/ticket.ts        # Ticket: align/bold/size/line/text/pair/rule/feed/qr
src/escpos.ts        # escposImagen, prepararEnvio
src/pdf.ts           # ticketPdf
src/preview.ts       # ticketRgba
src/comprobante.ts   # TicketComprobanteInput, construirTicketComprobante, pesos
src/bluetooth.ts     # solo navegador (BLE): soportaWebBluetooth, solicitarImpresoraBluetooth, impresoraBluetoothAutorizada, enviarPorBluetooth
src/webusb.ts        # solo navegador (USB): soportaWebUsb, solicitarImpresora, impresoraAutorizada, enviarAImpresora
src/errores.ts       # PrinterError compartido por ambos transportes
src/fonts/thermal.ts # generado por scripts/bdf-to-ts.ts (no editar)
```

Exports: `.` (todo menos los transportes), `./bluetooth` y `./webusb`.

## Cómo usar

```ts
import { construirTicketComprobante, escposImagen, prepararEnvio } from "@sportcomplex/printing";
import { enviarPorBluetooth, solicitarImpresoraBluetooth } from "@sportcomplex/printing/bluetooth";

const ticket = construirTicketComprobante(comprobante); // JSON de GET /api/pdf/receipt
const impresora = await solicitarImpresoraBluetooth();  // desde un clic del operador
await enviarPorBluetooth(impresora, prepararEnvio(escposImagen(ticket)));
// Por USB: solicitarImpresora / enviarAImpresora de "@sportcomplex/printing/webusb".
```

## Límites (No hacer)

- No imprimir desde el portal del cliente: imprimir es exclusivo del operador (`/pos`).
- No codificar en el QR nada que no sea `qr.payload` firmado por el servidor.
- No editar `src/fonts/thermal.ts` a mano: regenerarlo con `pnpm --filter @sportcomplex/printing fonts:generate`.

## Testing

```bash
pnpm --filter @sportcomplex/printing test
pnpm --filter @sportcomplex/printing typecheck
```

28 tests co-locados:
- **Fidelidad con el prototipo:** `src/fixtures/factura58-thermal.bin` lo generó `factura58 --fuente thermal --file` con fecha fija; el texto se compara punto a punto.
- **QR:** se lee con `zbarimg` si está instalado.
- **Bluetooth y WebUSB:** se prueban con dispositivos falsos (servicio GATT de respaldo, reducción del trozo por MTU, errores).

## Licencia de la fuente

Thermal Sans Mono 24 es GPLv2+ con *GNU Font Embedding Exception* (ver `fonts/LICENSE.md`). La tabla de glifos generada se distribuye bajo esa licencia; los tickets y PDF impresos no quedan sujetos a la GPL.
