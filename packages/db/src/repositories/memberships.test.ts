import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRenewalDate,
  createMembership,
  findActiveMembership,
  listMembershipPlans,
  MembershipError,
} from "./memberships";
import { createMockPrisma } from "../../test/mock-prisma";

test("TSK-BE-20 / TSK-BD-11: listMembershipPlans devuelve planes activos ordenados", async () => {
  const db = createMockPrisma();
  const planes = await listMembershipPlans(db);
  assert.equal(planes.length, 3);
  assert.equal(planes[0].periodicidad, "SEMANAL");
  assert.equal(planes[1].periodicidad, "MENSUAL");
  assert.equal(planes[2].periodicidad, "ANUAL");
  assert.equal(planes[0].descuentoPct, 30.0);
});

test("TSK-BE-20: calculateRenewalDate suma según periodicidad", () => {
  const base = new Date("2026-10-15T12:00:00Z");

  const semanal = calculateRenewalDate(base, "SEMANAL");
  assert.equal(semanal.toISOString().slice(0, 10), "2026-10-22");

  const mensual = calculateRenewalDate(base, "MENSUAL");
  assert.equal(mensual.toISOString().slice(0, 10), "2026-11-15");

  const anual = calculateRenewalDate(base, "ANUAL");
  assert.equal(anual.toISOString().slice(0, 10), "2027-10-15");
});

test("TSK-BE-20: createMembership crea membresía VIGENTE con plan asociado", async () => {
  const db = createMockPrisma();
  const userId = "00000000-0000-4000-8000-000000000001";

  const membresia = await createMembership(
    {
      usuarioId: userId,
      planId: 2, // Mensual
      stripeSubscriptionId: "sub_test_001",
    },
    db,
  );

  assert.equal(membresia.usuarioId, userId);
  assert.equal(membresia.estado, "VIGENTE");
  assert.equal(membresia.planId, 2);
  assert.equal(membresia.stripeSubscriptionId, "sub_test_001");
  assert.ok(membresia.plan);
  assert.equal(membresia.plan.nombre, "Plan Mensual Estándar");

  const active = await findActiveMembership(userId, db);
  assert.ok(active);
  assert.equal(active?.id, membresia.id);
});

test("TSK-BD-11 / TSK-BE-20 (Criterio Clave): rechaza segunda membresía VIGENTE para el mismo usuario", async () => {
  const db = createMockPrisma();
  const userId = "00000000-0000-4000-8000-000000000002";

  await createMembership(
    {
      usuarioId: userId,
      planId: 1,
    },
    db,
  );

  await assert.rejects(
    () =>
      createMembership(
        {
          usuarioId: userId,
          planId: 2,
        },
        db,
      ),
    (err: unknown) =>
      err instanceof MembershipError &&
      err.code === "DUPLICATE_ACTIVE_MEMBERSHIP" &&
      err.status === 409,
  );
});
