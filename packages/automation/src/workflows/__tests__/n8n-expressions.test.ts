import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Directorio de workflows n8n exportados como JSON (fuente que el deploy
 * importa en el contenedor `n8n` con `import:workflow --separate`).
 */
const WORKFLOWS_DIR = fileURLToPath(new URL("../../../workflows/", import.meta.url));

interface NodeLike {
  name: string;
  parameters?: Record<string, unknown>;
}

interface WorkflowLike {
  nodes?: NodeLike[];
}

/** Recolecta recursivamente todo valor string de un objeto, con su ruta. */
function collectStrings(node: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof node === "string") {
    out.push([path, node]);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => collectStrings(value, `${path}[${index}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      collectStrings(value, path ? `${path}.${key}` : key, out);
    }
  }
}

function readWorkflows(): Array<{ file: string; workflow: WorkflowLike }> {
  return readdirSync(WORKFLOWS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      workflow: JSON.parse(readFileSync(join(WORKFLOWS_DIR, file), "utf8")) as WorkflowLike,
    }));
}

function nodeParameterStrings(workflow: WorkflowLike): Array<{ node: string; field: string; value: string }> {
  const found: Array<{ node: string; field: string; value: string }> = [];
  for (const node of workflow.nodes ?? []) {
    const values: Array<[string, string]> = [];
    collectStrings(node.parameters ?? {}, "", values);
    for (const [field, value] of values) found.push({ node: node.name, field, value });
  }
  return found;
}

describe("workflows n8n (packages/automation/workflows)", () => {
  it("todo valor con {{ }} empieza con '=' — si no, n8n lo manda literal", () => {
    // n8n sólo evalúa un parámetro si su valor arranca con "=". Sin ese prefijo
    // envía el texto tal cual: p.ej. el header `Bearer {{ $env.RESEND_API_KEY }}`
    // llegaba a Resend como string literal -> 400 "API key is invalid".
    const offenders: string[] = [];
    for (const { file, workflow } of readWorkflows()) {
      for (const { node, field, value } of nodeParameterStrings(workflow)) {
        if (value.includes("{{") && !value.startsWith("=")) {
          offenders.push(`${file} :: ${node} :: ${field} -> ${value.slice(0, 80)}`);
        }
      }
    }
    assert.deepEqual(offenders, [], "Parámetros con {{ }} sin el prefijo '=' (n8n no los evalúa)");
  });

  it("el header de Resend usa $env y no una clave embebida", () => {
    const offenders: string[] = [];
    for (const { file, workflow } of readWorkflows()) {
      for (const { node, field, value } of nodeParameterStrings(workflow)) {
        const isResendAuth = field.endsWith("Authorization") || value.toLowerCase().includes("bearer");
        if (isResendAuth && value.trim().startsWith("=")) {
          const expected = "=Bearer {{ $env.RESEND_API_KEY }}";
          if (value !== expected) offenders.push(`${file} :: ${node} :: ${field} -> ${value}`);
        }
        // Ninguna workflow debe llevar una API key en claro (re_xxx).
        if (/re_[A-Za-z0-9]{16,}/.test(value)) offenders.push(`${file} :: ${node} :: ${field} -> clave Resend embebida`);
      }
    }
    assert.deepEqual(offenders, [], "Authorization de Resend debe ser '=Bearer {{ $env.RESEND_API_KEY }}'");
  });
});
