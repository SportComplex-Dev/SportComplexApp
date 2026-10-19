import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esperarPagoTaquilla, PagoNoCompletadoError } from "./esperarPago";

const pendiente = { ok: true, json: async () => ({ success: true, data: { reserva: { estado: "PENDIENTE_PAGO" }, qr: null } }) };
const pagada = { ok: true, json: async () => ({ success: true, data: { reserva: { estado: "CONFIRMADA" }, qr: { payload: "SC1:x:y" } } }) };

describe("esperarPagoTaquilla", () => {
  it("consulta el comprobante de taquilla hasta que el webhook emite el pase", async () => {
    const urls: string[] = [];
    const respuestas = [pendiente, { ok: false, json: async () => { throw new Error("red"); } }, pagada];
    const c = await esperarPagoTaquilla("r 1", {
      intervaloMs: 0,
      fetchImpl: async (url) => {
        urls.push(url);
        return respuestas.shift()!;
      },
    });
    assert.equal(c.qr?.payload, "SC1:x:y");
    assert.equal(urls.length, 3);
    assert.equal(urls[0], "/api/pdf/receipt?reservaId=r%201&destinatario=POS");
  });

  it("si la reserva expira, deja de esperar con un mensaje para el operador", async () => {
    await assert.rejects(
      esperarPagoTaquilla("r1", {
        intervaloMs: 0,
        fetchImpl: async () => ({ ok: true, json: async () => ({ data: { reserva: { estado: "EXPIRADA" }, qr: null } }) }),
      }),
      (e: unknown) => e instanceof PagoNoCompletadoError && /expiró/.test(e.message),
    );
  });

  it("si se agota la espera, avisa que se imprima luego desde reimpresión", async () => {
    await assert.rejects(
      esperarPagoTaquilla("r1", { intervaloMs: 0, maxIntentos: 2, fetchImpl: async () => pendiente }),
      (e: unknown) => e instanceof PagoNoCompletadoError && e.estado === "SIN_CONFIRMACION",
    );
  });

  it("se cancela cuando el operador cierra el cobro", async () => {
    const ctrl = new AbortController();
    const espera = esperarPagoTaquilla("r1", { intervaloMs: 10_000, signal: ctrl.signal, fetchImpl: async () => pendiente });
    setTimeout(() => ctrl.abort(new Error("cancelado")), 5);
    await assert.rejects(espera, { message: "cancelado" });
  });
});
