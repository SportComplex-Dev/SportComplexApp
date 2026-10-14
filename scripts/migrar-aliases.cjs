/**
 * Migra imports relativos en apps/web/src a path aliases.
 * - `*\/src\/**` -> `@\/*`
 * - `packages/db/test/*` -> `@db-test/*`
 * Cubre import/export-from estaticos y import() dinamicos. Idempotente.
 */
const fs = require("node:fs");
const path = require("node:path");

const SRC = "C:/Users/josed/orca/workspaces/SportComplexApp/osprey/apps/web/src";
const REPO = "C:/Users/josed/orca/workspaces/SportComplexApp/osprey";

const PATTERN =
  /((?:import|export)[^'"]*?from\s*|import\s*\()\s*(['"])(\.[^'"]*)\2/g;

function stripExt(p) {
  return p.replace(/\.(ts|tsx|js|jsx)$/, "");
}

function toAlias(fromFile, spec) {
  const abs = path.resolve(path.dirname(fromFile), spec);
  const relSrc = path.relative(SRC, abs).replace(/\\/g, "/");
  if (!relSrc.startsWith("..")) return "@/" + stripExt(relSrc);
  const relRepo = path.relative(REPO, abs).replace(/\\/g, "/");
  if (relRepo.startsWith("packages/db/test/")) {
    return "@db-test/" + stripExt(relRepo.slice("packages/db/test/".length));
  }
  return null; // fuera de alcance: reportar
}

let changed = 0;
let fuera = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const orig = fs.readFileSync(p, "utf8");
      const next = orig.replace(PATTERN, (m, head, q, spec) => {
        const alias = toAlias(p, spec);
        if (!alias) {
          fuera.push(p + " :: " + spec);
          return m;
        }
        if (alias === stripExt(spec)) return m;
        return head + q + alias + q;
      });
      if (next !== orig) {
        fs.writeFileSync(p, next);
        changed++;
      }
    }
  }
}
walk(SRC);
console.log("archivos migrados:", changed);
console.log("fuera de alcance:", fuera.length);
fuera.forEach((f) => console.log("  " + f));
