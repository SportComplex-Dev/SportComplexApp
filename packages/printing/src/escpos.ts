import { ROW_BYTES, type Ticket } from "./ticket";

/** Filas por banda de `GS v 0` (la DIG-ISH58 acepta imágenes altas troceadas). */
const BAND_ROWS = 64;

/** Bytes ESC/POS de la imagen: el bitmap por bandas (GS v 0), avance de papel y corte parcial. */
export function escposImagen(ticket: Ticket): Uint8Array {
  const out: number[] = [];
  for (let start = 0; start < ticket.rows.length; start += BAND_ROWS) {
    const band = ticket.rows.slice(start, start + BAND_ROWS);
    out.push(0x1d, 0x76, 0x30, 0x00, ROW_BYTES, 0, band.length, 0);
    for (const r of band) out.push(...r);
  }
  out.push(0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0x00);
  return Uint8Array.from(out);
}

/**
 * La impresora puede perder los primeros bytes si estaba en reposo: se envían
 * 64 NUL (se ignoran) de relleno y un reset (`ESC @`) antes del contenido.
 */
export function prepararEnvio(bytes: Uint8Array): Uint8Array {
  const data = new Uint8Array(64 + 2 + bytes.length);
  data.set([0x1b, 0x40], 64);
  data.set(bytes, 66);
  return data;
}
