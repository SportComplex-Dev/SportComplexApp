import test from "node:test";
import assert from "node:assert/strict";
import {
  handleIncidentRequest,
  type IncidentDependencies,
} from "../route";

const adminId = "00000000-0000-4000-8000-000000000031";
const inhabilitation = {
  id: 7,
  servicioId: 1,
  adminId,
  motivo: "Daño en sistema de filtrado",
  fechaInicio: new Date("2026-10-09T12:00:00.000Z"),
  fechaFin: null,
  webhookEnviadoEn: null,
};

function dependencies(
  overrides: Partial<IncidentDependencies> = {},
): IncidentDependencies {
  return {
    authenticate: async () => ({ user: { id: adminId } }),
    findAccount: async () => ({
      estado: "ACTIVO",
      deletedAt: null,
      rol: { nombre: "ADMIN" },
    }),
    disableService: async () => ({
      inhabilitacion: inhabilitation,
      servicio: { id: 1, nombre: "Piscina", estado: "INHABILITADO" },
      reservasCanceladas: [],
      webhookPayload: {
        servicioId: 1,
        servicio: "Piscina",
        motivo: "Daño en sistema de filtrado",
        usuarios: [],
      },
    }),
    sendWebhook: async () => ({
      sent: false,
      error: "N8N_CONTINGENCY_WEBHOOK_URL no está configurada.",
    }),
    markWebhookSent: async () => inhabilitation,
    ...overrides,
  };
}

function request(body: unknown = {
  serviceId: 1,
  motivo: "Daño en sistema de filtrado",
}): Request {
  return new Request("http://localhost/api/admin/incident", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST /api/admin/incident rechaza solicitudes anónimas", async () => {
  const response = await handleIncidentRequest(
    request(),
    dependencies({ authenticate: async () => null }),
  );

  assert.equal(response.status, 401);
});

test("POST /api/admin/incident rechaza roles no administrativos e inactivos", async () => {
  const forbiddenRole = await handleIncidentRequest(
    request(),
    dependencies({
      findAccount: async () => ({
        estado: "ACTIVO",
        deletedAt: null,
        rol: { nombre: "LECTOR" },
      }),
    }),
  );
  assert.equal(forbiddenRole.status, 403);

  const inactiveAccount = await handleIncidentRequest(
    request(),
    dependencies({
      findAccount: async () => ({
        estado: "INACTIVO",
        deletedAt: new Date(),
        rol: { nombre: "ADMIN" },
      }),
    }),
  );
  assert.equal(inactiveAccount.status, 403);
});

test("POST /api/admin/incident rechaza JSON inválido y datos fuera del esquema", async () => {
  const invalidJson = await handleIncidentRequest(
    new Request("http://localhost/api/admin/incident", {
      method: "POST",
      body: "{",
    }),
    dependencies(),
  );
  assert.equal(invalidJson.status, 400);

  const invalidPayload = await handleIncidentRequest(
    request({ serviceId: 0, motivo: "x" }),
    dependencies(),
  );
  assert.equal(invalidPayload.status, 400);
});

test("POST /api/admin/incident mantiene la contingencia aplicada si n8n falla", async () => {
  let markerCalled = false;
  const response = await handleIncidentRequest(
    request(),
    dependencies({
      markWebhookSent: async () => {
        markerCalled = true;
        return inhabilitation;
      },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.data.webhook, {
    sent: false,
    error: "N8N_CONTINGENCY_WEBHOOK_URL no está configurada.",
  });
  assert.equal(body.data.webhookEnviadoRegistrado, false);
  assert.equal(body.data.reembolsoAutomatico, false);
  assert.equal(markerCalled, false);
});

test("POST /api/admin/incident sigue exitoso si falla registrar el despacho ya enviado", async () => {
  const response = await handleIncidentRequest(
    request(),
    dependencies({
      sendWebhook: async () => ({ sent: true }),
      markWebhookSent: async () => {
        throw new Error("database unavailable");
      },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data.webhook, { sent: true });
  assert.equal(body.data.webhookEnviadoRegistrado, false);
});
