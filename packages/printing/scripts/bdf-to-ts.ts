#!/usr/bin/env tsx
/**
 * Genera `src/fonts/thermal.ts` a partir de `fonts/thermal-sans-mono-24.bdf`.
 *
 * Thermal Sans Mono 24 (12×24) es la tipografía pensada para cabezas
 * térmicas que se comparó en papel con la DIG-ISH58 en el prototipo
 * `factura58`. Cada glifo se recorta a la celda de 12×24 y se guarda como 24
 * filas de 12 bits (3 dígitos hex por fila). No trae negrita: el ticket la
 * simula por doble impresión (ver `ticket.ts`).
 *
 * Uso: pnpm --filter @sportcomplex/printing fonts:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CELL_W = 12;
const CELL_H = 24;

/** ASCII imprimible, Latin-1 y la puntuación tipográfica que llega desde la BD. */
const CHARSET: number[] = [
  ...range(0x20, 0x7e),
  ...range(0xa0, 0xff),
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac,
];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function parse(file: string): Map<number, string> {
  const src = readFileSync(join(ROOT, "fonts", file), "utf8");
  const glyphs = new Map<number, string>();
  let ascent = 24;
  let enc = 0;
  let bbx: [number, number, number, number] = [0, 0, 0, 0];
  let rows: number[] = [];
  let inBitmap = false;
  for (const l of src.split("\n")) {
    const [key, ...rest] = l.trim().split(/\s+/);
    if (key === "FONT_ASCENT") ascent = Number(rest[0]);
    else if (key === "ENCODING") enc = Math.max(0, Number(rest[0]));
    else if (key === "BBX") bbx = rest.map(Number) as [number, number, number, number];
    else if (key === "BITMAP") {
      inBitmap = true;
      rows = [];
    } else if (key === "ENDCHAR") {
      inBitmap = false;
      const [w, h, xoff, yoff] = bbx;
      const cell = new Array<number>(CELL_H).fill(0);
      rows.forEach((bits, r) => {
        const y = ascent - yoff - h + r;
        if (y < 0 || y >= CELL_H) return;
        for (let col = 0; col < w; col++) {
          const x = xoff + col;
          if (x >= 0 && x < CELL_W && ((bits >>> (31 - col)) & 1) === 1) {
            cell[y]! |= 1 << (CELL_W - 1 - x);
          }
        }
      });
      glyphs.set(enc, cell.map((v) => v.toString(16).padStart(3, "0")).join(""));
    } else if (inBitmap && key) {
      // alineado al bit 31, como en factura58
      rows.push((parseInt(key, 16) << (32 - key.length * 4)) >>> 0);
    }
  }
  return glyphs;
}

function table(name: string, glyphs: Map<number, string>): string {
  const entries = CHARSET.filter((c) => glyphs.has(c)).map((c) => `  ${c}: "${glyphs.get(c)}",`);
  return `export const ${name}: Readonly<Record<number, string>> = {\n${entries.join("\n")}\n};\n`;
}

const out = [
  "// Generado por scripts/bdf-to-ts.ts — no editar a mano.",
  "// Thermal Sans Mono 24 (12×24) · Copyright (C) 2018 Michael Billington, derivada de GNU Unifont.",
  "// GPLv2+ con GNU Font Embedding Exception (fonts/LICENSE.md).",
  "// Cada glifo: 24 filas de 12 bits en hex (3 dígitos por fila, bit 11 = columna 0).",
  "",
  table("THERMAL_SANS_MONO", parse("thermal-sans-mono-24.bdf")),
].join("\n");

writeFileSync(join(ROOT, "src", "fonts", "thermal.ts"), out);
console.log(`thermal.ts: ${CHARSET.length} caracteres`);
