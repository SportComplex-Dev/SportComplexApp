/**
 * Envío de bytes ESC/POS a la impresora térmica por Web Bluetooth (BLE; solo
 * navegador: Chrome/Edge en HTTPS o localhost).
 *
 * La DIG-ISH58 (`PrinterLE_xxxx`) expone tres servicios GATT con una
 * característica de escritura cada uno; cualquiera imprime. Se prueban en el
 * orden de `SERVICIOS_IMPRESORA`.
 *
 * Los tipos de Web Bluetooth se declaran aquí en lo mínimo que se usa, para
 * no depender de `@types/web-bluetooth` y poder probar con un dispositivo falso.
 */

import { PrinterError } from "./errores";

export { PrinterError, type PrinterErrorCode } from "./errores";

type BluetoothUuid = number | string;

export interface BleCharacteristicLike {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
}

export interface BleServiceLike {
  getCharacteristic(uuid: BluetoothUuid): Promise<BleCharacteristicLike>;
}

export interface BleServerLike {
  connected: boolean;
  connect(): Promise<BleServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: BluetoothUuid): Promise<BleServiceLike>;
}

export interface BleDeviceLike {
  id: string;
  name?: string | undefined;
  gatt?: BleServerLike | undefined;
}

export interface BluetoothLike {
  getDevices?: () => Promise<BleDeviceLike[]>;
  requestDevice(options: {
    filters: ({ services: BluetoothUuid[] } | { namePrefix: string })[];
    optionalServices: BluetoothUuid[];
  }): Promise<BleDeviceLike>;
}

/** Servicio GATT y característica de escritura de las térmicas de 58 mm. */
export const SERVICIOS_IMPRESORA: readonly { servicio: BluetoothUuid; escritura: BluetoothUuid }[] = [
  { servicio: 0x18f0, escritura: 0x2af1 },
  // UART transparente de Microchip/ISSC.
  { servicio: "49535343-fe7d-4ae5-8fa9-9fafd205e455", escritura: "49535343-8841-43f4-a8d4-ecbe34729bb3" },
  { servicio: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", escritura: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
];

/** Escrituras de 180 bytes caben en el MTU que negocia BlueZ/Chrome; si no, se baja a 20 (MTU mínimo 23). */
const CHUNK = 180;
const CHUNK_MINIMO = 20;

export function bluetoothDelNavegador(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth ?? null;
}

export function soportaWebBluetooth(bt: BluetoothLike | null = bluetoothDelNavegador()): boolean {
  return bt !== null;
}

function requerirBluetooth(bt: BluetoothLike | null): BluetoothLike {
  if (!bt) throw new PrinterError("PRINTER_NOT_SUPPORTED");
  return bt;
}

/**
 * Impresora ya autorizada en este navegador, sin diálogo. `getDevices()` aún
 * es experimental en Chrome: sin él, se empareja de nuevo en cada carga.
 */
export async function impresoraBluetoothAutorizada(
  bt: BluetoothLike | null = bluetoothDelNavegador(),
): Promise<BleDeviceLike | null> {
  const navegador = requerirBluetooth(bt);
  if (!navegador.getDevices) return null;
  const devices = await navegador.getDevices();
  return devices[0] ?? null;
}

/** Abre el selector del navegador; debe llamarse desde un clic del operador. */
export async function solicitarImpresoraBluetooth(
  bt: BluetoothLike | null = bluetoothDelNavegador(),
): Promise<BleDeviceLike> {
  try {
    return await requerirBluetooth(bt).requestDevice({
      filters: [...SERVICIOS_IMPRESORA.map((s) => ({ services: [s.servicio] })), { namePrefix: "Printer" }],
      optionalServices: SERVICIOS_IMPRESORA.map((s) => s.servicio),
    });
  } catch (e) {
    if (e instanceof PrinterError) throw e;
    // NotFoundError: el operador cerró el diálogo sin elegir.
    throw new PrinterError("PRINTER_NOT_PAIRED", e);
  }
}

async function caracteristicaDeEscritura(server: BleServerLike): Promise<BleCharacteristicLike> {
  for (const { servicio, escritura } of SERVICIOS_IMPRESORA) {
    try {
      const c = await (await server.getPrimaryService(servicio)).getCharacteristic(escritura);
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    } catch {
      // Servicio ausente en este modelo: se prueba el siguiente.
    }
  }
  throw new PrinterError("PRINTER_NO_ENDPOINT");
}

/**
 * Envía los bytes ya preparados (`prepararEnvio(escposImagen(ticket))`).
 * Escribe con respuesta cuando la característica lo permite: es más lento,
 * pero la impresora regula el flujo y no se desborda su búfer.
 */
export async function enviarPorBluetooth(device: BleDeviceLike, bytes: Uint8Array): Promise<void> {
  if (!device.gatt) throw new PrinterError("PRINTER_NO_ENDPOINT");
  let server: BleServerLike;
  try {
    server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  } catch (e) {
    throw new PrinterError("PRINTER_UNREACHABLE", e);
  }
  try {
    const c = await caracteristicaDeEscritura(server);
    const escribir = (data: Uint8Array) =>
      c.properties.write ? c.writeValueWithResponse(data) : c.writeValueWithoutResponse(data);
    let chunk = CHUNK;
    for (let at = 0; at < bytes.length; ) {
      try {
        await escribir(bytes.slice(at, at + chunk));
        at += chunk;
      } catch (e) {
        // El primer trozo no cupo en el MTU negociado: se reintenta con el mínimo.
        if (at === 0 && chunk > CHUNK_MINIMO) {
          chunk = CHUNK_MINIMO;
          continue;
        }
        throw new PrinterError("PRINTER_TRANSFER_FAILED", e);
      }
    }
  } finally {
    server.disconnect();
  }
}
