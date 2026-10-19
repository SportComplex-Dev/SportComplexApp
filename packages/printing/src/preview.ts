import { DOTS, type Ticket } from "./ticket";

export interface TicketRgba {
  width: number;
  height: number;
  /** RGBA de 8 bits por canal, listo para `new ImageData(data, width, height)`. */
  data: Uint8ClampedArray;
}

/**
 * Píxeles de la vista previa: un píxel por punto, sin filtros. El navegador lo
 * reduce de una vez al tamaño físico (0,125 mm por punto) con CSS.
 */
export function ticketRgba(ticket: Ticket): TicketRgba {
  const height = ticket.rows.length;
  const data = new Uint8ClampedArray(DOTS * height * 4);
  ticket.rows.forEach((row, y) => {
    for (let x = 0; x < DOTS; x++) {
      const v = (row[x >> 3]! & (0x80 >> (x & 7))) !== 0 ? 0 : 255;
      const i = (y * DOTS + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  });
  return { width: DOTS, height, data };
}
