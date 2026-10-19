/**
 * Envío de bytes ESC/POS a la impresora térmica por WebUSB (solo navegador:
 * Chrome/Edge en HTTPS o localhost).
 *
 * Los tipos de WebUSB se declaran aquí en lo mínimo que se usa, para no
 * depender de `@types/w3c-web-usb` y poder probar con un dispositivo falso.
 */

import { PrinterError } from "./errores";

export { PrinterError, type PrinterErrorCode } from "./errores";

export interface UsbEndpointLike {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
}

export interface UsbInterfaceLike {
  interfaceNumber: number;
  alternate: { interfaceClass: number; endpoints: UsbEndpointLike[] };
}

export interface UsbDeviceLike {
  productName?: string | undefined;
  opened: boolean;
  configuration: { interfaces: UsbInterfaceLike[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  transferOut(endpoint: number, data: BufferSource): Promise<{ status: string }>;
}

export interface UsbLike {
  getDevices(): Promise<UsbDeviceLike[]>;
  requestDevice(options: { filters: { classCode?: number }[] }): Promise<UsbDeviceLike>;
}

/** Clase USB de impresoras (USB Printer Class 0x07). */
const USB_CLASS_PRINTER = 7;
/** Tamaño de cada `transferOut`; los buffers de las térmicas baratas son pequeños. */
const CHUNK = 4096;

export function usbDelNavegador(): UsbLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { usb?: UsbLike }).usb ?? null;
}

export function soportaWebUsb(usb: UsbLike | null = usbDelNavegador()): boolean {
  return usb !== null;
}

function requerirUsb(usb: UsbLike | null): UsbLike {
  if (!usb) throw new PrinterError("PRINTER_NOT_SUPPORTED");
  return usb;
}

/** Impresora ya autorizada en este navegador (no muestra diálogo). */
export async function impresoraAutorizada(
  usb: UsbLike | null = usbDelNavegador(),
): Promise<UsbDeviceLike | null> {
  const devices = await requerirUsb(usb).getDevices();
  return devices.find((d) => salidaDeImpresion(d) !== null) ?? devices[0] ?? null;
}

/** Abre el selector del navegador; debe llamarse desde un clic del operador. */
export async function solicitarImpresora(
  usb: UsbLike | null = usbDelNavegador(),
): Promise<UsbDeviceLike> {
  try {
    return await requerirUsb(usb).requestDevice({ filters: [{ classCode: USB_CLASS_PRINTER }] });
  } catch (e) {
    if (e instanceof PrinterError) throw e;
    // NotFoundError: el operador cerró el diálogo sin elegir.
    throw new PrinterError("PRINTER_NOT_PAIRED", e);
  }
}

/** Interfaz y endpoint bulk OUT por donde se envía; prefiere la de clase impresora. */
export function salidaDeImpresion(
  device: UsbDeviceLike,
): { interfaceNumber: number; endpointNumber: number } | null {
  const candidatas = (device.configuration?.interfaces ?? [])
    .map((i) => ({ i, ep: i.alternate.endpoints.find((e) => e.direction === "out" && e.type === "bulk") }))
    .filter((x): x is { i: UsbInterfaceLike; ep: UsbEndpointLike } => x.ep !== undefined)
    .sort((a, b) => Number(b.i.alternate.interfaceClass === USB_CLASS_PRINTER) - Number(a.i.alternate.interfaceClass === USB_CLASS_PRINTER));
  const elegida = candidatas[0];
  return elegida ? { interfaceNumber: elegida.i.interfaceNumber, endpointNumber: elegida.ep.endpointNumber } : null;
}

/** Envía los bytes ya preparados (`prepararEnvio(escposImagen(ticket))`). */
export async function enviarAImpresora(device: UsbDeviceLike, bytes: Uint8Array): Promise<void> {
  try {
    if (!device.opened) await device.open();
  } catch (e) {
    throw new PrinterError("PRINTER_ACCESS_DENIED", e);
  }
  try {
    if (!device.configuration) await device.selectConfiguration(1);
    const salida = salidaDeImpresion(device);
    if (!salida) throw new PrinterError("PRINTER_NO_ENDPOINT");
    try {
      await device.claimInterface(salida.interfaceNumber);
    } catch (e) {
      throw new PrinterError("PRINTER_BUSY", e);
    }
    try {
      for (let at = 0; at < bytes.length; at += CHUNK) {
        const r = await device.transferOut(salida.endpointNumber, bytes.slice(at, at + CHUNK));
        if (r.status !== "ok") throw new PrinterError("PRINTER_TRANSFER_FAILED", r.status);
      }
    } catch (e) {
      throw e instanceof PrinterError ? e : new PrinterError("PRINTER_TRANSFER_FAILED", e);
    } finally {
      await device.releaseInterface(salida.interfaceNumber).catch(() => undefined);
    }
  } finally {
    await device.close().catch(() => undefined);
  }
}
