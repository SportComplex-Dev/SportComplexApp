import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "./mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

// Importar el repositorio después de inyectar el mock en __scPrisma
const {
  createCategoria,
  getCategorias,
  createServicio,
  getServicios,
  getServicioById,
  updateServicio,
  deleteServicio,
  generateDisponibilidadesForServicio,
} = await import("../src/repositories/services.ts");

test("CRUD de Categoría: creación y rechazo de nombres duplicados", async () => {
  const cat = await createCategoria({
    nombre: "Canchas de Fútbol",
    tipo: "CANCHA",
  });
  assert.equal(cat.id, 1);
  assert.equal(cat.nombre, "Canchas de Fútbol");

  // Duplicado debe arrojar DuplicateError
  await assert.rejects(
    async () => {
      await createCategoria({
        nombre: "Canchas de Fútbol",
        tipo: "CANCHA",
      });
    },
    (err: any) => err.name === "DuplicateError",
  );

  const categorias = await getCategorias();
  assert.equal(categorias.length, 1);
});

test("TSK-BE-04 / RF-03: Coexistencia y validación de unicidad de nombre de instancia por complejo", async () => {
  // 1. Alta de instancia "Cancha 1" con franja horaria (calendario propio)
  const cancha1 = await createServicio({
    nombre: "Cancha 1",
    categoriaId: 1,
    capacidadMaxima: 10,
    tarifa: 50000,
    modalidad: "EXCLUSIVA",
    franjasHorarias: [
      { diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" },
    ],
  });
  assert.equal(cancha1.nombre, "Cancha 1");
  assert.equal(cancha1.franjasHorarias?.length, 1);

  // 2. Validación de unicidad: Intentar crear otra "Cancha 1" en el complejo debe ser rechazado
  await assert.rejects(
    async () => {
      await createServicio({
        nombre: "Cancha 1",
        categoriaId: 1,
        capacidadMaxima: 12,
        tarifa: 60000,
        modalidad: "EXCLUSIVA",
      });
    },
    (err: any) => err.name === "DuplicateNameError",
  );

  // 3. Alta de instancia "Cancha 2" con su propio horario
  const cancha2 = await createServicio({
    nombre: "Cancha 2",
    categoriaId: 1,
    capacidadMaxima: 10,
    tarifa: 50000,
    modalidad: "EXCLUSIVA",
    franjasHorarias: [
      { diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" },
    ],
  });
  assert.equal(cancha2.nombre, "Cancha 2");

  // 4. Criterio de Aceptación Clave: "Cancha 1" y "Cancha 2" coexisten en el sistema
  const servicios = await getServicios();
  const nombres = servicios.map((s: any) => s.nombre);
  assert.ok(nombres.includes("Cancha 1"), "Cancha 1 debe existir");
  assert.ok(nombres.includes("Cancha 2"), "Cancha 2 debe existir");
});

test("TSK-BE-05: las disponibilidades AFORO respetan la capacidad y los cambios seguros", async () => {
  await assert.rejects(
    () =>
      createServicio({
        nombre: "Servicio con capacidad inválida",
        categoriaId: 1,
        capacidadMaxima: 0,
        tarifa: 100,
        modalidad: "AFORO",
      }),
    (error: any) => error.name === "ValidationError",
  );

  const servicio = await createServicio({
    nombre: "Piscina aforo 25",
    categoriaId: 1,
    capacidadMaxima: 25,
    tarifa: 100,
    modalidad: "AFORO",
    franjasHorarias: [{ diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" }],
  });
  const disponibilidades = mock._state.disponibilidades.filter(
    (disponibilidad: any) => disponibilidad.servicioId === servicio.id,
  );
  assert.ok(disponibilidades.length > 0);
  assert.ok(disponibilidades.every((d: any) => d.cuposTotales === 25));

  disponibilidades[0].cuposOcupados = 20;
  await assert.rejects(
    () => updateServicio(servicio.id, { capacidadMaxima: 18 }),
    (error: any) => error.name === "CapacityConflictError",
  );
  assert.equal(mock._state.servicios.find((s: any) => s.id === servicio.id).capacidadMaxima, 25);
  assert.ok(disponibilidades.every((d: any) => d.cuposTotales === 25));

  disponibilidades[0].cuposOcupados = 0;
  const updated = await updateServicio(servicio.id, { capacidadMaxima: 18 });
  assert.equal(updated?.capacidadMaxima, 18);
  assert.ok(disponibilidades.every((d: any) => d.cuposTotales === 18));

  await generateDisponibilidadesForServicio(servicio.id);
  assert.ok(disponibilidades.every((d: any) => d.cuposTotales === 18));
});

test("TSK-BE-08: crea piscinas con cupos derivados de tipo y modalidad", async () => {
  const publicPool = await createServicio({
    nombre: "Piscina pública con aforo 30",
    categoriaId: 1,
    capacidadMaxima: 30,
    tarifa: 100,
    modalidad: "AFORO",
    tipoPiscina: "PUBLICA",
    franjasHorarias: [{ diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" }],
  });
  const publicSlots = mock._state.disponibilidades.filter(
    (availability: any) => availability.servicioId === publicPool.id,
  );
  assert.ok(publicSlots.length > 0);
  assert.ok(publicSlots.every((availability: any) => availability.cuposTotales === 30));

  const privatePool = await createServicio({
    nombre: "Piscina privada con aforo configurado 30",
    categoriaId: 1,
    capacidadMaxima: 30,
    tarifa: 100,
    modalidad: "EXCLUSIVA",
    tipoPiscina: "PRIVADA",
    franjasHorarias: [{ diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" }],
  });
  const privateSlots = mock._state.disponibilidades.filter(
    (availability: any) => availability.servicioId === privatePool.id,
  );
  assert.ok(privateSlots.length > 0);
  assert.ok(privateSlots.every((availability: any) => availability.cuposTotales === 1));

  await updateServicio(privatePool.id, { tipoPiscina: "PUBLICA" });
  assert.ok(privateSlots.every((availability: any) => availability.cuposTotales === 30));
});

test("Criterio Clave: Reservar en Cancha 1 no altera la disponibilidad de Cancha 2", async () => {
  // Localizar disponibilidades de ambas instancias
  const s1 = await getServicioById(1);
  const s2 = await getServicioById(2);

  assert.ok(s1?.disponibilidades && s1.disponibilidades.length > 0);
  assert.ok(s2?.disponibilidades && s2.disponibilidades.length > 0);

  const dispCancha1 = s1.disponibilidades[0];
  const dispCancha2 = s2.disponibilidades[0];

  // Estado inicial: cupos disponibles sin reservas
  assert.equal(dispCancha1.cuposOcupados, 0);
  assert.equal(dispCancha2.cuposOcupados, 0);

  // Simular reserva efectiva sobre Cancha 1: cuposOcupados aumenta a 1
  dispCancha1.cuposOcupados = 1;
  mock._state.reservas.push({
    id: "res-uuid-1",
    disponibilidadId: dispCancha1.id,
    estado: "CONFIRMADA",
  });

  // Verificar que la disponibilidad de Cancha 2 permanece intacta
  assert.equal(
    dispCancha2.cuposOcupados,
    0,
    "La disponibilidad de Cancha 2 debe permanecer en 0 cupos ocupados tras reservar Cancha 1",
  );
  assert.equal(dispCancha1.cuposOcupados, 1);
});

test("Actualización de servicio: tarifa y nombre", async () => {
  const updated = await updateServicio(2, {
    tarifa: 55000,
    capacidadMaxima: 12,
  });
  assert.equal(updated.tarifa, 55000);
  assert.equal(updated.capacidadMaxima, 12);
});

test("Constraints: Protección de reservas existentes contra borrado accidental", async () => {
  // Intentar eliminar Cancha 1 (que tiene reserva confirmada) debe fallar para no romper reservas existentes
  await assert.rejects(
    async () => {
      await deleteServicio(1, false);
    },
    (err: any) => err.name === "ServiceHasReservationsError",
  );

  // Con forceInactivate=true, se preserva la reserva e inhabilita el servicio
  const inhabilitado = await deleteServicio(1, true);
  assert.equal(inhabilitado.estado, "INHABILITADO");

  // Cancha 2 (sin reservas) se puede eliminar limpiamente
  const deletedCancha2 = await deleteServicio(2, false);
  assert.equal(deletedCancha2.nombre, "Cancha 2");
});

test("Atomicidad: Si falla la generación de disponibilidades, el servicio y franjas se revierten (rollback)", async () => {
  // Guardar cantidad inicial de servicios y franjas
  const servsBefore = (await getServicios()).length;
  const franjasBefore = mock._state.franjas.length;

  // Provocar fallo en disponibilidad.upsert
  const origUpsert = mock.disponibilidad.upsert;
  mock.disponibilidad.upsert = async () => {
    throw new Error("Simulated database failure during disponibilidad generation");
  };

  try {
    await assert.rejects(
      async () => {
        await createServicio({
          nombre: "Cancha Fallida Rollback",
          categoriaId: 1,
          capacidadMaxima: 10,
          tarifa: 50000,
          modalidad: "EXCLUSIVA",
          franjasHorarias: [
            { diaSemana: 1, horaInicio: "10:00", horaFin: "11:00" },
          ],
        });
      },
      (err: any) => err.message.includes("Simulated database failure"),
    );

    // Verificar que NO quedó servicio ni franjas huérfanas
    const servsAfter = (await getServicios()).length;
    const franjasAfter = mock._state.franjas.length;
    assert.equal(servsAfter, servsBefore, "No deben quedar servicios huérfanos tras rollback");
    assert.equal(franjasAfter, franjasBefore, "No deben quedar franjas huérfanas tras rollback");
  } finally {
    mock.disponibilidad.upsert = origUpsert;
  }
});
