import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { horaFranja, motivoRechazo, slugCategoria } from "./usePosSession";

describe("slugCategoria", () => {
  it("convierte el nombre de la categoría de la BD en la clave del catálogo", () => {
    assert.equal(slugCategoria("Canchas"), "canchas");
    assert.equal(slugCategoria("Piscinas"), "piscinas");
    assert.equal(slugCategoria("Gimnasio"), "gimnasio");
    assert.equal(slugCategoria("Zona Húmeda"), "zona-humeda");
    assert.equal(slugCategoria(undefined), "canchas");
  });
});

describe("horaFranja", () => {
  it("muestra la hora de la columna TIME serializada", () => {
    assert.equal(horaFranja("1970-01-01T07:00:00.000Z"), "07:00");
    assert.equal(horaFranja("18:30:00"), "18:30");
  });
});

describe("motivoRechazo", () => {
  it("prefiere el primer error de campo de Zod sobre el mensaje genérico", () => {
    const err = {
      error: {
        message: "Datos de venta POS inválidos.",
        details: { formErrors: [], fieldErrors: { clienteDocumento: ["El documento o cédula es obligatorio"] } },
      },
    };
    assert.equal(motivoRechazo(err, "x"), "El documento o cédula es obligatorio");
    assert.equal(motivoRechazo({ error: { message: "Sin cupos." } }, "x"), "Sin cupos.");
    assert.equal(motivoRechazo(null, "Error por defecto"), "Error por defecto");
  });
});
