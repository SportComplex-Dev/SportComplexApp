/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { PaymentError, procesarPagoWebhook } from "./payments.js";
import { createMockPrisma } from "../../test/mock-prisma";

function seedReserva(mock: any, overrides: Record<string, unknown> = {}) {
  const reserva = {
    id: "reserva-1",
    disponibilidadId: 1n,
    estado: "PENDIENTE_PAGO",
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
    ...overrides,
  };
  mock._state.reservas.push(reserva);
  return reserva;
}

function seedDisponibilidad(mock: any, overrides: Record<string, unknown> = {}) {
  const disponibilidad = {
    id: 1n,
    servicioId: 1,
    franjaId: 1,
    fecha: new Date(),
    cuposTotales: 5,
    cuposOcupados: 2,
    bloqueadaMantenimiento: false,
    ...overrides,
  };
  mock._state.disponibilidades.push(disponibilidad);
  return disponibilidad;
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    stripePaymentIntentId: "pi_tsk_bd_09_1",
    usuarioId: "user-1",
    monto: 75000,
    estado: "APROBADO",
    tipo: "RESERVA",
    reservaId: "reserva-1",
    ...overrides,
  } as Parameters<typeof procesarPagoWebhook>[0];
}

test("TSK-BD-09: reenviar el mismo webhook dos veces → 1 fila en PAGO y 1 reserva CONFIRMADA", async () => {
  const mock = createMockPrisma();
  seedReserva(mock);

  const primera = await procesarPagoWebhook(baseInput(), { db: mock });
  assert.equal(primera.pagoCreado, true);
  assert.equal(primera.duplicado, false);
  assert.equal(primera.reservaConfirmada, true);

  // Reintento de Stripe: mismo evento, misma carga útil.
  const segunda = await procesarPagoWebhook(baseInput(), { db: mock });
  assert.equal(segunda.pagoCreado, false);
  assert.equal(segunda.duplicado, true);
  assert.equal(segunda.reservaConfirmada, false);
  assert.equal(segunda.pagoId, primera.pagoId);

  // CRITERIO DE ACEPTACIÓN: una sola fila y una sola reserva confirmada.
  assert.equal(mock._state.pagos.length, 1);
  const confirmadas = mock._state.reservas.filter((r: any) => r.estado === "CONFIRMADA");
  assert.equal(confirmadas.length, 1);
  assert.equal(confirmadas[0].pagoId, primera.pagoId);
  assert.equal(mock._state.pagos[0].estado, "APROBADO");
  assert.equal(mock._state.pagos[0].monto, "75000.00");
});

test("TSK-BD-09: carrera por el UNIQUE (P2002) reintenta la transacción sin duplicar", async () => {
  const mock = createMockPrisma();
  seedReserva(mock);

  // Simula el webhook ganador concurrente: la fila ya existe, pero la primera
  // lectura no la ve (detalle de carrera) → el create choca con el UNIQUE.
  mock._state.pagos.push({
    id: "payment-raced",
    usuarioId: "user-1",
    membresiaId: null,
    tipo: "RESERVA",
    stripePaymentIntentId: "pi_tsk_bd_09_1",
    monto: "75000.00",
    estado: "PENDIENTE",
  });
  const original = mock.pago.findUnique.bind(mock.pago);
  let glitched = false;
  mock.pago.findUnique = async (args: any) => {
    if (!glitched) {
      glitched = true;
      return null;
    }
    return original(args);
  };

  const res = await procesarPagoWebhook(baseInput(), { db: mock });
  assert.equal(glitched, true);
  assert.equal(res.duplicado, true);
  assert.equal(res.pagoCreado, false);
  assert.equal(res.estado, "APROBADO"); // la fila perdedora se actualiza, no se duplica
  assert.equal(res.reservaConfirmada, true);
  assert.equal(mock._state.pagos.length, 1);
  assert.equal(mock._state.reservas[0].estado, "CONFIRMADA");
});

test("TSK-BE-10: pago APROBADO emite el TICKET_QR (EMITIDO) una sola vez", async () => {
  const mock = createMockPrisma();
  seedReserva(mock);

  const primera = await procesarPagoWebhook(baseInput(), { db: mock });
  assert.equal(primera.reservaConfirmada, true);
  assert.equal(primera.ticketQrEmitido, true);
  assert.equal(mock._state.tickets.length, 1);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.tickets[0].reservaId, "reserva-1");
  assert.ok(mock._state.tickets[0].codigoUuid);

  // Reenvío de Stripe: el boleto no se duplica (UNIQUE reserva_id).
  const segunda = await procesarPagoWebhook(baseInput(), { db: mock });
  assert.equal(segunda.ticketQrEmitido, false);
  assert.equal(mock._state.tickets.length, 1);
});

