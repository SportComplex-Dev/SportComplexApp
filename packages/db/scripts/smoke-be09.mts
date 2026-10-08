// Smoke test TSK-BE-09 (opción C) contra Stripe (test mode) y la DB real.
// Uso: pnpm --filter @sportcomplex/db smoke:be09
//
// Flujo: TX1 (createBookingHold) → Stripe Checkout Session (30 min) →
// verificación de que NO se crea PAGO (eso es del webhook RF-09) →
// compensación (libera el hold de prueba).
// Requiere DATABASE_URL/DIRECT_URL y STRIPE_SECRET_KEY (sk_test_...) en
// apps/web/.env.local, un usuario CLIENTE ACTIVO y una disponibilidad futura
// con cupo libre.
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../apps/web/.env.local") });

const { prisma, createBookingHold } = await import("../src/index.js");
const { createStripeCheckoutSession } = await import(
  "../../core/src/integrations/stripe.js"
);
const { compensateFailedCheckout } = await import("../src/repositories/checkout.js");

function ok(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

const cliente = await prisma.usuario.findFirst({
  where: { estado: "ACTIVO", rol: { nombre: "CLIENTE" } },
});
if (!cliente) {
  console.log("SKIP: no hay usuario CLIENTE ACTIVO en la DB; crea uno vía Google OAuth.");
  process.exit(0);
}

const future = await prisma.disponibilidad.findFirst({
  where: {
    cuposOcupados: { lt: prisma.disponibilidad.fields.cuposTotales },
    fecha: { gt: new Date() },
    bloqueadaMantenimiento: false,
    servicio: { estado: "ACTIVO" },
  },
  include: { servicio: true, franja: true },
  orderBy: { fecha: "asc" },
});
if (!future) {
  console.log("SKIP: no hay disponibilidad futura con cupo; corre scripts/db-seed-availability.mts.");
  process.exit(0);
}

const fecha = future.fecha.toISOString().slice(0, 10);
const fmt = (t: Date) => t.toISOString().slice(11, 19);
const startTime = `${fecha}T${fmt(future.franja.horaInicio)}-05:00`;
const endTime = `${fecha}T${fmt(future.franja.horaFin)}-05:00`;

console.log(`\n== TX1: createBookingHold (${future.servicio.nombre}, ${fecha} ${fmt(future.franja.horaInicio)})`);
const before = future.cuposOcupados;
let hold;
try {
  hold = await createBookingHold({
    serviceId: future.servicioId,
    startTime,
    endTime,
    cantidadCupos: 1,
    userId: cliente.id,
  });
  ok("TX1 reserva PENDIENTE_PAGO", hold.estado === "PENDIENTE_PAGO" && hold.cantidadCupos === 1);
  const ttlMs = (hold.expiraEn as Date).getTime() - Date.now();
  ok("TX1 expiraEn ≈ +30 min", Math.abs(ttlMs - 30 * 60_000) < 5_000, `${Math.round(ttlMs / 1000)}s`);
  ok("TX1 pagoId NULL (sin PAGO en el lock)", hold.pagoId == null);
} catch (e) {
  ok("TX1 createBookingHold", false, e instanceof Error ? e.message : String(e));
  process.exit(1);
}

console.log("\n== Stripe: createStripeCheckoutSession");
let checkout;
try {
  checkout = await createStripeCheckoutSession({
    reservaId: hold.id,
    userId: cliente.id,
    total: hold.total,
    cantidadCupos: hold.cantidadCupos,
    servicioNombre: hold.disponibilidad?.servicio?.nombre,
  });
  ok("Sesión creada", checkout.sessionId.startsWith("cs_"), checkout.sessionId);
  ok(
    "PI ausente al crear (lo entrega el webhook RF-09)",
    checkout.paymentIntentId === null,
    `paymentIntentId=${String(checkout.paymentIntentId)}`,
  );
  const expMs = checkout.expiresAt.getTime() - Date.now();
  ok("expires_at ≈ +30 min", Math.abs(expMs - 30 * 60_000) < 60_000, `${Math.round(expMs / 1000)}s`);
  ok("checkout.url presente (FE-09)", typeof checkout.url === "string" && checkout.url.length > 0);
  console.log(`   URL: ${checkout.url}`);
} catch (e) {
  ok("createStripeCheckoutSession", false, e instanceof Error ? e.message : String(e));
  const compensated = await compensateFailedCheckout(hold.id);
  console.log(`   compensación ejecutada: ${compensated}`);
  process.exit(1);
}

console.log("\n== Sin PAGO durante TSK-BE-09");
const reservaMid = await prisma.reserva.findUnique({
  where: { id: hold.id },
  include: { pago: true },
});
ok("RESERVA sigue PENDIENTE_PAGO", reservaMid?.estado === "PENDIENTE_PAGO");
ok("RESERVA.pagoId sigue NULL", reservaMid?.pagoId == null && reservaMid?.pago == null);
const pagosCreados = await prisma.pago.count({
  where: { reservas: { some: { id: hold.id } } },
});
ok("ningún PAGO asociado a la reserva", pagosCreados === 0);

console.log("\n== Compensación (liberar hold de prueba)");
const compensated = await compensateFailedCheckout(hold.id);
ok("compensación ejecutada", compensated === true);
const reservaExp = await prisma.reserva.findUnique({ where: { id: hold.id } });
const dispExp = await prisma.disponibilidad.findUnique({ where: { id: future.id } });
ok("reserva EXPIRADA", reservaExp?.estado === "EXPIRADA");
ok("cupos liberados", dispExp?.cuposOcupados === before, `${dispExp?.cuposOcupados} (antes ${before})`);
const compensated2 = await compensateFailedCheckout(hold.id);
ok("compensación idempotente", compensated2 === false);
const pagosTrasCompensacion = await prisma.pago.count({
  where: { reservas: { some: { id: hold.id } } },
});
ok("compensación nunca crea PAGO", pagosTrasCompensacion === 0);

await prisma.$disconnect();
console.log("\nListo.");
