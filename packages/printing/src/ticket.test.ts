import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { escposImagen, prepararEnvio } from "./escpos";
import { ticketPdf } from "./pdf";
import { ticketRgba } from "./preview";
import { DOTS, ROW_BYTES, Ticket, wrap } from "./ticket";

/**
 * Réplica exacta de `build_ticket()` de factura58 con la fecha fija con la
 * que se generó `fixtures/factura58-thermal.bin`
 * (`factura58 --fuente thermal --file`, 2026-10-18 09:30:00).
 */
function facturaDemo(): { t: Ticket; qr: [number, number] } {
  const total = "$30.000";
  const t = new Ticket();
  t.align(1).bold(true).size(0x11).line("NOVACARIBE SAS").size(0x00).bold(false);
  t.line("NIT 901.654.327-5").line("Cra 53 # 76-120, Barranquilla").line("Tel: 300 555 0142");
  t.line("Regimen: Responsable de IVA").feed(1);
  t.bold(true).line("FACTURA DE VENTA").line("No. NC-000127").bold(false);
  t.align(0).rule("-").pair("Fecha:", "2026-10-18").pair("Hora:", "09:30:00").rule("-");
  t.bold(true).line("CLIENTE").bold(false).line("Jose Romero").line("C.C. 1.047.389.215");
  t.rule("-").pair("DESCRIPCION", "VALOR").rule("-").pair("Prestamo de dinero", total).rule("-");
  t.pair("Subtotal:", total).pair("IVA (0%):", "$0").rule("=");
  t.bold(true).size(0x01).pair("TOTAL:", total).size(0x00).bold(false).rule("=");
  t.pair("Forma de pago:", "Efectivo").feed(1);
  t.align(1).line("Escanee el codigo QR");
  const qrStart = t.height;
  t.qr("FACT NC-000127|NIT 901.654.327-5|CC 1.047.389.215|TOTAL 30000 COP|2026-10-18");
  const qr: [number, number] = [qrStart, t.height];
  t.align(1).feed(1);
  t.line("¡Gracias por su confianza!").line("Documento de prueba").line("Datos ficticios");
  return { t, qr };
}

/** Filas del bitmap a partir de los bytes `GS v 0`. */
function filasEscpos(b: Uint8Array): string[] {
  const filas: string[] = [];
  let at = 0;
  while (b[at] === 0x1d && b[at + 1] === 0x76) {
    const n = b[at + 6]!;
    for (let i = 0; i < n; i++) filas.push(Buffer.from(b.slice(at + 8 + i * ROW_BYTES, at + 8 + (i + 1) * ROW_BYTES)).toString("hex"));
    at += 8 + n * ROW_BYTES;
  }
  return filas;
}

describe("Ticket (port de factura58)", () => {
  it("dibuja el texto punto a punto igual que el prototipo en Rust", () => {
    const golden = readFileSync(new URL("./fixtures/factura58-thermal.bin", import.meta.url));
    const { t, qr } = facturaDemo();
    const ts = escposImagen(t);
    assert.equal(ts.length, golden.length);
    // El QR tiene la misma versión y tamaño, pero `qrcode` (npm) puede elegir
    // otra máscara que la crate de Rust: ambos son válidos y se lee aparte
    // (comprobante.test.ts). Todo lo demás debe coincidir.
    const [a, b] = [filasEscpos(ts), filasEscpos(golden)];
    assert.equal(a.length, b.length);
    a.forEach((fila, y) => {
      if (y < qr[0] || y >= qr[1]) assert.equal(fila, b[y], `fila ${y}`);
    });
    assert.deepEqual([...ts.slice(-7)], [...golden.subarray(-7)]);
  });

  it("dibuja filas de 384 puntos y centra el texto de forma simétrica", () => {
    const t = new Ticket().align(1).line("AB");
    assert.ok(t.rows.every((r) => r.length === ROW_BYTES));
    // "AB" ocupa 24 puntos: 180 a cada lado.
    const encendidos = t.rows.flatMap((r) =>
      Array.from({ length: DOTS }, (_, x) => ((r[x >> 3]! & (0x80 >> (x & 7))) !== 0 ? x : -1)),
    ).filter((x) => x >= 0);
    assert.ok(Math.min(...encendidos) >= 180);
    assert.ok(Math.max(...encendidos) < 204);
  });

  it("parte el texto largo por palabras al ancho disponible", () => {
    assert.deepEqual(wrap("Cancha sintética de fútbol cinco techada", 16), [
      "Cancha sintética",
      "de fútbol cinco",
      "techada",
    ]);
    assert.deepEqual(wrap("x".repeat(20), 8), ["xxxxxxxx", "xxxxxxxx", "xxxx"]);
  });

  it("baja el valor de línea cuando etiqueta y valor no caben", () => {
    const corto = new Ticket().pair("A:", "B").height;
    const largo = new Ticket().pair("Una etiqueta bastante larga:", "$1.000.000").height;
    assert.equal(largo, corto * 2);
  });
});

describe("ESC/POS", () => {
  it("trocea la imagen en bandas GS v 0 de hasta 64 filas y cierra con avance y corte", () => {
    const t = new Ticket().feed(5); // 150 filas → 64 + 64 + 22
    const b = escposImagen(t);
    const bandas: number[] = [];
    let at = 0;
    while (b[at] === 0x1d && b[at + 1] === 0x76) {
      assert.deepEqual([...b.slice(at, at + 6)], [0x1d, 0x76, 0x30, 0x00, ROW_BYTES, 0]);
      bandas.push(b[at + 6]!);
      at += 8 + b[at + 6]! * ROW_BYTES;
    }
    assert.deepEqual(bandas, [64, 64, 22]);
    assert.deepEqual([...b.slice(at)], [0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0x00]);
  });

  it("antepone 64 NUL y ESC @ antes de enviar", () => {
    const out = prepararEnvio(Uint8Array.from([1, 2, 3]));
    assert.equal(out.length, 69);
    assert.ok(out.slice(0, 64).every((v) => v === 0));
    assert.deepEqual([...out.slice(64)], [0x1b, 0x40, 1, 2, 3]);
  });
});

describe("PDF de 58 mm", () => {
  it("es un PDF 1.4 con xref coherente y la imagen del bitmap", () => {
    const { t } = facturaDemo();
    const pdf = ticketPdf(t);
    const text = Buffer.from(pdf).toString("latin1");
    assert.ok(text.startsWith("%PDF-1.4\n"));
    assert.ok(text.endsWith("%%EOF\n"));
    assert.match(text, new RegExp(`/Width ${DOTS} /Height ${t.height} `));
    assert.match(text, /\/MediaBox \[0 0 164\.409 /); // 58 mm
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
    assert.ok(text.slice(startxref).startsWith("xref\n0 6\n"));
    Array.from(text.matchAll(/^(\d{10}) 00000 n $/gm)).forEach((m, i) => {
      assert.ok(text.slice(Number(m[1])).startsWith(`${i + 1} 0 obj\n`));
    });
  });
});

describe("Vista previa", () => {
  it("convierte cada punto en un píxel RGBA negro o blanco", () => {
    const t = new Ticket().line("X");
    const { width, height, data } = ticketRgba(t);
    assert.equal(width, DOTS);
    assert.equal(height, t.height);
    assert.equal(data.length, DOTS * t.height * 4);
    assert.ok([...data].every((v, i) => (i % 4 === 3 ? v === 255 : v === 0 || v === 255)));
    assert.ok([...data].some((v) => v === 0));
  });
});
