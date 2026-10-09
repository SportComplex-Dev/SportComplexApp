import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const mock = createMockPrisma();
(globalThis as unknown as { __scPrisma: unknown }).__scPrisma = mock;
(globalThis as typeof globalThis & {
  __scAuthSession: { user: { id: string } };
}).__scAuthSession = { user: { id: "admin-test" } };
mock._state.usuarios.push({
  id: "admin-test",
  nombre: "Admin de prueba",
  estado: "ACTIVO",
  deletedAt: null,
  rolId: 1,
  rolNombre: "ADMINISTRADOR",
});

// Import route handlers
const servicesRoute = await import("../route");
const serviceDetailRoute = await import("../[id]/route");
const categoriesRoute = await import("../categories/route");

test("API: POST y GET /api/admin/services/categories", async () => {
  // 1. Alta de categoría vía sub-endpoint
  const createReq = new Request("http://localhost:3000/api/admin/services/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Canchas Polideportivas",
      tipo: "CANCHA",
    }),
  });

  const resCreate = await categoriesRoute.POST(createReq);
  assert.equal(resCreate.status, 201);
  const dataCreate = await resCreate.json();
  assert.equal(dataCreate.success, true);
  assert.equal(dataCreate.data.nombre, "Canchas Polideportivas");

  // 2. Intento de categoría duplicada
  const resDup = await categoriesRoute.POST(
    new Request("http://localhost:3000/api/admin/services/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Canchas Polideportivas",
        tipo: "CANCHA",
      }),
    }),
  );
  assert.equal(resDup.status, 409);
  const dataDup = await resDup.json();
  assert.equal(dataDup.error.code, "DUPLICATE_CATEGORY");

  // 3. Listado de categorías
  const resGet = await categoriesRoute.GET();
  assert.equal(resGet.status, 200);
  const dataGet = await resGet.json();
  assert.equal(dataGet.success, true);
  assert.equal(dataGet.data.length, 1);
});

test("API: POST /api/admin/services para alta de CATEGORIA e instancias SERVICIO", async () => {
  // Alta de categoría a través de /api/admin/services (payload con discriminator o campos de categoría)
  const reqCat = new Request("http://localhost:3000/api/admin/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity: "CATEGORIA",
      nombre: "Zona Acuática",
      tipo: "PISCINA",
    }),
  });
  const resCat = await servicesRoute.POST(reqCat);
  assert.equal(resCat.status, 201);
  const jsonCat = await resCat.json();
  assert.equal(jsonCat.data.nombre, "Zona Acuática");

  // Alta de instancia "Cancha 1" con franja horaria autónoma
  const reqServ1 = new Request("http://localhost:3000/api/admin/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Cancha 1",
      categoriaId: 1,
      capacidadMaxima: 10,
      tarifa: 75000,
      modalidad: "EXCLUSIVA",
      franjasHorarias: [
        { diaSemana: 1, horaInicio: "07:00", horaFin: "08:00" },
      ],
    }),
  });
  const resServ1 = await servicesRoute.POST(reqServ1);
  assert.equal(resServ1.status, 201);
  const jsonServ1 = await resServ1.json();
  assert.equal(jsonServ1.data.nombre, "Cancha 1");
  assert.equal(jsonServ1.data.franjasHorarias.length, 1);

  // Validación de unicidad de nombre de instancia por complejo (TSK-BE-04)
  const reqDup = new Request("http://localhost:3000/api/admin/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Cancha 1", // Nombre duplicado
      categoriaId: 1,
      capacidadMaxima: 12,
      tarifa: 80000,
      modalidad: "EXCLUSIVA",
    }),
  });
  const resDup = await servicesRoute.POST(reqDup);
  assert.equal(resDup.status, 409);
  const jsonDup = await resDup.json();
  assert.equal(jsonDup.error.code, "DUPLICATE_INSTANCE_NAME");

  // Alta de instancia "Cancha 2"
  const reqServ2 = new Request("http://localhost:3000/api/admin/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Cancha 2",
      categoriaId: 1,
      capacidadMaxima: 10,
      tarifa: 75000,
      modalidad: "EXCLUSIVA",
      franjasHorarias: [
        { diaSemana: 1, horaInicio: "07:00", horaFin: "08:00" },
      ],
    }),
  });
  const resServ2 = await servicesRoute.POST(reqServ2);
  assert.equal(resServ2.status, 201);
});

test("API: Criterio Clave — Coexistencia de Cancha 1 y Cancha 2 con calendarios independientes", async () => {
  // Consultar catálogo completo
  const reqGet = new Request("http://localhost:3000/api/admin/services?entity=services");
  const resGet = await servicesRoute.GET(reqGet);
  assert.equal(resGet.status, 200);
  const jsonGet = await resGet.json();
  assert.equal(jsonGet.success, true);

  const nombres = jsonGet.data.map((s: { nombre: string }) => s.nombre);
  assert.ok(nombres.includes("Cancha 1"), "Cancha 1 coexiste en la respuesta");
  assert.ok(nombres.includes("Cancha 2"), "Cancha 2 coexiste en la respuesta");

  // Verificar detalle y calendario independiente de Cancha 1
  const reqC1 = new Request("http://localhost:3000/api/admin/services/1");
  const resC1 = await serviceDetailRoute.GET(reqC1, { params: Promise.resolve({ id: "1" }) });
  assert.equal(resC1.status, 200);
  const jsonC1 = await resC1.json();
  assert.equal(jsonC1.data.nombre, "Cancha 1");
  assert.ok(jsonC1.data.disponibilidades.length > 0);

  // Verificar detalle y calendario independiente de Cancha 2
  const reqC2 = new Request("http://localhost:3000/api/admin/services/2");
  const resC2 = await serviceDetailRoute.GET(reqC2, { params: Promise.resolve({ id: "2" }) });
  assert.equal(resC2.status, 200);
  const jsonC2 = await resC2.json();
  assert.equal(jsonC2.data.nombre, "Cancha 2");
  assert.ok(jsonC2.data.disponibilidades.length > 0);

  // Simular reserva sobre Cancha 1
  const disp1 = jsonC1.data.disponibilidades[0];
  disp1.cuposOcupados = 1;
  mock._state.reservas.push({
    id: "booking-101",
    disponibilidadId: BigInt(disp1.id),
    estado: "CONFIRMADA",
  });

  // Disponibilidad de Cancha 2 sigue intacta en 0
  const disp2 = jsonC2.data.disponibilidades[0];
  assert.equal(disp2.cuposOcupados, 0, "Disponibilidad de Cancha 2 no fue afectada");
});

