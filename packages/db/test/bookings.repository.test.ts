import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "./mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const {
  BookingError,
  createBookingHold,
  createBookingHoldCart,
  getBookableAvailability,
  getReadOnlyBookableAvailability,
} = await import(
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

test("TSK-BE-06: una petición manipulada con T + 16 días recibe 400 y el mensaje contractual", async () => {
  const now = new Date("2026-10-08T12:00:00.000Z"); // 08/Oct 07:00 Bogota.
  const date = "2026-10-25"; // T + 17 días calendario en Bogota: fuera de ventana.
  const start = new Date(`${date}T10:00:00-05:00`);
  const end = new Date(`${date}T11:00:00-05:00`);

  await assert.rejects(
    () => createBookingHold({ serviceId: 1, startTime: start.toISOString(), endTime: end.toISOString(), cantidadCupos: 1, userId: "u-1" }, now),
    (err: unknown) =>
      err instanceof BookingError &&
      err.status === 400 &&
      err.code === "OUTSIDE_BOOKING_WINDOW" &&
      err.message === "La reserva excede la ventana máxima permitida de 15 días",
  );

  await assert.rejects(
    () => getBookableAvailability(1, date, now),
    (err: unknown) =>
      err instanceof BookingError &&
      err.status === 400 &&
      err.message === "La reserva excede la ventana máxima permitida de 15 días",
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

test("SCRUM-163: createBookingHoldCart éxito con 2+ servicios distintos", async () => {
  const slot1 = addAforoSlot(10);
  const slot2 = addAforoSlot(15);
  const userId = "00000000-0000-4000-8000-00000000cart1";

  const res = await createBookingHoldCart({
    items: [
      {
        serviceId: slot1.serviceId,
        startTime: slot1.startsAt.toISOString(),
        endTime: slot1.endsAt.toISOString(),
        cantidadCupos: 2,
      },
      {
        serviceId: slot2.serviceId,
        startTime: slot2.startsAt.toISOString(),
        endTime: slot2.endsAt.toISOString(),
        cantidadCupos: 1,
      },
    ],
    userId,
  });

  assert.equal(res.bookings.length, 2);
  assert.equal(res.total, 7500); // 2500*2 + 2500*1
  assert.ok(res.expiresAt instanceof Date);

  // Ambas reservas tienen el mismo TTL
  assert.equal(res.bookings[0].expiraEn.getTime(), res.expiresAt.getTime());
  assert.equal(res.bookings[1].expiraEn.getTime(), res.expiresAt.getTime());

  // Cupos ocupados se incrementaron
  const disp1 = mock._state.disponibilidades.find((d: any) => d.id === slot1.availabilityId);
  const disp2 = mock._state.disponibilidades.find((d: any) => d.id === slot2.availabilityId);
  assert.equal(disp1.cuposOcupados, 2);
  assert.equal(disp2.cuposOcupados, 1);
});

test("SCRUM-163: fallo atómico en createBookingHoldCart si 1 ítem no tiene cupos → 0 holds creados", async () => {
  const slot1 = addAforoSlot(10);
  const slot2 = addAforoSlot(1);
  // Llenar slot2
  await createBookingHold(requestFor(slot2, 1, "00000000-0000-4000-8000-00000000fill"));

  const initialReservasCount = mock._state.reservas.length;
  const userId = "00000000-0000-4000-8000-00000000cart2";

  await assert.rejects(
    () =>
      createBookingHoldCart({
        items: [
          {
            serviceId: slot1.serviceId,
            startTime: slot1.startsAt.toISOString(),
            endTime: slot1.endsAt.toISOString(),
            cantidadCupos: 2,
          },
          {
            serviceId: slot2.serviceId,
            startTime: slot2.startsAt.toISOString(),
            endTime: slot2.endsAt.toISOString(),
            cantidadCupos: 1,
          },
        ],
        userId,
      }),
    (error: unknown) =>
      error instanceof BookingError && error.code === "CAPACITY_EXCEEDED",
  );

  // Atomicidad: cero holds adicionales y cupos de slot1 intactos (0 ocupados)
  assert.equal(mock._state.reservas.length, initialReservasCount);
  const disp1 = mock._state.disponibilidades.find((d: any) => d.id === slot1.availabilityId);
  assert.equal(disp1.cuposOcupados, 0);
});

test("SCRUM-163: solapamiento intra-carrito (mismo servicio franjas solapadas) rechaza con TITULAR_RESERVATION_OVERLAP o DUPLICATE_SERVICE_IN_CART", async () => {
  const slot1 = addAforoSlot(10);
  const userId = "00000000-0000-4000-8000-00000000cart3";

  await assert.rejects(
    () =>
      createBookingHoldCart({
        items: [
          {
            serviceId: slot1.serviceId,
            startTime: slot1.startsAt.toISOString(),
            endTime: slot1.endsAt.toISOString(),
            cantidadCupos: 1,
          },
          {
            serviceId: slot1.serviceId,
            startTime: slot1.startsAt.toISOString(),
            endTime: slot1.endsAt.toISOString(),
            cantidadCupos: 1,
          },
        ],
        userId,
      }),
    (error: unknown) =>
      error instanceof BookingError &&
      (error.code === "DUPLICATE_SERVICE_IN_CART" || error.code === "TITULAR_RESERVATION_OVERLAP"),
  );
});

test("SCRUM-163: solapamiento con reserva existente activa del titular aborta carrito", async () => {
  const slot1 = addAforoSlot(10);
  const slot2 = addAforoSlot(15);
  const userId = "00000000-0000-4000-8000-00000000cart4";

  // El usuario ya tiene una reserva activa en slot1
  await createBookingHold(requestFor(slot1, 1, userId));

  await assert.rejects(
    () =>
      createBookingHoldCart({
        items: [
          {
            serviceId: slot1.serviceId,
            startTime: slot1.startsAt.toISOString(),
            endTime: slot1.endsAt.toISOString(),
            cantidadCupos: 1,
          },
          {
            serviceId: slot2.serviceId,
            startTime: slot2.startsAt.toISOString(),
            endTime: slot2.endsAt.toISOString(),
            cantidadCupos: 1,
          },
        ],
        userId,
      }),
    (error: unknown) =>
      error instanceof BookingError && error.code === "TITULAR_RESERVATION_OVERLAP",
  );

  // Slot 2 no fue reservado
  const disp2 = mock._state.disponibilidades.find((d: any) => d.id === slot2.availabilityId);
  assert.equal(disp2.cuposOcupados, 0);
});

test("SCRUM-163: concurrencia: dos carritos compitiendo por mismos cupos limitados → uno gana, otro CAPACITY_EXCEEDED", async () => {
  const slotContended = addAforoSlot(2);
  const slotOther1 = addAforoSlot(10);
  const slotOther2 = addAforoSlot(10);

  const userA = "00000000-0000-4000-8000-00000000cartA";
  const userB = "00000000-0000-4000-8000-00000000cartB";

  const results = await Promise.allSettled([
    createBookingHoldCart({
      items: [
        {
          serviceId: slotContended.serviceId,
          startTime: slotContended.startsAt.toISOString(),
          endTime: slotContended.endsAt.toISOString(),
          cantidadCupos: 2,
        },
        {
          serviceId: slotOther1.serviceId,
          startTime: slotOther1.startsAt.toISOString(),
          endTime: slotOther1.endsAt.toISOString(),
          cantidadCupos: 1,
        },
      ],
      userId: userA,
    }),
    createBookingHoldCart({
      items: [
        {
          serviceId: slotContended.serviceId,
          startTime: slotContended.startsAt.toISOString(),
          endTime: slotContended.endsAt.toISOString(),
          cantidadCupos: 2,
        },
        {
          serviceId: slotOther2.serviceId,
          startTime: slotOther2.startsAt.toISOString(),
          endTime: slotOther2.endsAt.toISOString(),
          cantidadCupos: 1,
        },
      ],
      userId: userB,
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  const dispContended = mock._state.disponibilidades.find(
    (d: any) => d.id === slotContended.availabilityId,
  );
  assert.equal(dispContended.cuposOcupados, 2);
});

test("TSK-BE-23: read-only availability discounts only expired pending holds", async () => {
  const slot = addAforoSlot(10);
  const now = new Date();
  const availabilityRow = mock._state.disponibilidades.find(
    (availability: any) => availability.id === slot.availabilityId,
  );
  availabilityRow.cuposOcupados = 8;
  const beforeOccupancy = availabilityRow.cuposOcupados;

  mock._state.reservas.push(
    {
      id: "bot-expired-pending",
      disponibilidadId: slot.availabilityId,
      estado: "PENDIENTE_PAGO",
      cantidadCupos: 3,
      expiraEn: new Date(now.getTime() - 1),
    },
    {
      id: "bot-unexpired-pending",
      disponibilidadId: slot.availabilityId,
      estado: "PENDIENTE_PAGO",
      cantidadCupos: 2,
      expiraEn: new Date(now.getTime() + 60_000),
    },
    {
      id: "bot-confirmed",
      disponibilidadId: slot.availabilityId,
      estado: "CONFIRMADA",
      cantidadCupos: 3,
    },
    {
      id: "bot-expired-cancelled",
      disponibilidadId: slot.availabilityId,
      estado: "CANCELADA_ADMINISTRATIVA",
      cantidadCupos: 8,
      expiraEn: new Date(now.getTime() - 1),
    },
  );
  const beforeReservations = structuredClone(
    mock._state.reservas.filter((reservation: any) =>
      reservation.id.startsWith("bot-"),
    ),
  );

  const result = await getReadOnlyBookableAvailability(slot.serviceId, slot.date, now);

  assert.equal(result.length, 1);
  assert.equal(result[0].cuposOcupados, 5);
  assert.equal(result[0].cuposDisponibles, 5);
  assert.equal(result[0].franja.horaInicio, "10:00:00");
  assert.equal(result[0].franja.horaFin, "11:00:00");
  assert.equal(availabilityRow.cuposOcupados, beforeOccupancy);
  assert.deepEqual(
    mock._state.reservas.filter((reservation: any) =>
      reservation.id.startsWith("bot-"),
    ),
    beforeReservations,
  );
});

test("TSK-BE-23: read-only availability clamps over-discount and reports maintenance as unavailable", async () => {
  const now = new Date();
  const overDiscountedSlot = addAforoSlot(10);
  const blockedSlot = addAforoSlot(10);
  const overDiscountedAvailability = mock._state.disponibilidades.find(
    (availability: any) => availability.id === overDiscountedSlot.availabilityId,
  );
  const blockedAvailability = mock._state.disponibilidades.find(
    (availability: any) => availability.id === blockedSlot.availabilityId,
  );
  overDiscountedAvailability.cuposOcupados = 2;
  blockedAvailability.cuposOcupados = 4;
  blockedAvailability.bloqueadaMantenimiento = true;
  mock._state.reservas.push(
    {
      id: "bot-over-discount",
      disponibilidadId: overDiscountedSlot.availabilityId,
      estado: "PENDIENTE_PAGO",
      cantidadCupos: 8,
      expiraEn: new Date(now.getTime() - 1),
    },
    {
      id: "bot-blocked-expired",
      disponibilidadId: blockedSlot.availabilityId,
      estado: "PENDIENTE_PAGO",
      cantidadCupos: 1,
      expiraEn: new Date(now.getTime() - 1),
    },
  );

  const overDiscountedResult = await getReadOnlyBookableAvailability(
    overDiscountedSlot.serviceId,
    overDiscountedSlot.date,
    now,
  );
  const blockedResult = await getReadOnlyBookableAvailability(
    blockedSlot.serviceId,
    blockedSlot.date,
    now,
  );

  assert.equal(overDiscountedResult[0].cuposOcupados, 0);
  assert.equal(overDiscountedResult[0].cuposDisponibles, 10);
  assert.equal(blockedResult[0].cuposOcupados, 3);
  assert.equal(blockedResult[0].cuposDisponibles, 0);
});
