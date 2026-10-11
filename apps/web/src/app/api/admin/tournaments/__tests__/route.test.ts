/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const mock = createMockPrisma();
(globalThis as unknown as { __scPrisma: unknown }).__scPrisma = mock;
(globalThis as typeof globalThis & {
  __scAuthSession: { user: { id: string } } | null;
}).__scAuthSession = { user: { id: "admin-tournaments" } };

// Configurar datos base de prueba en el mock
mock._state.usuarios.push({
  id: "admin-tournaments",
  nombre: "Admin Torneos",
  correo: "admin.torneos@sportcomplex.com",
  estado: "ACTIVO",
  deletedAt: null,
  rolId: 1,
  rolNombre: "ADMINISTRADOR",
});
mock._state.usuarios.push({
  id: "client-unauthorized",
  nombre: "Cliente Sin Permiso",
  correo: "cliente@sportcomplex.com",
  estado: "ACTIVO",
  deletedAt: null,
  rolId: 2,
  rolNombre: "CLIENTE",
});

mock._state.categorias.push({
  id: 1,
  nombre: "Pádel",
  tipo: "CANCHA",
});

mock._state.servicios.push(
  {
    id: 1,
    categoriaId: 1,
    nombre: "Pista Central Pádel",
    capacidadMaxima: 4,
    tarifa: 75000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  },
  {
    id: 2,
    categoriaId: 1,
    nombre: "Pista Cristal 2",
    capacidadMaxima: 4,
    tarifa: 75000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  },
);

mock._state.franjas.push({
  id: 10,
  servicioId: 1,
  diaSemana: 6,
  horaInicio: new Date("1970-01-01T08:00:00Z"),
  horaFin: new Date("1970-01-01T12:00:00Z"),
});

mock._state.disponibilidades.push({
  id: 201n,
  servicioId: 1,
  franjaId: 10,
  fecha: new Date("2026-11-07T00:00:00.000Z"),
  cuposTotales: 1,
  cuposOcupados: 0,
  bloqueadaMantenimiento: false,
});

// Import route handlers
const tournamentsRoute = await import("../route");
const tournamentDetailRoute = await import("../[id]/route");

test("API: Validación de permisos en /api/admin/tournaments", async () => {
  // 1. Petición sin sesión -> 401
  const savedSession = (globalThis as any).__scAuthSession;
  (globalThis as any).__scAuthSession = null;
  const resUnauth = await tournamentsRoute.GET(
    new Request("http://localhost:3000/api/admin/tournaments"),
  );
  assert.equal(resUnauth.status, 401);

  // 2. Petición con rol no autorizado (Cliente) -> 403
  (globalThis as any).__scAuthSession = { user: { id: "client-unauthorized" } };
  const resForbidden = await tournamentsRoute.GET(
    new Request("http://localhost:3000/api/admin/tournaments"),
  );
  assert.equal(resForbidden.status, 403);

  // Restaurar sesión de Administrador
  (globalThis as any).__scAuthSession = savedSession;
});

test("API: POST /api/admin/tournaments con validación Zod y bloqueo de pistas", async () => {
  // 1. Rechazo por datos inválidos (título muy corto, cupos insuficientes)
  const resInvalid = await tournamentsRoute.POST(
    new Request("http://localhost:3000/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "ab",
        categoriaId: 1,
        nivel: "OPEN",
        fechaInicio: "2026-11-07T08:00:00Z",
        fechaFin: "2026-11-07T12:00:00Z",
        cuposTotales: 1,
      }),
    }),
  );
  assert.equal(resInvalid.status, 400);
  const dataInvalid = await resInvalid.json();
  assert.equal(dataInvalid.error.code, "VALIDATION_ERROR");

  // 2. Creación exitosa de torneo con bloqueo de pistas
  const resCreate = await tournamentsRoute.POST(
    new Request("http://localhost:3000/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "Gran Torneo de Apertura Pádel",
        descripcion: "Torneo clasificatorio de apertura",
        categoriaId: 1,
        nivel: "SEGUNDA_CATEGORIA",
        fechaInicio: "2026-11-07T08:00:00Z",
        fechaFin: "2026-11-07T14:00:00Z",
        cuposTotales: 16,
        precioInscripcion: 60000,
        bloqueos: [
          {
            servicioId: 1,
            horaInicio: "2026-11-07T08:00:00Z",
            horaFin: "2026-11-07T12:00:00Z",
          },
        ],
      }),
    }),
  );
  assert.equal(resCreate.status, 201);
  const dataCreate = await resCreate.json();
  assert.equal(dataCreate.success, true);
  assert.equal(dataCreate.data.titulo, "Gran Torneo de Apertura Pádel");
  assert.equal(dataCreate.data.estado, "BORRADOR");
  assert.equal(dataCreate.data.bloqueos.length, 1);

  // Verificar que la franja en Disponibilidad quedó bloqueada
  const disp = mock._state.disponibilidades.find((d: any) => d.id === 201n);
  assert.equal(disp.bloqueadaMantenimiento, true);
});

