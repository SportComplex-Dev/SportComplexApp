import QRCode from "qrcode";
import { THERMAL_SANS_MONO } from "./fonts/thermal";

/**
 * Ticket térmico de 58 mm dibujado como bitmap monocromo (1 = punto negro).
 *
 * Port de `factura58` (prototipo validado en papel con la DIG-ISH58): todo el
 * ticket —texto y QR— se dibuja en un único bitmap de 384 puntos. Ese mismo
 * bitmap sale a la impresora (`GS v 0`), al PDF de 58 mm y a la vista previa,
 * así que lo que ve el operador es idéntico punto a punto a lo impreso.
 */

/** Caracteres por línea (fuente A, 58 mm). */
export const COLS = 32;
/** Puntos por línea (48 mm a 0,125 mm/punto). */
export const DOTS = 384;
/** Bytes por fila del bitmap. */
export const ROW_BYTES = DOTS / 8;

const LINE_DOTS = 30; // interlineado por defecto de ESC/POS
const CELL_W = 12; // celda de carácter: 12x24 puntos
const CELL_H = 24;

export type Alineacion = 0 | 1 | 2; // izquierda, centro, derecha

/** Columnas que ocupa un glifo: la negrita pinta una más (se monta sobre la celda vecina). */
const GLYPH_W = CELL_W + 1;

/** Filas del glifo (bit 12 = columna 0); `?` si la fuente no lo trae. */
function glyphRows(c: string, bold: boolean): number[] {
  const hex =
    THERMAL_SANS_MONO[c.codePointAt(0) ?? 0x3f] ??
    // Sin glifo: se intenta la letra base sin tilde (p. ej. "ő" → "o").
    THERMAL_SANS_MONO[c.normalize("NFD").codePointAt(0) ?? 0x3f] ??
    THERMAL_SANS_MONO[0x3f]!;
  const rows: number[] = [];
  for (let i = 0; i < CELL_H; i++) {
    const bits = parseInt(hex.slice(i * 3, i * 3 + 3), 16) << 1;
    // negrita por doble impresión, 1 punto a la derecha (como hacen las cabezas térmicas)
    rows.push(bold ? bits | (bits >> 1) : bits);
  }
  return rows;
}

export class Ticket {
  readonly rows: Uint8Array[] = [];
  private alignment: Alineacion = 0;
  private isBold = false;
  private w = 1;
  private h = 1;

  align(n: Alineacion): this {
    this.alignment = n;
    return this;
  }

  bold(on: boolean): this {
    this.isBold = on;
    return this;
  }

  /** Igual que `GS ! n`: nibble alto = ancho − 1, nibble bajo = alto − 1. */
  size(n: number): this {
    this.w = (n >> 4) + 1;
    this.h = (n & 0x0f) + 1;
    return this;
  }

  /** Columnas disponibles con el tamaño actual. */
  get cols(): number {
    return Math.floor(COLS / this.w);
  }

  get height(): number {
    return this.rows.length;
  }

  private blank(n: number): void {
    for (let i = 0; i < n; i++) this.rows.push(new Uint8Array(ROW_BYTES));
  }

  private set(x: number, y: number): void {
    this.rows[y]![x >> 3]! |= 0x80 >> (x & 7);
  }

  line(s: string): this {
    const { w, h } = this;
    const chars = Array.from(s);
    const top = this.rows.length;
    this.blank(Math.max(CELL_H * h + (LINE_DOTS - CELL_H), LINE_DOTS));
    const textW = chars.length * CELL_W * w;
    const x0 =
      this.alignment === 1
        ? Math.floor(Math.max(DOTS - textW, 0) / 2)
        : this.alignment === 2
          ? Math.max(DOTS - textW, 0)
          : 0;
    chars.forEach((c, i) => {
      glyphRows(c, this.isBold).forEach((bits, gy) => {
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (((bits >> (GLYPH_W - 1 - gx)) & 1) === 0) continue;
          // ampliación por vecino más cercano, como hace la impresora
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              const x = x0 + i * CELL_W * w + gx * w + dx;
              if (x < DOTS) this.set(x, top + gy * h + dy);
            }
          }
        }
      });
    });
    return this;
  }

  /** Texto partido por palabras al ancho disponible (las palabras largas se cortan). */
  text(s: string): this {
    for (const l of wrap(s, this.cols)) this.line(l);
    return this;
  }

  /** Etiqueta a la izquierda y valor a la derecha; si no caben, el valor baja de línea. */
  pair(l: string, r: string): this {
    const [ll, rl] = [Array.from(l).length, Array.from(r).length];
    const cols = this.cols;
    if (ll + rl + 1 > cols) {
      this.text(l);
      for (const part of wrap(r, cols)) this.line(part.padStart(cols));
      return this;
    }
    return this.line(`${l}${" ".repeat(Math.max(cols - ll - rl, 1))}${r}`);
  }

  rule(c: string): this {
    return this.line(c.repeat(this.cols));
  }

  feed(n: number): this {
    this.blank(n * LINE_DOTS);
    return this;
  }

  /** QR centrado exactamente en los 384 puntos (el lado se fuerza a ser par). */
  qr(data: string): this {
    const { modules } = QRCode.create(data, { errorCorrectionLevel: "M" });
    const w = modules.size;
    const quiet = 2;
    const scale = Math.min(Math.max(Math.floor(372 / (w + 2 * quiet)), 1), 8); // módulos grandes: lectura más fiable
    let side = (w + 2 * quiet) * scale;
    if (side % 2 === 1) side += 1;
    const left = (DOTS - side) / 2;
    const top = this.rows.length;
    this.blank(side);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const mx = Math.floor(x / scale);
        const my = Math.floor(y / scale);
        if (mx < quiet || my < quiet || mx >= w + quiet || my >= w + quiet) continue;
        if (modules.get(my - quiet, mx - quiet)) this.set(left + x, top + y);
      }
    }
    return this;
  }
}

export function wrap(s: string, cols: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of s.trim().split(/\s+/)) {
    let rest = Array.from(word);
    while (rest.length > cols) {
      if (cur) out.push(cur);
      cur = "";
      out.push(rest.slice(0, cols).join(""));
      rest = rest.slice(cols);
    }
    const piece = rest.join("");
    if (!piece) continue;
    if (!cur) cur = piece;
    else if (Array.from(cur).length + 1 + rest.length <= cols) cur += ` ${piece}`;
    else {
      out.push(cur);
      cur = piece;
    }
  }
  if (cur || out.length === 0) out.push(cur);
  return out;
}
