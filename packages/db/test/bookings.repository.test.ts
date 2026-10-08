import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "./mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { BookingError, createBookingHold, getBookableAvailability } = await import(
  "../src/repositories/bookings.ts"
);

function tomorrowInBogota(now: Date): string {
  const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const tomorrow = new Date(
    Date.UTC(
      bogotaNow.getUTCFullYear(),
      bogotaNow.getUTCMonth(),
      bogotaNow.getUTCDate() + 1,
    ),
  );
  return tomorrow.toISOString().slice(0, 10);
}

function addAforoSlot(capacity: number) {
  const serviceId = mock._state.servicios.length + 1;
  const franjaId = mock._state.franjas.length + 1;
  const availabilityId = BigInt(mock._state.disponibilidades.length + 1);
  const date = tomorrowInBogota(new Date());
  const startsAt = new Date(`${date}T10:00:00-05:00`);
  const endsAt = new Date(`${date}T11:00:00-05:00`);

  mock._state.servicios.push({
    id: serviceId,
    categoriaId: 1,
    nombre: `Aforo ${capacity}`,
    capacidadMaxima: capacity,
    tarifa: 2500,
    modalidad: "AFORO",
    tipoPiscina: "PUBLICA",
    estado: "ACTIVO",
  });
  mock._state.franjas.push({
    id: franjaId,
    servicioId: serviceId,
    diaSemana: startsAt.getUTCDay() === 0 ? 7 : startsAt.getUTCDay(),
    horaInicio: new Date(Date.UTC(1970, 0, 1, 10)),
    horaFin: new Date(Date.UTC(1970, 0, 1, 11)),
  });
  mock._state.disponibilidades.push({
    id: availabilityId,
    servicioId: serviceId,
    franjaId,
    fecha: new Date(`${date}T00:00:00.000Z`),
    cuposTotales: capacity,
    cuposOcupados: 0,
    bloqueadaMantenimiento: false,
  });

  return {
    serviceId,
    availabilityId,
    date,
    startsAt,
    endsAt,
  };
}

function addPrivatePoolSlot(capacity: number) {
  const serviceId = mock._state.servicios.length + 1;
  const franjaId = mock._state.franjas.length + 1;
  const availabilityId = BigInt(mock._state.disponibilidades.length + 1);
  const date = tomorrowInBogota(new Date());
  const startsAt = new Date(`${date}T10:00:00-05:00`);
  const endsAt = new Date(`${date}T11:00:00-05:00`);

  mock._state.servicios.push({
    id: serviceId,
    categoriaId: 1,
    nombre: `Piscina privada ${capacity}`,
    capacidadMaxima: capacity,
    tarifa: 2500,
    modalidad: "EXCLUSIVA",
    tipoPiscina: "PRIVADA",
    estado: "ACTIVO",
  });
  mock._state.franjas.push({
    id: franjaId,
    servicioId: serviceId,
    diaSemana: startsAt.getUTCDay() === 0 ? 7 : startsAt.getUTCDay(),
    horaInicio: new Date(Date.UTC(1970, 0, 1, 10)),
    horaFin: new Date(Date.UTC(1970, 0, 1, 11)),
  });
  mock._state.disponibilidades.push({
    id: availabilityId,
    servicioId: serviceId,
    franjaId,
    fecha: new Date(`${date}T00:00:00.000Z`),
    cuposTotales: 1,
    cuposOcupados: 0,
    bloqueadaMantenimiento: false,
  });

  return { serviceId, availabilityId, date, startsAt, endsAt };
}

function requestFor(
  slot: ReturnType<typeof addAforoSlot>,
  cantidadCupos = 1,
  userId = "00000000-0000-4000-8000-000000000001",
) {
  return {
    serviceId: slot.serviceId,
    startTime: slot.startsAt.toISOString(),
    endTime: slot.endsAt.toISOString(),
    cantidadCupos,
    userId,
  };
}

