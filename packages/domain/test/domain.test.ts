import test from "node:test";
import assert from "node:assert/strict";
import {
  zonaHoraria,
  TIMEZONE,
  diasVentanaReserva,
  BOOKING_WINDOW_DAYS,
  minutosTtlCheckout,
  CHECKOUT_TTL_MINUTES,
  tasaDescuentoMembresia,
  MEMBERSHIP_DISCOUNT_RATE,
  categoriasServicio,
  hogarPorRol,
} from "../dist/index.js";

test("@sportcomplex/domain: constantes globales coinciden con valores canónicos", () => {
  assert.equal(zonaHoraria, "America/Bogota");
  assert.equal(TIMEZONE, "America/Bogota");
  assert.equal(diasVentanaReserva, 15);
  assert.equal(BOOKING_WINDOW_DAYS, 15);
  assert.equal(minutosTtlCheckout, 30);
  assert.equal(CHECKOUT_TTL_MINUTES, 30);
  assert.equal(tasaDescuentoMembresia, 0.3);
  assert.equal(MEMBERSHIP_DISCOUNT_RATE, 0.3);
});

test("@sportcomplex/domain: categoriasServicio contiene las 4 categorias canónicas", () => {
  assert.equal(categoriasServicio.length, 4);
  const slugs = categoriasServicio.map((c) => c.slug);
  assert.deepEqual(slugs, ["canchas", "piscinas", "gimnasio", "zona-humeda"]);
});

test("@sportcomplex/domain: hogarPorRol define rutas para todos los roles", () => {
  assert.equal(hogarPorRol.Administrador, "/admin/dashboard");
  assert.equal(hogarPorRol.Empleado_Vendedor, "/pos");
  assert.equal(hogarPorRol.Empleado_Lector, "/scanner");
  assert.equal(hogarPorRol.Cliente, "/portal");
});
