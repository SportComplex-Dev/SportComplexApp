import { Project, Node, ExportedDeclarations } from 'ts-morph';
import * as path from 'node:path';
import * as fs from 'node:fs';

const PACKAGES = [
  'ui',
  'shared',
  'features/booking',
  'features/tournament',
  'features/pos',
  'features/scanner',
  'features/portal',
  'features/admin',
  'domain',
  'seed',
  'application',
  'security',
  'db',
  'validation',
  'core',
];

interface PackageStats {
  pkg: string;
  documented: number;
  total: number;
  percentage: number;
}

function hasJsDocDocumentation(decl: ExportedDeclarations): boolean {
  if (Node.isJSDocable(decl)) {
    return decl.getJsDocs().length > 0;
  }

  if (Node.isVariableDeclaration(decl)) {
    const varStatement = decl.getVariableStatement();
    if (varStatement && Node.isJSDocable(varStatement)) {
      return varStatement.getJsDocs().length > 0;
    }
  }

  return false;
}

function checkDocs(): void {
  const rootDir = path.resolve(__dirname, '..');

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      jsx: 1, // JsxEmit.Preserve
      moduleResolution: 2, // ModuleResolutionKind.NodeJs
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    },
  });

  const results: PackageStats[] = [];
  let globalTotal = 0;
  let globalDocumented = 0;

  for (const pkg of PACKAGES) {
    const entryPath = path.resolve(rootDir, 'packages', pkg, 'src', 'index.ts');

    if (!fs.existsSync(entryPath)) {
      console.warn(`[WARN] Entry file not found: ${entryPath}`);
      results.push({
        pkg,
        documented: 0,
        total: 0,
        percentage: 0,
      });
      continue;
    }

    const sourceFile = project.addSourceFileAtPath(entryPath);
    const exportedDeclarations = sourceFile.getExportedDeclarations();

    let pkgTotal = 0;
    let pkgDocumented = 0;

    for (const [, declarations] of exportedDeclarations) {
      for (const decl of declarations) {
        const filePath = decl.getSourceFile().getFilePath();

        // Skip test files (*.test.*) and __tests__
        if (filePath.includes('.test.') || filePath.includes('__tests__')) {
          continue;
        }

        pkgTotal++;
        if (hasJsDocDocumentation(decl)) {
          pkgDocumented++;
        }
      }
    }

    const percentage = pkgTotal > 0 ? (pkgDocumented / pkgTotal) * 100 : 0;
    results.push({
      pkg,
      documented: pkgDocumented,
      total: pkgTotal,
      percentage,
    });

    globalTotal += pkgTotal;
    globalDocumented += pkgDocumented;
  }

  // Per-package table
  console.log('\n===============================================================');
  console.log('                 JSDoc Documentation Coverage                  ');
  console.log('===============================================================');
  console.log(
    'Package'.padEnd(25) +
    'Documented'.padStart(12) +
    'Total'.padStart(10) +
    'Coverage'.padStart(12)
  );
  console.log('---------------------------------------------------------------');

  for (const row of results) {
    const coverageStr = `${row.percentage.toFixed(1)}%`;
    console.log(
      row.pkg.padEnd(25) +
      row.documented.toString().padStart(12) +
      row.total.toString().padStart(10) +
      coverageStr.padStart(12)
    );
  }

  console.log('===============================================================');

  const globalPercentage = globalTotal > 0 ? (globalDocumented / globalTotal) * 100 : 0;
  const coverageReport = `Doc coverage: ${globalPercentage.toFixed(1)}% (${globalDocumented}/${globalTotal})`;
  console.log(coverageReport);

  const COVERAGE_THRESHOLD = 0.8;
  const globalRatio = globalTotal > 0 ? globalDocumented / globalTotal : 0;

  if (globalRatio < COVERAGE_THRESHOLD) {
    console.error(
      `\n[FAILED] Global documentation coverage is below 80.0% gate (Target: 80.0%, Current: ${globalPercentage.toFixed(1)}%).`
    );
    process.exit(1);
  }

  console.log('\n[PASSED] Documentation coverage gate met (>= 80.0%).');
  process.exit(0);
}

checkDocs();