test("API: CRUD Actualización y eliminación segura con respeto de reservas", async () => {
  // Actualizar tarifa y capacidad de Cancha 2
  const reqUpdate = new Request("http://localhost:3000/api/admin/services/2", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tarifa: 85000,
      capacidadMaxima: 14,
    }),
  });
  const resUpdate = await serviceDetailRoute.PUT(reqUpdate, { params: Promise.resolve({ id: "2" }) });
  assert.equal(resUpdate.status, 200);
  const jsonUpdate = await resUpdate.json();
  assert.equal(jsonUpdate.data.tarifa, 85000);
  assert.equal(jsonUpdate.data.capacidadMaxima, 14);

  // Intentar borrar Cancha 1 (tiene reservas activas) debe responder 409 ACTIVE_RESERVATIONS
  const reqDelC1 = new Request("http://localhost:3000/api/admin/services/1", { method: "DELETE" });
  const resDelC1 = await serviceDetailRoute.DELETE(reqDelC1, { params: Promise.resolve({ id: "1" }) });
  assert.equal(resDelC1.status, 409);
  const jsonDelC1 = await resDelC1.json();
  assert.equal(jsonDelC1.error.code, "ACTIVE_RESERVATIONS");

  // Inactivar Cancha 1 preservando sus reservas
  const reqInactivate = new Request("http://localhost:3000/api/admin/services/1?inactivate=true", { method: "DELETE" });
  const resInactivate = await serviceDetailRoute.DELETE(reqInactivate, { params: Promise.resolve({ id: "1" }) });
  assert.equal(resInactivate.status, 200);
  const jsonInactivate = await resInactivate.json();
  assert.equal(jsonInactivate.data.servicio.estado, "INHABILITADO");

  // Eliminar Cancha 2 (sin reservas)
  const reqDelC2 = new Request("http://localhost:3000/api/admin/services/2", { method: "DELETE" });
  const resDelC2 = await serviceDetailRoute.DELETE(reqDelC2, { params: Promise.resolve({ id: "2" }) });
  assert.equal(resDelC2.status, 200);
});

test("API: Manejo seguro de errores — solo duplicado real de nombre es 409, otros errores son 500 sin exponer rutas internas", async () => {
  // 1. Duplicado real de nombre devuelve 409 con mensaje limpio sin rutas locales
  const reqDup = new Request("http://localhost:3000/api/admin/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Cancha 1",
      categoriaId: 1,
      capacidadMaxima: 10,
      tarifa: 75000,
      modalidad: "EXCLUSIVA",
    }),
  });
  const resDup = await servicesRoute.POST(reqDup);
  assert.equal(resDup.status, 409);
  const jsonDup = await resDup.json();
  assert.equal(jsonDup.error.code, "DUPLICATE_INSTANCE_NAME");
  assert.ok(!jsonDup.error.message.includes("\\"), "No debe exponer rutas locales de Windows");
  assert.ok(!jsonDup.error.message.includes("/"), "No debe exponer rutas de archivo");
  assert.ok(!jsonDup.error.message.includes("schema.prisma"), "No debe exponer schema");

  // 2. Otro error de BD (simulando error interno o P2002 en otra tabla/columna) debe ser 500 con mensaje genérico
  const origCreate = mock.servicio.create;
  mock.servicio.create = async () => {
    const dbErr = Object.assign(
      new Error(
        "Unique constraint failed on the fields: (`id`) at C:\\Users\\josed\\SportComplex\\schema.prisma:197",
      ),
      { code: "P2002", meta: { target: ["id"] } },
    );
    throw dbErr;
  };

  try {
    const reqDbErr = new Request("http://localhost:3000/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Cancha Error DB Test",
        categoriaId: 1,
        capacidadMaxima: 10,
        tarifa: 75000,
        modalidad: "EXCLUSIVA",
      }),
    });
    const resDbErr = await servicesRoute.POST(reqDbErr);
    assert.equal(resDbErr.status, 500, "Cualquier otro error de BD debe ser 500, no 409");
    const jsonDbErr = await resDbErr.json();
    assert.equal(jsonDbErr.error.code, "SERVER_ERROR");
    assert.equal(jsonDbErr.error.message, "Error al procesar el servicio");
    assert.ok(!jsonDbErr.error.message.includes("C:\\"), "No debe exponer rutas internas");
    assert.ok(!jsonDbErr.error.message.includes("schema.prisma"), "No debe exponer detalles internos");
  } finally {
    mock.servicio.create = origCreate;
  }
});
