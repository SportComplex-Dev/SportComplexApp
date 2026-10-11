import test from "node:test";
import assert from "node:assert/strict";
import {
  createTournamentSchema,
  updateTournamentSchema,
  tournamentQuerySchema,
} from "../src/tournament.schema.ts";

test("createTournamentSchema: valida torneo válido con bloqueos", () => {
  const input = {
    titulo: "Torneo Abierto de Pádel",
    descripcion: "Torneo intermedio de fin de semana",
    categoriaId: 1,
    nivel: "INTERMEDIO",
    fechaInicio: "2026-11-01T08:00:00Z",
    fechaFin: "2026-11-02T18:00:00Z",
    cuposTotales: 16,
    precioInscripcion: 50000,
    bloqueos: [
      {
        servicioId: 1,
        horaInicio: "2026-11-01T08:00:00Z",
        horaFin: "2026-11-01T12:00:00Z",
      },
    ],
  };

  const parsed = createTournamentSchema.safeParse(input);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.titulo, "Torneo Abierto de Pádel");
    assert.equal(parsed.data.estado, "BORRADOR");
    assert.equal(parsed.data.cuposTotales, 16);
    assert.equal(parsed.data.bloqueos?.length, 1);
  }
});

test("createTournamentSchema: rechaza fechaFin <= fechaInicio", () => {
  const input = {
    titulo: "Torneo Invalido",
    categoriaId: 1,
    nivel: "AVANZADO",
    fechaInicio: "2026-11-02T18:00:00Z",
    fechaFin: "2026-11-01T08:00:00Z",
    cuposTotales: 8,
  };

  const parsed = createTournamentSchema.safeParse(input);
  assert.equal(parsed.success, false);
});

test("createTournamentSchema: rechaza bloqueo con horaFin <= horaInicio", () => {
  const input = {
    titulo: "Torneo Bloqueo Invalido",
    categoriaId: 1,
    nivel: "PRINCIPIANTE",
    fechaInicio: "2026-11-01T08:00:00Z",
    fechaFin: "2026-11-02T18:00:00Z",
    cuposTotales: 8,
    bloqueos: [
      {
        servicioId: 1,
        horaInicio: "2026-11-01T12:00:00Z",
        horaFin: "2026-11-01T10:00:00Z",
      },
    ],
  };

  const parsed = createTournamentSchema.safeParse(input);
  assert.equal(parsed.success, false);
});

test("createTournamentSchema: rechaza cuposTotales < 2 o título corto", () => {
  const invalidCupos = {
    titulo: "Torneo",
    categoriaId: 1,
    nivel: "OPEN",
    fechaInicio: "2026-11-01T08:00:00Z",
    fechaFin: "2026-11-02T18:00:00Z",
    cuposTotales: 1,
  };
  assert.equal(createTournamentSchema.safeParse(invalidCupos).success, false);

  const invalidTitulo = {
    titulo: "ab",
    categoriaId: 1,
    nivel: "OPEN",
    fechaInicio: "2026-11-01T08:00:00Z",
    fechaFin: "2026-11-02T18:00:00Z",
    cuposTotales: 8,
  };
  assert.equal(createTournamentSchema.safeParse(invalidTitulo).success, false);
});

test("updateTournamentSchema: permite actualizaciones parciales", () => {
  const updateInput = {
    estado: "INSCRIPCIONES_ABIERTAS",
    cuposTotales: 32,
  };
  const parsed = updateTournamentSchema.safeParse(updateInput);
  assert.equal(parsed.success, true);
});

test("tournamentQuerySchema: parsea filtros válidos", () => {
  const query = {
    estado: "INSCRIPCIONES_ABIERTAS",
    categoriaId: "2",
    search: "Pádel",
  };
  const parsed = tournamentQuerySchema.safeParse(query);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.categoriaId, 2);
    assert.equal(parsed.data.estado, "INSCRIPCIONES_ABIERTAS");
    assert.equal(parsed.data.search, "Pádel");
  }
});
