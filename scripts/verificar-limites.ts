#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

interface Finding {
  ruleId: number;
  ruleName: string;
  file: string;
  line: number;
  snippet: string;
}

interface CliArgs {
  all: boolean;
  changed: boolean;
  scope?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    all: false,
    changed: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      result.all = true;
    } else if (arg === '--changed') {
      result.changed = true;
    } else if (arg === '--scope') {
      result.scope = args[++i];
    }
  }

  // Si no se especifica --all, --changed ni --scope: en CI corre --all, localmente verifica archivos modificados (--changed)
  if (!result.all && !result.changed && !result.scope) {
    if (process.env.CI) {
      result.all = true;
    } else {
      result.changed = true;
    }
  }

  return result;
}

const ROOT_DIR = path.resolve(__dirname, '..');

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function getChangedFiles(): string[] {
  try {
    const output = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' });
    const lines = output.split('\n');
    const files: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // git status --porcelain format: XY path or XY "path" or XY orig -> new
      const match = trimmed.match(/^..\s+(.+)$/);
      if (match && match[1]) {
        let filePath = match[1].trim();
        if (filePath.includes('->')) {
          filePath = filePath.split('->').pop()!.trim();
        }
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
        }
        files.push(normalizePath(filePath));
      }
    }
    return files;
  } catch {
    return [];
  }
}

function getAllFiles(dir: string, baseDir = ROOT_DIR): string[] {
  let results: string[] = [];
  const fullDir = path.resolve(baseDir, dir);
  if (!fs.existsSync(fullDir)) return results;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    const relPath = normalizePath(path.relative(baseDir, fullPath));

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.turbo' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === 'coverage'
      ) {
        continue;
      }
      results = results.concat(getAllFiles(relPath, baseDir));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results;
}

// Helper para verificar si un archivo es de prueba
function isTestFile(relPath: string): boolean {
  const norm = normalizePath(relPath);
  return (
    norm.includes('__tests__') ||
    norm.includes('/test/') ||
    norm.includes('/tests/') ||
    norm.endsWith('.test.ts') ||
    norm.endsWith('.test.tsx') ||
    norm.endsWith('.test.js') ||
    norm.endsWith('.test.jsx') ||
    norm.endsWith('.spec.ts') ||
    norm.endsWith('.spec.tsx') ||
    norm.endsWith('.spec.js') ||
    norm.endsWith('.spec.jsx')
  );
}

