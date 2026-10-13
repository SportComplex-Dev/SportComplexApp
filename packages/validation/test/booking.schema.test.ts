import test from "node:test";
import assert from "node:assert/strict";
import { availabilityQuerySchema, bookingRequestSchema, posCheckoutSchema } from "../src/booking.schema.ts";

test("bookingRequestSchema accepts integer service IDs and defaults to one seat", () => {
  const parsed = bookingRequestSchema.safeParse({
    serviceId: "12",
    startTime: "2026-10-08T15:00:00.000Z",
    endTime: "2026-10-08T16:00:00.000Z",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.serviceId, 12);
    assert.equal(parsed.data.cantidadCupos, 1);
  }
});

test("bookingRequestSchema rejects invalid IDs, cupos, and timestamps", () => {
  for (const payload of [
    { serviceId: "bad", startTime: "2026-10-08T15:00:00Z", endTime: "2026-10-08T16:00:00Z" },
    { serviceId: 1, startTime: "2026-10-08", endTime: "2026-10-08T16:00:00Z" },
    {
      serviceId: 1,
      startTime: "2026-10-08T15:00:00Z",
      endTime: "2026-10-08T16:00:00Z",
      cantidadCupos: 0,
    },
  ]) {
    assert.equal(bookingRequestSchema.safeParse(payload).success, false);
  }
});

test("availabilityQuerySchema validates service and calendar date", () => {
  assert.equal(
    availabilityQuerySchema.safeParse({ serviceId: "12", date: "2026-10-08" }).success,
    true,
  );
  assert.equal(
    availabilityQuerySchema.safeParse({ serviceId: "0", date: "2026-02-30" }).success,
    false,
  );
});

test("posCheckoutSchema (TSK-FE-18 / RF-17): acepta cobro cashless con tarjeta y enlace alternativo", () => {
  const cardPayload = {
    serviceId: 1,
    date: "2026-10-15",
    slotTime: "10:00 a. m. - 11:00 a. m.",
    cantidadCupos: 2,
    clienteNombre: "Carlos Santana",
    clienteDocumento: "1020304050",
    clienteEmail: "carlos@example.com",
    clienteTelefono: "3001234567",
    esSocio: true,
    paymentMode: "stripe_card",
    cardLast4: "4242",
  };
  const parsedCard = posCheckoutSchema.safeParse(cardPayload);
  assert.equal(parsedCard.success, true);
  if (parsedCard.success) {
    assert.equal(parsedCard.data.paymentMode, "stripe_card");
    assert.equal(parsedCard.data.esSocio, true);
  }

  const linkPayload = {
    ...cardPayload,
    paymentMode: "stripe_link",
  };
  const parsedLink = posCheckoutSchema.safeParse(linkPayload);
  assert.equal(parsedLink.success, true);
});

test("posCheckoutSchema (RF-17 / RN-13): rechaza terminantemente pagos en efectivo (cero efectivo)", () => {
  const cashPayload = {
    serviceId: 1,
    date: "2026-10-15",
    slotTime: "10:00 a. m.",
    cantidadCupos: 1,
    clienteNombre: "Carlos Santana",
    clienteDocumento: "1020304050",
    clienteEmail: "carlos@example.com",
    paymentMode: "cash", // Prohibido
  };
  const parsed = posCheckoutSchema.safeParse(cashPayload);
  assert.equal(parsed.success, false);
});

test("posCheckoutSchema: rechaza cliente sin nombre o con email inválido", () => {
  assert.equal(
    posCheckoutSchema.safeParse({
      serviceId: 1,
      date: "2026-10-15",
      slotTime: "10:00 a. m.",
      clienteNombre: "A",
      clienteDocumento: "123",
      clienteEmail: "invalido",
    }).success,
    false,
  );
});
