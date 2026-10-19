import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buscarComprobanteParaReimpresion } from "./ticketReprint";

function respuesta(status: number, body: unknown) {
  return { ok: status < 400, json: async () => body };
}

describe("buscarComprobanteParaReimpresion", () => {
  it("resuelve la reserva desde el QR y pide el comprobante de taquilla (POS)", async () => {
    const llamadas: string[] = [];
    const comprobante = await buscarComprobanteParaReimpresion(" SC1:abc:def ", async (url) => {
      llamadas.push(url);
      return url.startsWith("/api/pos/tickets/lookup")
        ? respuesta(200, { success: true, data: { reservaId: "r-1" } })
        : respuesta(200, { success: true, data: { reserva: { id: "r-1" } } });
    });
    assert.deepEqual(llamadas, [
      "/api/pos/tickets/lookup?codigo=SC1%3Aabc%3Adef",
      "/api/pdf/receipt?reservaId=r-1&destinatario=POS",
    ]);
    assert.equal(comprobante.reserva.id, "r-1");
  });

  it("propaga el mensaje del servidor cuando no hay reserva", async () => {
    await assert.rejects(
      buscarComprobanteParaReimpresion("x", async () =>
        respuesta(404, { success: false, error: { message: "No hay ninguna reserva con ese código." } }),
      ),
      { message: "No hay ninguna reserva con ese código." },
    );
  });
});