test("TSK-BE-05: 40 solicitudes concurrentes nunca exceden aforo 25", async () => {
  const slot = addAforoSlot(25);
  // Titulares distintos: la prueba mide el aforo, no la regla de unicidad
  // de titular (TSK-BE-12), que impide al mismo usuario repetir la franja.
  const results = await Promise.allSettled(
    Array.from({ length: 40 }, (_, index) =>
      createBookingHold(
        requestFor(slot, 1, `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
      ),
    ),
  );

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 25);
  assert.equal(
    mock._state.disponibilidades.find((availability: any) => availability.id === slot.availabilityId)
      .cuposOcupados,
    25,
  );
  assert.equal(
    mock._state.reservas.filter(
      (reservation: any) =>
        reservation.disponibilidadId === slot.availabilityId &&
        reservation.estado === "PENDIENTE_PAGO",
    ).length,
    25,
  );
  for (const result of results) {
    if (result.status === "rejected") {
      assert.ok(result.reason instanceof BookingError);
      assert.equal(result.reason.code, "CAPACITY_EXCEEDED");
    }
  }
});

test("TSK-BE-05: el TTL expira y libera cupos antes de la siguiente reserva", async () => {
  const slot = addAforoSlot(1);
  const firstHold = await createBookingHold(requestFor(slot));
  const expiryTime = new Date(firstHold.expiraEn);
  const secondHold = await createBookingHold(requestFor(slot), expiryTime);

  assert.equal(
    mock._state.reservas.find((reservation: any) => reservation.id === firstHold.id).estado,
    "EXPIRADA",
  );
  assert.equal(secondHold.estado, "PENDIENTE_PAGO");
  assert.equal(
    mock._state.disponibilidades.find((availability: any) => availability.id === slot.availabilityId)
      .cuposOcupados,
    1,
  );
});

test("TSK-BE-05: la consulta de disponibilidad entrega el saldo de cupos", async () => {
  const slot = addAforoSlot(25);
  const hold = await createBookingHold(requestFor(slot, 4));
  const availability = await getBookableAvailability(slot.serviceId, slot.date);

  assert.equal(hold.cantidadCupos, 4);
  assert.equal(availability.length, 1);
  assert.equal(availability[0].cuposDisponibles, 21);
});

test("TSK-BE-08: piscina pública de aforo 30 conserva 28 cupos al reservar 2", async () => {
  const slot = addAforoSlot(30);
  await createBookingHold(requestFor(slot, 2));

  const availability = await getBookableAvailability(slot.serviceId, slot.date);
  assert.equal(availability[0].cuposTotales, 30);
  assert.equal(availability[0].cuposOcupados, 2);
  assert.equal(availability[0].cuposDisponibles, 28);
});

test("TSK-BE-12: Cancha 1 y Piscina en la misma franja se confirman sin error de solapamiento", async () => {
  const cancha = addAforoSlot(10);
  const piscina = addAforoSlot(20);
  const userId = "00000000-0000-4000-8000-00000000be12";

  const first = await createBookingHold(requestFor(cancha, 1, userId));
  const second = await createBookingHold(requestFor(piscina, 1, userId));

  assert.equal(first.estado, "PENDIENTE_PAGO");
  assert.equal(second.estado, "PENDIENTE_PAGO");
  assert.notEqual(first.disponibilidad.servicioId, second.disponibilidad.servicioId);
});

test("TSK-BE-12: el mismo titular no duplica una franja solapada del mismo servicio", async () => {
  const slot = addAforoSlot(10);
  const userId = "00000000-0000-4000-8000-00000000be13";

  await createBookingHold(requestFor(slot, 1, userId));

  await assert.rejects(
    createBookingHold(requestFor(slot, 1, userId)),
    (error: unknown) =>
      error instanceof BookingError && error.code === "TITULAR_RESERVATION_OVERLAP",
  );
});

test("TSK-BE-12: otro titular sí puede reservar la misma franja del mismo servicio", async () => {
  const slot = addAforoSlot(10);

  const first = await createBookingHold(
    requestFor(slot, 1, "00000000-0000-4000-8000-00000000be14"),
  );
  const second = await createBookingHold(
    requestFor(slot, 1, "00000000-0000-4000-8000-00000000be15"),
  );

  assert.equal(first.estado, "PENDIENTE_PAGO");
  assert.equal(second.estado, "PENDIENTE_PAGO");
});

test("TSK-BE-12: un hold vencido libera la unicidad de titular para su franja", async () => {
  const slot = addAforoSlot(10);
  const userId = "00000000-0000-4000-8000-00000000be16";

  const first = await createBookingHold(requestFor(slot, 1, userId));
  const reopened = await createBookingHold(
    requestFor(slot, 1, userId),
    new Date(first.expiraEn),
  );

  assert.equal(reopened.estado, "PENDIENTE_PAGO");
});

test("TSK-BE-08: piscina privada de aforo configurado 30 bloquea la franja completa", async () => {
  const slot = addPrivatePoolSlot(30);
  const availabilityBefore = await getBookableAvailability(slot.serviceId, slot.date);

  assert.equal(availabilityBefore[0].cuposTotales, 1);
  await createBookingHold(requestFor(slot));

  const availabilityAfter = await getBookableAvailability(slot.serviceId, slot.date);
  assert.equal(availabilityAfter[0].cuposDisponibles, 0);
  await assert.rejects(
    createBookingHold(requestFor(slot)),
    (error: unknown) =>
      error instanceof BookingError && error.code === "CAPACITY_EXCEEDED",
  );
});
