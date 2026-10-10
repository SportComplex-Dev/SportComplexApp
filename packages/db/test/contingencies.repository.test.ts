import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "./mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { disableServiceForContingency, ContingencyError } = await import(
  "../src/repositories/contingencies.ts"
);

test("TSK-BE-22: contingencia inhabilita el servicio y cancela reservas sin borrar ventas", async () => {
  const adminId = "00000000-0000-4000-8000-000000000031";
  const customerId = "00000000-0000-4000-8000-000000000032";
  const availabilityId = 1n;
  const startsAt = new Date(Date.UTC(1970, 0, 1, 10));
  const endsAt = new Date(Date.UTC(1970, 0, 1, 11));
  const serviceDate = new Date("2026-10-09T00:00:00.000Z");

  mock._state.usuarios.push(
    {
      id: adminId,
      estado: "ACTIVO",
      deletedAt: null,
      rol: { nombre: "ADMIN" },
    },
    {
      id: customerId,
      estado: "ACTIVO",
      deletedAt: null,
      rol: { nombre: "CLIENTE" },
    },
  );
  mock._state.servicios.push({
    id: 1,
    categoriaId: 1,
    nombre: "Piscina contingencia",
    capacidadMaxima: 30,
    tarifa: 100,
    modalidad: "AFORO",
    tipoPiscina: "PUBLICA",
    estado: "ACTIVO",
  });
  mock._state.franjas.push({
    id: 1,
    servicioId: 1,
    diaSemana: 5,
    horaInicio: startsAt,
    horaFin: endsAt,
  });
  mock._state.disponibilidades.push({
    id: availabilityId,
    servicioId: 1,
    franjaId: 1,
    fecha: serviceDate,
    cuposTotales: 30,
    cuposOcupados: 3,
    bloqueadaMantenimiento: false,
  });
  mock._state.reservas.push(
    {
      id: "00000000-0000-4000-8000-000000000041",
      disponibilidadId: availabilityId,
      titularId: customerId,
      cantidadCupos: 1,
      estado: "PENDIENTE_PAGO",
      creadoEn: new Date("2026-10-08T10:00:00Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000042",
      disponibilidadId: availabilityId,
      titularId: customerId,
      cantidadCupos: 2,
      estado: "CONFIRMADA",
      creadoEn: new Date("2026-10-08T11:00:00Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000043",
      disponibilidadId: availabilityId,
      titularId: customerId,
      cantidadCupos: 1,
      estado: "EXPIRADA",
      creadoEn: new Date("2026-10-08T12:00:00Z"),
    },
  );
  mock._state.pagos.push({ usuarioId: customerId });

  const result = await disableServiceForContingency({
    serviceId: 1,
    adminId,
    reason: "Daño en el sistema de filtrado",
  });

  assert.equal(mock._state.servicios[0].estado, "INHABILITADO");
  assert.equal(mock._state.reservas[0].estado, "CANCELADA_ADMINISTRATIVA");
  assert.equal(mock._state.reservas[1].estado, "CANCELADA_ADMINISTRATIVA");
  assert.equal(mock._state.reservas[2].estado, "EXPIRADA");
  assert.equal(mock._state.reservas[0].inhabilitacionId, 1);
  assert.equal(mock._state.disponibilidades[0].cuposOcupados, 0);
  assert.equal(mock._state.pagos.length, 1);
  assert.equal(result.webhookPayload.usuarios.length, 2);
  assert.equal(result.webhookPayload.motivo, "Daño en el sistema de filtrado");
  assert.equal(mock._state.inhabilitaciones.length, 1);
});

test("TSK-BE-22: no permite una segunda inhabilitación activa", async () => {
  const serviceId = mock._state.servicios[0].id;
  await assert.rejects(
    disableServiceForContingency({
      serviceId,
      adminId: "00000000-0000-4000-8000-000000000031",
      reason: "Servicio fuera de uso",
    }),
    (error: unknown) =>
      error instanceof ContingencyError && error.code === "ALREADY_INACTIVE",
  );
});