// ----------------------------------------------------
// Regla 1: Sin imports subpath (@sportcomplex/[^/]+/src/)
// Alcance: apps/web/**, packages/*/src/**
// Excluye: tests
// ----------------------------------------------------
function checkRule1(relPath: string, content: string): Finding[] {
  const norm = normalizePath(relPath);
  // tsconfig/lockfiles mapean subpaths como texto: no son imports de código.
  if (norm.endsWith('.json')) return [];
  const inScope =
    norm.startsWith('apps/web/') ||
    /^packages\/[^/]+\/src\//.test(norm);

  if (!inScope || isTestFile(norm)) {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split('\n');
  const subpathRegex = /@sportcomplex\/[^/]+\/src\//;

  lines.forEach((line, idx) => {
    if (subpathRegex.test(line)) {
      findings.push({
        ruleId: 1,
        ruleName: 'Sin imports subpath',
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
      });
    }
  });

  return findings;
}

// ----------------------------------------------------
// Regla 2: Sin mock en prod
// Patrón: catalogoInicial|cuentasEjemplo|franjasPorDefecto|reservasIniciales
// Alcance: apps/web/src/**, packages/*/src/**
// Excluye: __tests__, *.test.*, db/test/mocks
// ----------------------------------------------------
function checkRule2(relPath: string, content: string): Finding[] {
  const norm = normalizePath(relPath);
  const inScope =
    norm.startsWith('apps/web/src/') ||
    /^packages\/[^/]+\/src\//.test(norm);

  if (!inScope) return [];

  // Excluye: __tests__, *.test.*, db/test/mocks
  if (
    norm.includes('__tests__') ||
    /\.test\.[^/]+$/.test(norm) ||
    norm.includes('db/test/mocks') ||
    norm.includes('packages/db/test/mocks')
  ) {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split('\n');
  const mockRegex = /\b(catalogoInicial|cuentasEjemplo|franjasPorDefecto|reservasIniciales)\b/;

  lines.forEach((line, idx) => {
    if (mockRegex.test(line)) {
      findings.push({
        ruleId: 2,
        ruleName: 'Sin mock en prod',
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
      });
    }
  });

  return findings;
}

// ----------------------------------------------------
// Regla 3: Sin Unsplash (images\.unsplash\.com)
// Alcance: packages/**, apps/web/src/**
// Excluye: —
// ----------------------------------------------------
function checkRule3(relPath: string, content: string): Finding[] {
  const norm = normalizePath(relPath);
  const inScope =
    norm.startsWith('packages/') ||
    norm.startsWith('apps/web/src/');

  if (!inScope) return [];

  const findings: Finding[] = [];
  const lines = content.split('\n');
  const unsplashRegex = /images\.unsplash\.com/;

  lines.forEach((line, idx) => {
    if (unsplashRegex.test(line)) {
      findings.push({
        ruleId: 3,
        ruleName: 'Sin Unsplash',
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
      });
    }
  });

  return findings;
}

// ----------------------------------------------------
// Regla 4: Sin any en prod (\bany\b)
// Alcance: packages/*/src/**, apps/web/src/**
// Excluye: tests, mock-prisma.ts, db/test/mocks/**
// ----------------------------------------------------
function checkRule4(relPath: string, content: string): Finding[] {
  const norm = normalizePath(relPath);
  const inScope =
    norm.startsWith('apps/web/src/') ||
    /^packages\/[^/]+\/src\//.test(norm);

  if (!inScope) return [];

  if (
    isTestFile(norm) ||
    norm.endsWith('mock-prisma.ts') ||
    norm.includes('db/test/mocks') ||
    norm.includes('packages/db/test/mocks')
  ) {
    return [];
  }

  // Solo archivos de código typescript/javascript
  if (!/\.(ts|tsx|js|jsx)$/.test(norm) || norm.endsWith('.d.ts')) {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Si la línea es puramente un comentario, ignorar
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    // Buscamos patrones típicos de TypeScript `any`
    // : any, : any[], <any>, as any, Promise<any>, Array<any>, Record<..., any>
    // Evitamos falsos positivos como "company", "many", "anything", "anyOf"
    const hasAnyType =
      /(:\s*any\b)|(\bas\s+any\b)|(<any[>,])|([<,\s]any>)|(Record<[^,]+,\s*any>)|(\bany\[\])/.test(line) ||
      /\bany\b/.test(line);

    // Verificamos si realmente contiene la palabra any fuera de strings si es posible,
    // o con la regla \bany\b especificada en el requerimiento
    if (/\bany\b/.test(line)) {
      // Filtrar directivas de eslint o comentarios inline que deshabilitan reglas
      if (line.includes('eslint-disable') && line.includes('no-explicit-any')) {
        return;
      }
      findings.push({
        ruleId: 4,
        ruleName: 'Sin any en prod',
        file: relPath,
        line: idx + 1,
        snippet: trimmed,
      });
    }
  });

  return findings;
}

// ----------------------------------------------------
// Regla 5: Sin dependencias circulares en domain
// Regla: domain ← application|db|security
// Alcance: paquetes/archivos de domain o imports hacia domain
// ----------------------------------------------------
function checkRule5(relPath: string, content: string): Finding[] {
  const norm = normalizePath(relPath);
  const findings: Finding[] = [];

  // 1) Si estamos en domain (packages/domain/** o packages/core/src/domain/**),
  // no debe importar de application, db, security o capas superiores.
  const isDomainFile =
    norm.startsWith('packages/domain/') ||
    norm.startsWith('packages/core/src/domain/');

  if (isDomainFile) {
    const lines = content.split('\n');
    const prohibitedInDomain = /from\s+['"][^'"]*(application|db|security|integrations|services|ui|web)/i;
    lines.forEach((line, idx) => {
      if (prohibitedInDomain.test(line)) {
        findings.push({
          ruleId: 5,
          ruleName: 'Sin dependencias circulares en domain',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  return findings;
}

// ----------------------------------------------------
// Regla 6: Solo path aliases en apps/web (sin imports relativos)
// Patrón: from "@/... o import("@/..., @db-test/...; prohibido ./ y ../
// Alcance: apps/web/src/**
// Excluye: — (tests incluidos: TODO usa aliases)
// Nota: packages/* conservan relativos internos porque tsc no reescribe
// aliases en el emit ESM de dist/ (moduleResolution Bundler sin bundler).
// ----------------------------------------------------
function checkRule6(relPath: string, content: string): Finding[] {
  const norm = normalizePath(relPath);
  if (!norm.startsWith('apps/web/src/')) return [];
  if (!/\.(ts|tsx|js|jsx)$/.test(norm)) return [];

  const findings: Finding[] = [];
  const lines = content.split('\n');
  const relativeRegex = /(?:import|export)[^'"]*?from\s*['"]\.[./]|import\s*\(\s*['"]\.[./]/;

  lines.forEach((line, idx) => {
    if (relativeRegex.test(line)) {
      findings.push({
        ruleId: 6,
        ruleName: 'Solo path aliases en apps/web',
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
      });
    }
  });

  return findings;
}

function run(): void {
  const options = parseArgs();
  console.log('='.repeat(70));
  console.log('   SPORTCOMPLEX: VERIFICADOR DE LÍMITES ARQUITECTÓNICOS');
  console.log('='.repeat(70));

  let candidateFiles: string[] = [];

  if (options.scope) {
    const normScope = normalizePath(options.scope);
    console.log(`Modo: Alcance específico (--scope ${normScope})`);
    candidateFiles = getAllFiles(normScope).filter((f) =>
      /\.(ts|tsx|js|jsx|json|mjs|mts)$/.test(f)
    );
  } else if (options.changed) {
    console.log('Modo: Archivos modificados en git (--changed)');
    const changed = getChangedFiles();
    candidateFiles = changed.filter((f) => {
      const full = path.resolve(ROOT_DIR, f);
      return fs.existsSync(full) && fs.statSync(full).isFile() && /\.(ts|tsx|js|jsx|json|mjs|mts)$/.test(f);
    });
  } else {
    console.log('Modo: Todo el monorepo (--all)');
    const targets = ['apps', 'packages', 'scripts'];
    for (const target of targets) {
      candidateFiles = candidateFiles.concat(
        getAllFiles(target).filter((f) => /\.(ts|tsx|js|jsx|json|mjs|mts)$/.test(f))
      );
    }
  }

  console.log(`Archivos analizados: ${candidateFiles.length}\n`);

  const allFindings: Finding[] = [];

  for (const relFile of candidateFiles) {
    const fullPath = path.resolve(ROOT_DIR, relFile);
    if (!fs.existsSync(fullPath)) continue;

    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const f1 = checkRule1(relFile, content);
    const f2 = checkRule2(relFile, content);
    const f3 = checkRule3(relFile, content);
    const f4 = checkRule4(relFile, content);
    const f5 = checkRule5(relFile, content);
    const f6 = checkRule6(relFile, content);

    allFindings.push(...f1, ...f2, ...f3, ...f4, ...f5, ...f6);
  }

  // Agrupar conteo por regla
  const counts: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  const ruleTitles: Record<number, string> = {
    1: 'Regla 1: Sin imports subpath (@sportcomplex/[^/]+/src/)',
    2: 'Regla 2: Sin mock en prod (catalogoInicial|cuentasEjemplo...)',
    3: 'Regla 3: Sin Unsplash (images.unsplash.com)',
    4: 'Regla 4: Sin any en prod (\\bany\\b)',
    5: 'Regla 5: Sin dependencias circulares en domain',
    6: 'Regla 6: Solo path aliases en apps/web (@/, @db-test/)',
  };

  for (const f of allFindings) {
    counts[f.ruleId] = (counts[f.ruleId] || 0) + 1;
  }

  if (allFindings.length > 0) {
    console.log('DETALLE DE INFRACCIONES ENCONTRADAS:');
    console.log('-'.repeat(70));
    for (const f of allFindings) {
      console.log(`[R${f.ruleId}] ${f.file}:${f.line}`);
      console.log(`     Línea: ${f.snippet}`);
    }
    console.log('-'.repeat(70));
  }

  console.log('\nRESUMEN DE VERIFICACIÓN POR REGLA:');
  console.log('-'.repeat(70));
  for (let r = 1; r <= 6; r++) {
    const count = counts[r] || 0;
    const status = count === 0 ? '✓ OK' : `✗ ${count} infracción(es)`;
    console.log(` ${status.padEnd(20)} | ${ruleTitles[r]}`);
  }
  console.log('-'.repeat(70));
  console.log(`Total de infracciones: ${allFindings.length}`);

  if (allFindings.length > 0) {
    console.log('\n❌ Fallo la verificación de límites arquitectónicos.\n');
    process.exit(1);
  } else {
    console.log('\n✅ Todos los límites arquitectónicos pasaron la verificación exitosamente.\n');
    process.exit(0);
  }
}

run();
