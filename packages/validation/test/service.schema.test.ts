import test from "node:test";
import assert from "node:assert/strict";
import {
  createCategoriaSchema,
  updateCategoriaSchema,
  createServicioSchema,
  updateServicioSchema,
  franjaHorariaSchema,
  normalizeServicePayload,
  serviceSchema,
} from "../src/service.schema.ts";

test("createCategoriaSchema valida categorías válidas e inválidas", () => {
  // Categoría válida
  const valid = createCategoriaSchema.safeParse({
    nombre: "Canchas Sintéticas",
    tipo: "CANCHA",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.nombre, "Canchas Sintéticas");
    assert.equal(valid.data.tipo, "CANCHA");
  }

  // Nombre muy corto (< 2)
  const shortName = createCategoriaSchema.safeParse({
    nombre: "A",
    tipo: "CANCHA",
  });
  assert.equal(shortName.success, false);

  // Tipo de categoría inválido
  const invalidType = createCategoriaSchema.safeParse({
    nombre: "Pista Atletismo",
    tipo: "PISTA_INVALIDA",
  });
  assert.equal(invalidType.success, false);
});

test("updateCategoriaSchema permite modificaciones parciales", () => {
  const partial = updateCategoriaSchema.safeParse({
    nombre: "Piscinas Olímpicas",
  });
  assert.equal(partial.success, true);
});

test("updateServicioSchema valida actualizaciones parciales de instancia", () => {
  const partial = updateServicioSchema.safeParse({
    tarifa: 75000,
    capacidadMaxima: 16,
  });
  assert.equal(partial.success, true);
});

test("franjaHorariaSchema valida horarios y orden cronológico", () => {
  // Franja válida
  const validFranja = franjaHorariaSchema.safeParse({
    diaSemana: 1, // Lunes
    horaInicio: "08:00",
    horaFin: "09:00",
  });
  assert.equal(validFranja.success, true);

  // Franja con horaFin anterior a horaInicio debe fallar
  const invalidOrder = franjaHorariaSchema.safeParse({
    diaSemana: 1,
    horaInicio: "10:00",
    horaFin: "08:00",
  });
  assert.equal(invalidOrder.success, false);

  // Día de la semana fuera de rango (0 u 8)
  const invalidDay = franjaHorariaSchema.safeParse({
    diaSemana: 8,
    horaInicio: "08:00",
    horaFin: "09:00",
  });
  assert.equal(invalidDay.success, false);
});

test("createServicioSchema valida campos obligatorios y reglas de piscina", () => {
  // Servicio estándar (Cancha)
  const cancha = createServicioSchema.safeParse({
    nombre: "Cancha Sintética 1",
    categoriaId: 1,
    capacidadMaxima: 12,
    tarifa: 60000,
    modalidad: "EXCLUSIVA",
    franjasHorarias: [
      { diaSemana: 1, horaInicio: "08:00", horaFin: "09:00" },
    ],
  });
  assert.equal(cancha.success, true);

  // Capacidad 0 o negativa debe fallar
  const zeroCapacity = createServicioSchema.safeParse({
    nombre: "Cancha Inválida",
    categoriaId: 1,
    capacidadMaxima: 0,
    tarifa: 50000,
    modalidad: "EXCLUSIVA",
  });
  assert.equal(zeroCapacity.success, false);

  // Piscina privada con modalidad AFORO debe fallar según regla de dominio
  const invalidPool = createServicioSchema.safeParse({
    nombre: "Piscina Privada VIP",
    categoriaId: 2,
    capacidadMaxima: 20,
    tarifa: 80000,
    modalidad: "AFORO",
    tipoPiscina: "PRIVADA",
  });
  assert.equal(invalidPool.success, false);

  // Piscina privada con modalidad EXCLUSIVA debe pasar
  const validPrivatePool = createServicioSchema.safeParse({
    nombre: "Piscina Privada VIP",
    categoriaId: 2,
    capacidadMaxima: 1,
    tarifa: 80000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: "PRIVADA",
  });
  assert.equal(validPrivatePool.success, true);
});

test("normalizeServicePayload mapea atributos legados en inglés a modelo canónico", () => {
  const legacyPayload = {
    name: "Cancha de Tenis 1",
    categoryId: "3",
    capacity: "4",
    price: "45000",
    modality: "Privada",
    schedule: [{ diaSemana: 2, horaInicio: "14:00", horaFin: "15:00" }],
  };

  const normalized = normalizeServicePayload(legacyPayload);
  assert.equal(normalized.nombre, "Cancha de Tenis 1");
  assert.equal(normalized.categoriaId, "3");
  assert.equal(normalized.capacidadMaxima, "4");
  assert.equal(normalized.modalidad, "EXCLUSIVA");

  const parsed = createServicioSchema.safeParse(normalized);
  assert.equal(parsed.success, true);
});

test("serviceSchema retrocompatible sigue aceptando llamadas heredadas", () => {
  const parsed = serviceSchema.safeParse({
    name: "Gimnasio Cardiovascular",
    categoryId: 4,
    capacity: 30,
    isPool: false,
    modality: "Publica",
  });
  assert.equal(parsed.success, true);
});
