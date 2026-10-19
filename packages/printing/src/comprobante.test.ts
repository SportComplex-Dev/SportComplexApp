import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { construirTicketComprobante, pesos, type TicketComprobanteInput } from "./comprobante";
import { DOTS, ROW_BYTES, type Ticket } from "./ticket";

const PAYLOAD = "SC1:7d3f0b8a-9c1e-4f4a-8a51-2b6f0c9e1d23:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0";

function comprobante(over: Partial<TicketComprobanteInput> = {}): TicketComprobanteInput {
  return {
    membrete: { entidad: "Akros Latam", nit: "900.000.000-1", direccion: null, telefono: null, correo: null, pie: null },
    emision: { generadoEn: "2026-10-18T14:30:00.000Z", zonaHoraria: "America/Bogota" },
    reserva: {
      id: "a1b2c3d4-0000-4000-8000-000000000000",
      estado: "CONFIRMADA",
      canal: "TAQUILLA",
      cantidadCupos: 2,
      subtotal: "50000.00",
      descuentoPct: "30.00",
      total: "35000.00",
    },
    servicio: { nombre: "Cancha sintética fútbol 5", modalidad: "ALQUILER", fecha: "2026-10-19", horaInicio: "18:00:00", horaFin: "19:00:00" },
    titular: { nombre: "Ana María Pérez" },
    ticket: { id: "ffeeddcc-0000-4000-8000-000000000000", estado: "EMITIDO" },
    qr: { payload: PAYLOAD },
    ...over,
  };
}

/** PBM (P4) del bitmap para pasárselo a zbarimg. */
function pbm(t: Ticket): Buffer {
  const body = Buffer.alloc(t.height * ROW_BYTES);
  t.rows.forEach((r, i) => body.set(r, i * ROW_BYTES));
  return Buffer.concat([Buffer.from(`P4\n${DOTS} ${t.height}\n`), body]);
}

describe("construirTicketComprobante", () => {
  it("formatea pesos colombianos sin decimales", () => {
    assert.equal(pesos("35000.00"), "$35.000");
    assert.equal(pesos(1234567), "$1.234.567");
    assert.equal(pesos("0"), "$0");
  });

  it("codifica en el QR el payload firmado del servidor, legible por un lector", (t) => {
    const zbar = spawnSync("zbarimg", ["--version"]);
    if (zbar.error) return t.skip("zbarimg no está instalado");
    const dir = mkdtempSync(join(tmpdir(), "ticket-"));
    const file = join(dir, "ticket.pbm");
    writeFileSync(file, pbm(construirTicketComprobante(comprobante())));
    const out = spawnSync("zbarimg", ["--raw", "-q", file], { encoding: "utf8" });
    assert.equal(out.stdout.trim(), PAYLOAD);
  });

  it("sin QR emitido no dibuja código y deja el aviso de pase pendiente", () => {
    const conQr = construirTicketComprobante(comprobante());
    const sinQr = construirTicketComprobante(comprobante({ qr: null, ticket: null }));
    assert.ok(sinQr.height < conQr.height - 200);
  });

  it("solo muestra el descuento cuando lo hay", () => {
    const con = construirTicketComprobante(comprobante());
    const sin = construirTicketComprobante(
      comprobante({ reserva: { ...comprobante().reserva, descuentoPct: "0.00", total: "50000.00" } }),
    );
    assert.equal(con.height - sin.height, 30);
  });

  it("omite las líneas del membrete que no vienen configuradas", () => {
    const base = construirTicketComprobante(comprobante());
    const completo = construirTicketComprobante(
      comprobante({
        membrete: { ...comprobante().membrete, direccion: "Calle 1 # 2-3", telefono: "300 000 0000", correo: "hola@sc.co" },
      }),
    );
    assert.equal(completo.height - base.height, 90);
  });
});
