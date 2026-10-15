/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TournamentError,
  crearTorneo,
  listarTorneos,
  obtenerTorneoPorId,
  eliminarTorneo,
  obtenerDetallePublicoTorneo,
} from "./tournaments.js";
import { createMockPrisma } from "../../../test/mock-prisma";

function nuevoMock() {
  const mock: any = createMockPrisma();
  mock._state.categorias.push({ id: 1, nombre: "Canchas", tipo: "CANCHA" });
  mock._state.usuarios.push({
    id: "admin-soft",
    nombre: "Admin",
    correo: "admin@soft.com",
    rolId: 1,
  });
  return mock;
}

const baseTorneo = {
  adminId: "admin-soft",
  categoriaId: 1,
  titulo: "Torneo Soft Delete",
  nivel: "Segunda",
  fechaInicio: "2026-11-20T08:00:00Z",
  fechaFin: "2026-11-20T18:00:00Z",
  cuposTotales: 8,
};

test("soft-delete: eliminarTorneo marca eliminadoEn y lo excluye del listado", async () => {
  const mock = nuevoMock();
  const creado: any = await crearTorneo({ ...baseTorneo }, { db: mock });
  assert.equal(creado.eliminadoEn, null);

  const antes = await listarTorneos({}, { db: mock } as any);
  assert.ok(antes.some((t: any) => t.id === creado.id));

  await eliminarTorneo(creado.id, { db: mock });

  const despues = await listarTorneos({}, { db: mock } as any);
  assert.ok(!despues.some((t: any) => t.id === creado.id));
});

test("soft-delete: obtenerTorneoPorId y detalle público rechazan torneo eliminado", async () => {
  const mock = nuevoMock();
  const creado: any = await crearTorneo({ ...baseTorneo }, { db: mock });
  await eliminarTorneo(creado.id, { db: mock });

  await assert.rejects(() => obtenerTorneoPorId(creado.id, { db: mock }), TournamentError);
  await assert.rejects(
    () => obtenerDetallePublicoTorneo(creado.id, { db: mock }),
    TournamentError,
  );
});

test("soft-delete: torneo sembrado sin campo eliminadoEn sigue legible (tolerancia undefined)", async () => {
  const mock = nuevoMock();
  mock._state.torneos.push({
    id: "legado-sin-campo",
    adminId: "admin-soft",
    categoriaId: 1,
    titulo: "Torneo legado",
    nivel: "Tercera",
    fechaInicio: new Date("2026-12-01T08:00:00Z"),
    fechaFin: new Date("2026-12-01T18:00:00Z"),
    cuposTotales: 8,
    cuposOcupados: 0,
    precioInscripcion: 0,
    estado: "INSCRIPCIONES_ABIERTAS",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  });

  const torneo: any = await obtenerTorneoPorId("legado-sin-campo", { db: mock });
  assert.equal(torneo.id, "legado-sin-campo");
  const lista = await listarTorneos({}, { db: mock } as any);
  assert.ok(lista.some((t: any) => t.id === "legado-sin-campo"));
});
