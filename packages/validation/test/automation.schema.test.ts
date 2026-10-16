import test from "node:test";
import assert from "node:assert/strict";
import {
  FestivosBatchSchema,
  ReservationQrEmailSchema,
  ReservationQrEmailResponseSchema,
} from "../src/business/automation.schema.ts";

test("festivos: acepta lote válido", () => {
  assert.equal(
    FestivosBatchSchema.safeParse({
      festivos: [{ fecha: "2026-01-01", nombre: "Año Nuevo", anio: 2026 }],
    }).success,
    true,
  );
});

test("festivos: rechaza fecha con formato inválido", () => {
  assert.equal(
    FestivosBatchSchema.safeParse({
      festivos: [{ fecha: "01/01/2026", nombre: "X", anio: 2026 }],
    }).success,
    false,
  );
});

test("festivos: rechaza lote vacío y nombre largo", () => {
  assert.equal(FestivosBatchSchema.safeParse({ festivos: [] }).success, false);
  assert.equal(
    FestivosBatchSchema.safeParse({
      festivos: [{ fecha: "2026-01-01", nombre: "x".repeat(101), anio: 2026 }],
    }).success,
    false,
  );
});

test("TSK-BE-34: ReservationQrEmailSchema valida payload de despacho con QR", () => {
  const validPayload = {
    reservaId: "res-1234",
    ticketId: "uuid-ticket-1234",
    correo: "cliente@ejemplo.com",
    nombre: "Carlos Gómez",
    cancha: "Cancha de Tenis 1",
    sede: "AKROS Club",
    fecha: "2026-10-20",
    franjaHoraria: "14:00 - 15:00",
    qrPayload: "SC1:uuid-ticket-1234:signature-hmac",
    qrImageUrl: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=test",
    appUrl: "https://akros.lat",
    usuario: {
      nombre: "Carlos Gómez",
      email: "cliente@ejemplo.com",
    },
    detalle: {
      servicioNombre: "Cancha de Tenis 1",
      fecha: "2026-10-20",
      horario: "14:00 - 15:00",
      precioTotal: "$60.000 COP",
      portalUrl: "https://akros.lat/portal/reservas/res-1234",
    },
  };

  const parsed = ReservationQrEmailSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);

  // Faltan campos obligatorios
  assert.equal(ReservationQrEmailSchema.safeParse({}).success, false);

  // Formato inválido de fecha
  assert.equal(
    ReservationQrEmailSchema.safeParse({
      ...validPayload,
      fecha: "20-10-2026",
    }).success,
    false,
  );
});

test("TSK-BE-34: ReservationQrEmailResponseSchema valida respuesta de n8n", () => {
  const responsePayload = {
    ok: true,
    mensaje: "Pase con QR despachado exitosamente",
    resendMessageId: "msg_12345",
    entregadoA: "cliente@ejemplo.com",
    ticketId: "uuid-ticket-1234",
    despachadoAt: "2026-10-16T14:00:00.000Z",
  };

  assert.equal(ReservationQrEmailResponseSchema.safeParse(responsePayload).success, true);
  assert.equal(ReservationQrEmailResponseSchema.safeParse({ ok: false, mensaje: "error" }).success, true);
});