test("API: POST rechaza con 409 COURT_SLOT_CONFLICT si hay reserva activa previa", async () => {
  // Crear otra franja y disponibilidad ocupada
  mock._state.franjas.push({
    id: 11,
    servicioId: 2,
    diaSemana: 6,
    horaInicio: new Date("1970-01-01T14:00:00Z"),
    horaFin: new Date("1970-01-01T18:00:00Z"),
  });
  mock._state.disponibilidades.push({
    id: 202n,
    servicioId: 2,
    franjaId: 11,
    fecha: new Date("2026-11-07T00:00:00.000Z"),
    cuposTotales: 1,
    cuposOcupados: 1,
    bloqueadaMantenimiento: false,
  });
  mock._state.reservas.push({
    id: "reserva-previa-confirmada",
    disponibilidadId: 202n,
    estado: "CONFIRMADA",
    titularId: "client-unauthorized",
    cantidadCupos: 1,
  });

  // Intentar crear torneo solapando la pista 2 en ese horario
  const resConflict = await tournamentsRoute.POST(
    new Request("http://localhost:3000/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "Torneo Solapado",
        categoriaId: 1,
        nivel: "OPEN",
        fechaInicio: "2026-11-07T14:00:00Z",
        fechaFin: "2026-11-07T18:00:00Z",
        cuposTotales: 8,
        bloqueos: [
          {
            servicioId: 2,
            horaInicio: "2026-11-07T14:00:00Z",
            horaFin: "2026-11-07T18:00:00Z",
          },
        ],
      }),
    }),
  );
  assert.equal(resConflict.status, 409);
  const dataConflict = await resConflict.json();
  assert.equal(dataConflict.error.code, "COURT_SLOT_CONFLICT");
});

test("API: GET /api/admin/tournaments lista con filtros", async () => {
  const resGet = await tournamentsRoute.GET(
    new Request("http://localhost:3000/api/admin/tournaments?categoriaId=1&estado=BORRADOR"),
  );
  assert.equal(resGet.status, 200);
  const dataGet = await resGet.json();
  assert.equal(dataGet.success, true);
  assert.ok(Array.isArray(dataGet.data));
  assert.ok(dataGet.data.length >= 1);
});

test("API: GET, PATCH y DELETE en /api/admin/tournaments/[id]", async () => {
  // Obtener ID del torneo creado previamente
  const list = await tournamentsRoute.GET(
    new Request("http://localhost:3000/api/admin/tournaments"),
  );
  const listData = await list.json();
  const torneoId = listData.data[0].id;

  // 1. GET /api/admin/tournaments/[id]
  const resDetail = await tournamentDetailRoute.GET(
    new Request(`http://localhost:3000/api/admin/tournaments/${torneoId}`),
    { params: Promise.resolve({ id: torneoId }) },
  );
  assert.equal(resDetail.status, 200);
  const dataDetail = await resDetail.json();
  assert.equal(dataDetail.data.id, torneoId);

  // 2. PATCH /api/admin/tournaments/[id] - actualizar título y estado
  const resUpdate = await tournamentDetailRoute.PATCH(
    new Request(`http://localhost:3000/api/admin/tournaments/${torneoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "Gran Torneo Actualizado Pádel",
        estado: "INSCRIPCIONES_ABIERTAS",
      }),
    }),
    { params: Promise.resolve({ id: torneoId }) },
  );
  assert.equal(resUpdate.status, 200);
  const dataUpdate = await resUpdate.json();
  assert.equal(dataUpdate.data.titulo, "Gran Torneo Actualizado Pádel");
  assert.equal(dataUpdate.data.estado, "INSCRIPCIONES_ABIERTAS");

  // 3. DELETE /api/admin/tournaments/[id] - cancelar/eliminar y liberar pistas
  const resDelete = await tournamentDetailRoute.DELETE(
    new Request(`http://localhost:3000/api/admin/tournaments/${torneoId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: torneoId }) },
  );
  assert.equal(resDelete.status, 200);

  // Comprobar que la disponibilidad se liberó
  const disp = mock._state.disponibilidades.find((d: any) => d.id === 201n);
  assert.equal(disp.bloqueadaMantenimiento, false);
});
