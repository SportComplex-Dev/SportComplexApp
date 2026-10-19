/** Errores de transporte a la impresora térmica (WebUSB o Web Bluetooth). */
export type PrinterErrorCode =
  | "PRINTER_NOT_SUPPORTED"
  | "PRINTER_NOT_PAIRED"
  | "PRINTER_UNREACHABLE"
  | "PRINTER_ACCESS_DENIED"
  | "PRINTER_BUSY"
  | "PRINTER_NO_ENDPOINT"
  | "PRINTER_TRANSFER_FAILED";

const MENSAJES: Record<PrinterErrorCode, string> = {
  PRINTER_NOT_SUPPORTED: "Este navegador no puede usar la impresora térmica. Use Chrome o Edge.",
  PRINTER_NOT_PAIRED: "No hay una impresora emparejada en este equipo.",
  PRINTER_UNREACHABLE: "No se pudo conectar con la impresora. Verifique que esté encendida y cerca.",
  PRINTER_ACCESS_DENIED: "El sistema no da permiso para abrir la impresora (revise la regla udev).",
  PRINTER_BUSY: "La impresora está tomada por el sistema (CUPS/usblp). Libérela para usar WebUSB.",
  PRINTER_NO_ENDPOINT: "El dispositivo elegido no es una impresora compatible.",
  PRINTER_TRANSFER_FAILED: "La impresora no aceptó los datos. Revise el papel y la conexión.",
};

export class PrinterError extends Error {
  constructor(
    readonly code: PrinterErrorCode,
    readonly causa?: unknown,
  ) {
    super(MENSAJES[code]);
    this.name = "PrinterError";
  }
}