test("TSK-BE-10: pago FALLIDO cancela la reserva y restituye la franja (idempotente)", async () => {
  const mock = createMockPrisma();
  seedReserva(mock);
  seedDisponibilidad(mock, { cuposTotales: 5, cuposOcupados: 2 });

  const fallido = await procesarPagoWebhook(baseInput({ estado: "FALLIDO" }), { db: mock });
  assert.equal(fallido.estado, "FALLIDO");
  assert.equal(fallido.reservaConfirmada, false);
  assert.equal(fallido.reservaEstado, "CANCELADA_PAGO");
  assert.equal(fallido.franjaRestituida, true);
  assert.equal(mock._state.reservas[0].estado, "CANCELADA_PAGO");
  assert.equal(mock._state.disponibilidades[0].cuposOcupados, 1);

  // Reenvío de Stripe: no vuelve a liberar cupos (guard PENDIENTE_PAGO).
  const reintento = await procesarPagoWebhook(baseInput({ estado: "FALLIDO" }), { db: mock });
  assert.equal(reintento.franjaRestituida, false);
  assert.equal(mock._state.disponibilidades[0].cuposOcupados, 1);
  assert.equal(mock._state.pagos.length, 1);
});

test("TSK-BD-09: un evento FALLIDO tardío nunca degrada un pago APROBADO", async () => {
  const mock = createMockPrisma();
  seedReserva(mock);

  await procesarPagoWebhook(baseInput({ estado: "APROBADO" }), { db: mock });
  const tardio = await procesarPagoWebhook(baseInput({ estado: "FALLIDO" }), { db: mock });

  assert.equal(tardio.estado, "APROBADO");
  assert.equal(mock._state.pagos[0].estado, "APROBADO");
  assert.equal(mock._state.reservas[0].estado, "CONFIRMADA");
});

test("TSK-BD-09: reserva ya expirada no se confirma (cupo liberado por TSK-BD-08) pero el pago queda registrado", async () => {
  const mock = createMockPrisma();
  seedReserva(mock, { estado: "EXPIRADA", expiraEn: new Date(Date.now() - 1000) });

  const res = await procesarPagoWebhook(baseInput(), { db: mock });
  assert.equal(res.pagoCreado, true);
  assert.equal(res.reservaConfirmada, false);
  assert.equal(res.reservaEstado, "EXPIRADA");
  assert.equal(mock._state.pagos.length, 1);
  assert.equal(mock._state.reservas[0].estado, "EXPIRADA");
});

test("TSK-BD-09: activación de membresía es idempotente (correr dos veces no re-activa)", async () => {
  const mock = createMockPrisma();
  mock._state.membresias.push({
    id: 7,
    usuarioId: "user-1",
    estado: "VENCIDA",
  });

  const input = {
    stripePaymentIntentId: "pi_membresia_1",
    usuarioId: "user-1",
    monto: 85000,
    estado: "APROBADO",
    tipo: "MEMBRESIA",
    membresiaId: 7,
  } as Parameters<typeof procesarPagoWebhook>[0];

  const primera = await procesarPagoWebhook(input, { db: mock });
  assert.equal(primera.membresiaActivada, true);
  assert.equal(mock._state.membresias[0].estado, "VIGENTE");

  const segunda = await procesarPagoWebhook(input, { db: mock });
  assert.equal(segunda.membresiaActivada, false);
  assert.equal(segunda.duplicado, true);
  assert.equal(mock._state.membresias[0].estado, "VIGENTE");
  assert.equal(mock._state.pagos.length, 1);
});

test("TSK-BD-09: valida entrada obligatoria (PaymentError 400)", async () => {
  const mock = createMockPrisma();

  await assert.rejects(
    () => procesarPagoWebhook(baseInput({ stripePaymentIntentId: "" }), { db: mock }),
    (err: unknown) =>
      err instanceof PaymentError && err.code === "VALIDATION_ERROR" && err.status === 400,
  );
  await assert.rejects(
    () => procesarPagoWebhook(baseInput({ monto: -1 }), { db: mock }),
    (err: unknown) => err instanceof PaymentError && err.code === "VALIDATION_ERROR",
  );
  assert.equal(mock._state.pagos.length, 0);
});
