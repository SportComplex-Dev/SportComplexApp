/**
 * HU-21.DB — Regresión de integridad referencial para empleados (modelo Usuario).
 *
 * CA-01: ningún DELETE físico de un usuario con historial puede prosperar -> todas las
 *   FKs usuario -> negocio deben ser ON DELETE RESTRICT (única fuente de verdad: el motor).
 * CA-02: prohibido onDelete Cascade/SetNull en FKs que referencien a `usuario`, salvo la
 *   excepción documentada TokenVerificacion (token efímero de auth, no historial).
 * CA-03: ON UPDATE CASCADE preservado en esas FKs.
 * CA-04: la migración hu21 existe y es idempotente (DROP IF EXISTS + ADD RESTRICT/CASCADE).
 *
 * Test estático (sin DB): audita schema.prisma + migration.sql. No usa mocks porque lo que
 * se certifica es el contrato del motor, no la lógica de repositorios.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
const MIGRATION = readFileSync(
  path.join(
    __dirname,
    "../prisma/migrations/20261009000000_hu21_restrict_borrado_empleado/migration.sql",
  ),
  "utf8",
);

// FKs usuario -> negocio que la HU blinda (modelo.campo).
const PROTECTED = [
  "Pago.usuario",
  "Reserva.titular",
  "Reserva.vendedor",
  "TicketQr.empleadoLector",
  "AsignacionPuesto.empleado",
  "LecturaAcceso.empleado",
  "Membresia.usuario",
  "InhabilitacionServicio.admin",
];

/** Divide el schema en bloques por modelo. */
function modelBlocks(schema: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const re = /^model (\w+) \{([\s\S]*?)^\}/gm;
  for (const m of schema.matchAll(re)) blocks.set(m[1], m[2]);
  return blocks;
}

test("CA-02: ninguna relación hacia Usuario usa Cascade/SetNull (salvo TokenVerificacion)", () => {
  const blocks = modelBlocks(SCHEMA);
  for (const [model, body] of blocks) {
    if (model === "TokenVerificacion") continue; // excepción documentada HU-21.DB
    for (const line of body.split("\n")) {
      if (!line.includes("Usuario") || !line.includes("@relation")) continue;
      assert.match(
        line,
        /onDelete:\s*Restrict/,
        `${model}: Se esperaba onDelete: Restrict, línea: ${line.trim()}`,
      );
      assert.doesNotMatch(line, /onDelete:\s*(Cascade|SetNull)/);
    }
  }
  // Las 8 relaciones protegidas existen y están en Restrict (solo líneas @relation).
  const found = PROTECTED.filter((key) => {
    const [m, ...rest] = key.split(".");
    const field = rest.join(".");
    const body = blocks.get(m) ?? "";
    return body
      .split("\n")
      .some((l) => l.includes("@relation") && l.includes(field) && /onDelete:\s*Restrict/.test(l));
  });
  // Nota: el nombre del campo Prisma se busca por su identificador.
  assert.equal(
    found.length,
    PROTECTED.length,
    `Faltan relaciones protegidas en Restrict: ${PROTECTED.filter((p) => !found.includes(p)).join(", ")}`,
  );
});

test("CA-02-excepción: TokenVerificacion mantiene Cascade documentado", () => {
  const body = modelBlocks(SCHEMA).get("TokenVerificacion") ?? "";
  assert.match(body, /onDelete:\s*Cascade/, "TokenVerificacion debe mantener Cascade");
  assert.match(
    body,
    /excepci[óo]n documentada/i,
    "La excepción Cascade debe estar documentada con comentario HU-21.DB",
  );
});

test("CA-03: ON UPDATE CASCADE explícito en las relaciones protegidas", () => {
  const blocks = modelBlocks(SCHEMA);
  for (const key of PROTECTED) {
    const [model, ...rest] = key.split(".");
    const field = rest.join(".");
    const line =
      (blocks.get(model) ?? "")
        .split("\n")
        .find((l) => l.includes("@relation") && l.includes(field)) ?? "";
    assert.match(
      line,
      /onUpdate:\s*Cascade/,
      `${key}: Se esperaba onUpdate: Cascade explícito`,
    );
  }
});

test("CA-01/CA-04: la migración hu21 reafirma RESTRICT de forma idempotente", () => {
  // Las sentencias ADD ocupan varias líneas: se agrupa por ";" antes de analizar.
  const statements = MIGRATION.split(";").map((s) => s.trim());
  const toUsuario = statements.filter((s) => s.includes('REFERENCES "usuario"'));
  assert.ok(toUsuario.length >= 8, `Se esperaban >=8 FKs hacia usuario, hay ${toUsuario.length}`);
  for (const stmt of statements) {
    if (!stmt.includes("ADD CONSTRAINT")) continue;
    // Cada ADD debe tener su DROP IF EXISTS previo (idempotencia).
    const name = stmt.match(/"([a-z_]+_fkey)"/)?.[1] ?? "";
    assert.ok(
      MIGRATION.includes(`DROP CONSTRAINT IF EXISTS "${name}"`),
      `${name}: falta DROP CONSTRAINT IF EXISTS previo (idempotencia CA-04)`,
    );
  }
  // Ningún statement (no comentario) usa CASCADE/SET NULL.
  const code = MIGRATION.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /ON DELETE CASCADE/);
  assert.doesNotMatch(code, /ON DELETE SET NULL/);
  assert.match(code, /ON DELETE RESTRICT ON UPDATE CASCADE/);
});
