import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const adminId = "00000000-0000-4000-8000-000000000012";
const db = createMockPrisma();
(globalThis as typeof globalThis & { __scPrisma: unknown }).__scPrisma = db;
(globalThis as typeof globalThis & {
  __scAuthSession: { user: { id: string } };
}).__scAuthSession = { user: { id: adminId } };

const route = await import("../route");

function seedData() {
  db._state.usuarios.length = 0;
  db._state.usuarios.push(
    {
      id: adminId,
      nombre: "Admin Principal",
      correo: "admin@sportcomplex.co",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 1,
      rolNombre: "ADMINISTRADOR",
      creadoEn: new Date("2026-09-01T10:00:00Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000015",
      nombre: "Vendedora Taquilla",
      correo: "vendedora@sportcomplex.co",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "VENDEDOR",
      creadoEn: new Date("2026-09-10T10:00:00Z"),
    },
    {
      id: "00000000-0000-4000-8000-000000000016",
      nombre: "Lector Acceso Torniquete",
      correo: "lector@sportcomplex.co",
      estado: "INACTIVO",
      deletedAt: new Date("2026-09-25T10:00:00Z"),
      rolId: 3,
      rolNombre: "LECTOR",
      creadoEn: new Date("2026-09-12T10:00:00Z"),
    },
  );
}

test("GET /api/admin/employees: devuelve lista de empleados y NO expone passwordHash", async () => {
  seedData();
  const res = await route.GET();
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.equal(json.data.length, 3);

  // Verificación estricta de seguridad: ningun objeto debe tener passwordHash
  for (const emp of json.data) {
    assert.equal(emp.passwordHash, undefined);
    assert.equal((emp as Record<string, unknown>).password_hash, undefined);
    assert.ok(emp.id);
    assert.ok(emp.nombre);
    assert.ok(emp.correo);
    assert.ok(emp.rol);
  }
});

test("POST /api/admin/employees: valida campos requeridos y formato de correo", async () => {
  seedData();
  const req = new Request("http://localhost/api/admin/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nombre: "",
      correo: "no-es-correo",
      rolNombre: "VENDEDOR",
      password: "123",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 400);

  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.error.code, "VALIDATION_ERROR");
});

test("POST /api/admin/employees: registra nuevo empleado exitosamente con contraseña hasheada", async () => {
  seedData();
  const req = new Request("http://localhost/api/admin/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nombre: "Nuevo Empleado Taquilla",
      correo: "nuevo.empleado@sportcomplex.co",
      rolNombre: "VENDEDOR",
      password: "ClaveSegura2026*",
    }),
  });

  const res = await route.POST(req);
  assert.equal(res.status, 201);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.nombre, "Nuevo Empleado Taquilla");
  assert.equal(json.data.correo, "nuevo.empleado@sportcomplex.co");
  assert.equal(json.data.estado, "ACTIVO");
  assert.equal(json.data.passwordHash, undefined);
});

test("GET /api/admin/employees: admite paginación con limit y offset (PERF-01)", async () => {
  seedData();
  const req = new Request("http://localhost/api/admin/employees?limit=2&offset=1");
  const res = await route.GET(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.length, 2);
  assert.equal(json.data[0].correo, "vendedora@sportcomplex.co");
});

test("POST /api/admin/employees: rechaza y no crea empleado si Supabase Auth falla por correo duplicado (SEC-04)", async () => {
  seedData();
  const initialLength = db._state.usuarios.length;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";

  const mockAdminClient = {
    auth: {
      admin: {
        createUser: async () => ({
          data: null,
          error: { message: "User already registered" },
        }),
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
  };
  (globalThis as unknown as { __scSupabaseAdminClient?: unknown }).__scSupabaseAdminClient = mockAdminClient;

  try {
    const req = new Request("http://localhost/api/admin/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nombre: "Empleado Conflicto Supabase",
        correo: "conflicto.sb@sportcomplex.co",
        rolNombre: "LECTOR",
        password: "ClaveSegura2026*",
      }),
    });

    const res = await route.POST(req);
    assert.equal(res.status, 409);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "EMAIL_ALREADY_EXISTS");

    // Verificar que la base de datos local no fue modificada
    assert.equal(db._state.usuarios.length, initialLength);
    assert.equal(
      db._state.usuarios.some((u: { correo: string }) => u.correo === "conflicto.sb@sportcomplex.co"),
      false,
    );
  } finally {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete (globalThis as unknown as { __scSupabaseAdminClient?: unknown }).__scSupabaseAdminClient;
  }
});

test("POST /api/admin/employees: compensa (revierte) la identidad en Supabase si la creación en DB falla", async () => {
  seedData();

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";

  let userDeleted = false;
  const mockAdminClient = {
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: "sb-user-rollback-id" } },
          error: null,
        }),
        deleteUser: async (id: string) => {
          if (id === "sb-user-rollback-id") userDeleted = true;
          return { data: null, error: null };
        },
      },
    },
  };
  (globalThis as unknown as { __scSupabaseAdminClient?: unknown }).__scSupabaseAdminClient = mockAdminClient;

  // Hacemos que la DB falle arrojando un error en create
  const originalCreate = db.usuario.create;
  db.usuario.create = async () => {
    throw new Error("DB connection dropped");
  };

  try {
    const req = new Request("http://localhost/api/admin/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nombre: "Empleado Falla DB",
        correo: "falla.db@sportcomplex.co",
        rolNombre: "VENDEDOR",
        password: "ClaveSegura2026*",
      }),
    });

    const res = await route.POST(req);
    assert.equal(res.status, 500);

    // Debe haberse ejecutado el rollback en Supabase Auth
    assert.equal(userDeleted, true, "La identidad en Supabase debe ser eliminada tras el fallo en DB");
  } finally {
    db.usuario.create = originalCreate;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete (globalThis as unknown as { __scSupabaseAdminClient?: unknown }).__scSupabaseAdminClient;
  }
});
