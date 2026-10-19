import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../test/mock-prisma.js";
import { getReceiptReserva } from "./receipts.js";

test("TSK-BE-31: el comprobante suma los importes de todas las franjas del ticket consolidado", async () => {
  const mock = createMockPrisma();
  const paymentId = "pago-multihora";
  const date = new Date("2026-10-25T00:00:00.000Z");
  mock._state.usuarios.push({ id: "cliente-1", nombre: "Cliente Uno", correo: "cliente@test.dev" });
  mock._state.servicios.push({
    id: 1,
    categoriaId: 1,
    nombre: "Cancha 1",
    capacidadMaxima: 10,
    tarifa: 45000,
    modalidad: "EXCLUSIVA",
    estado: "ACTIVO",
  });
  mock._state.franjas.push(
    { id: 1, servicioId: 1, diaSemana: 7, horaInicio: new Date("1970-01-01T14:00:00.000Z"), horaFin: new Date("1970-01-01T15:00:00.000Z") },
    { id: 2, servicioId: 1, diaSemana: 7, horaInicio: new Date("1970-01-01T15:00:00.000Z"), horaFin: new Date("1970-01-01T16:00:00.000Z") },
  );
  mock._state.disponibilidades.push(
    { id: 1n, servicioId: 1, franjaId: 1, fecha: date, cuposTotales: 10, cuposOcupados: 1, bloqueadaMantenimiento: false },
    { id: 2n, servicioId: 1, franjaId: 2, fecha: date, cuposTotales: 10, cuposOcupados: 1, bloqueadaMantenimiento: false },
  );
  mock._state.reservas.push(
    { id: "reserva-1", disponibilidadId: 1n, estado: "CONFIRMADA", titularId: "cliente-1", cantidadCupos: 1, canal: "ONLINE", subtotal: "45000.00", total: "45000.00", pagoId: paymentId, creadoEn: date },
    { id: "reserva-2", disponibilidadId: 2n, estado: "CONFIRMADA", titularId: "cliente-1", cantidadCupos: 1, canal: "ONLINE", subtotal: "45000.00", total: "45000.00", pagoId: paymentId, creadoEn: date },
  );
  mock._state.tickets.push({
    id: "ticket-1",
    reservaId: "reserva-1",
    codigoUuid: "9f0d6f4e-0000-4000-8000-000000000023",
    estado: "EMITIDO",
    inicioValidez: new Date("2026-10-25T19:00:00.000Z"),
    finValidez: new Date("2026-10-25T21:00:00.000Z"),
    emitidoEn: date,
    usadoPor: null,
    usadoEn: null,
  });

  const receipt = await getReceiptReserva("reserva-1", mock);

  assert.equal(receipt.subtotal, "90000.00");
  assert.equal(receipt.total, "90000.00");
  assert.equal("pagoId" in receipt, false);
});
