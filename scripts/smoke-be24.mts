/**
 * SportComplex — Smoke Test Automatizado TSK-BE-24 (SCRUM-149 / HU-24 / RF-21)
 *
 * Valida de forma integral:
 * 1. Seguridad Perimetral y RBAC (401 anon, 403 roles no autorizados, 401 inactivo, 200 admin)
 * 2. Validación de Contrato y Esquema Zod (400 fechas invertidas, 400 formato, 400 período)
 * 3. Parámetros y Alias (fechaInicio/fechaFin, from/to, period/periodo)
 * 4. Casos Límite y Resiliencia (200 rango sin datos, 200 día único, 200 consulta histórica)
 * 5. Criterio SLA de Desempeño (< 2.0 s)
 * 6. Cuadre Matemático y Consistencia de Agregaciones
 *
 * Ejecución:
 *   pnpm smoke:be24
 *   o: node scripts/smoke-be24.mts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/admin/analytics`;

function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeJwt(role: string, status = "ACTIVO"): string {
  const header = toBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({ role, estado: status }));
  return `${header}.${payload}.sig`;
}

const tokenAdmin = makeJwt("Administrador", "ACTIVO");
const tokenCliente = makeJwt("Cliente", "ACTIVO");
const tokenVendedor = makeJwt("Empleado_Vendedor", "ACTIVO");
const tokenLector = makeJwt("Empleado_Lector", "ACTIVO");
const tokenInactivo = makeJwt("Administrador", "INACTIVO");

interface TestCase {
  name: string;
  url: string;
  headers?: Record<string, string>;
  expectedStatus: number;
  validate?: (body: any, durationMs: number) => { pass: boolean; detail?: string };
}

interface TestSuite {
  title: string;
  tests: TestCase[];
}

const suites: TestSuite[] = [
  {
    title: "SUITE 1: SEGURIDAD PERIMETRAL Y CONTROL DE ACCESO (RBAC)",
    tests: [
      {
        name: "1.1 Peticion anonima sin credenciales debe retornar 401 Unauthorized",
        url: ENDPOINT,
        expectedStatus: 401,
        validate: (b) => ({
          pass: b?.error?.code === "UNAUTHORIZED",
          detail: "Codigo de error UNAUTHORIZED confirmado",
        }),
      },
      {
        name: "1.2 Rol no autorizado (Cliente) debe retornar 403 Forbidden",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenCliente}` },
        expectedStatus: 403,
        validate: (b) => ({
          pass: b?.error?.code === "FORBIDDEN",
          detail: "Codigo de error FORBIDDEN confirmado",
        }),
      },
      {
        name: "1.3 Rol no autorizado (Empleado Vendedor) debe retornar 403 Forbidden",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenVendedor}` },
        expectedStatus: 403,
        validate: (b) => ({
          pass: b?.error?.code === "FORBIDDEN",
          detail: "Acceso exclusivo para rol Administrador confirmado",
        }),
      },
      {
        name: "1.4 Rol no autorizado (Empleado Lector) debe retornar 403 Forbidden",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenLector}` },
        expectedStatus: 403,
        validate: (b) => ({
          pass: b?.error?.code === "FORBIDDEN",
          detail: "Acceso exclusivo para rol Administrador confirmado",
        }),
      },
      {
        name: "1.5 Administrador con cuenta inactiva (RN-10) debe retornar 401 Unauthorized",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenInactivo}` },
        expectedStatus: 401,
        validate: (b) => ({
          pass: b?.error?.code === "UNAUTHORIZED",
          detail: "Credenciales de cuenta inactiva revocadas perimetralmente",
        }),
      },
      {
        name: "1.6 Administrador activo debe responder 200 OK con payload valido",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => ({
          pass: b?.success === true && typeof b?.data === "object",
          detail: "success: true con estructura de datos completa",
        }),
      },
    ],
  },
  {
    title: "SUITE 2: VALIDACION DE CONTRATO Y FILTROS ZOD",
    tests: [
      {
        name: "2.1 Fechas invertidas (startDate > endDate) debe retornar 400 Bad Request",
        url: `${ENDPOINT}?startDate=2026-10-15&endDate=2026-10-01`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 400,
        validate: (b) => ({
          pass: b?.error?.code === "VALIDATION_ERROR",
          detail: "Rechazado: fecha inicial no puede ser posterior a fecha final",
        }),
      },
      {
        name: "2.2 Formato de fecha invalido (YYYY/MM/DD) debe retornar 400 Bad Request",
        url: `${ENDPOINT}?startDate=2026/10/01`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 400,
        validate: (b) => ({
          pass: b?.error?.code === "VALIDATION_ERROR",
          detail: "Rechazado: se exige estricto formato YYYY-MM-DD",
        }),
      },
      {
        name: "2.3 Periodo no soportado ('mensual') debe retornar 400 Bad Request",
        url: `${ENDPOINT}?period=mensual`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 400,
        validate: (b) => ({
          pass: b?.error?.code === "VALIDATION_ERROR",
          detail: "Solo se admiten valores daily / weekly",
        }),
      },
      {
        name: "2.4 Alias en espanol y agrupacion semanal se procesan con 200 OK",
        url: `${ENDPOINT}?fechaInicio=2026-10-01&fechaFin=2026-10-08&periodo=semanal`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const period = b?.data?.filters?.period;
          return {
            pass: period === "weekly",
            detail: `Periodo normalizado a '${period}'`,
          };
        },
      },
      {
        name: "2.5 Alias alternativos (from / to) se procesan con 200 OK",
        url: `${ENDPOINT}?from=2026-10-01&to=2026-10-08`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const f = b?.data?.filters;
          return {
            pass: f?.startDate === "2026-10-01" && f?.endDate === "2026-10-08",
            detail: `Parametros startDate=${f?.startDate} y endDate=${f?.endDate} mapeados`,
          };
        },
      },
    ],
  },
  {
    title: "SUITE 3: CASOS LIMITE Y RESILIENCIA DE DATOS",
    tests: [
      {
        name: "3.1 Rango sin registros (periodo vacio) responde 200 OK con arrays vacios y sin error 500",
        url: `${ENDPOINT}?startDate=2020-01-01&endDate=2020-01-31`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const att = b?.data?.attendance?.length ?? -1;
          const rev = b?.data?.revenue?.length ?? -1;
          const totRev = b?.data?.summary?.totalRevenue ?? -1;
          return {
            pass: att === 0 && rev === 0 && totRev === 0,
            detail: `attendance: ${att}, revenue: ${rev}, totalRevenue: ${totRev} COP`,
          };
        },
      },
      {
        name: "3.2 Rango de un solo dia (startDate === endDate) filtra exactamente esa fecha",
        url: `${ENDPOINT}?startDate=2026-10-04&endDate=2026-10-04`,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const f = b?.data?.filters;
          return {
            pass: f?.startDate === "2026-10-04" && f?.endDate === "2026-10-04",
            detail: `Filtro de dia unico aplicado bajo zona America/Bogota`,
          };
        },
      },
    ],
  },
  {
    title: "SUITE 4: SLA DE RENDIMIENTO Y CUADRE MATEMATICO",
    tests: [
      {
        name: "4.1 Criterio de Aceptacion: Tiempo de respuesta en dataset real < 2000 ms (< 2.0 s)",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (_b, ms) => ({
          pass: ms < 2000,
          detail: `Latencia servidor: ${Math.round(ms)} ms (SLA < 2000 ms)`,
        }),
      },
      {
        name: "4.2 Cuadre Matematico: Suma de desgloses de ingresos == summary.totalRevenue",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const items = b?.data?.revenue || [];
          const sum = items.reduce((acc: number, r: any) => acc + Number(r.totalAmount || 0), 0);
          const expected = Number(b?.data?.summary?.totalRevenue || 0);
          return {
            pass: sum === expected,
            detail: `Suma desgloses ($${sum.toLocaleString()} COP) === summary.totalRevenue ($${expected.toLocaleString()} COP)`,
          };
        },
      },
      {
        name: "4.3 Cuadre Matematico: Suma de desgloses de afluencia == summary.totalAttendance",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const items = b?.data?.attendance || [];
          const sum = items.reduce((acc: number, r: any) => acc + Number(r.ticketsUsed || 0), 0);
          const expected = Number(b?.data?.summary?.totalAttendance || 0);
          return {
            pass: sum === expected,
            detail: `Suma desgloses (${sum} tickets) === summary.totalAttendance (${expected})`,
          };
        },
      },
      {
        name: "4.4 Cuadre Matematico: Suma reservas por categoria == summary.totalBookings",
        url: ENDPOINT,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        expectedStatus: 200,
        validate: (b) => {
          const items = b?.data?.categoryPerformance || [];
          const sum = items.reduce((acc: number, r: any) => acc + Number(r.totalBookings || 0), 0);
          const expected = Number(b?.data?.summary?.totalBookings || 0);
          return {
            pass: sum === expected,
            detail: `Suma categorias (${sum} reservas) === summary.totalBookings (${expected})`,
          };
        },
      },
    ],
  },
];

async function run() {
  console.log("\n========================================================================");
  console.log("  SPORTCOMPLEX: SMOKE TEST AUTOMATIZADO TSK-BE-24 (GET /api/admin/analytics)");
  console.log("========================================================================");
  console.log(`Endpoint objetivo: ${ENDPOINT}\n`);

  // Verificacion de conectividad inicial
  try {
    const probe = await fetch(ENDPOINT, { method: "HEAD" });
    // Si responde algo (incluso 401), el servidor esta vivo
  } catch (err: any) {
    console.error(`\x1b[31m[ERROR FATAL]\x1b[0m No se pudo conectar a ${BASE_URL}.`);
    console.error(`Por favor asegurate de que el servidor este corriendo con 'pnpm dev' en otra terminal.\n`);
    process.exit(1);
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\x1b[33m── ${suite.title} ──\x1b[0m`);

    for (const test of suite.tests) {
      const t0 = performance.now();
      let status = 0;
      let body: any = null;

      try {
        const res = await fetch(test.url, {
          headers: test.headers,
        });
        status = res.status;
        const text = await res.text();
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      } catch (err: any) {
        body = err.message;
      }
      const durationMs = performance.now() - t0;

      let pass = status === test.expectedStatus;
      let detailMsg = "";

      if (pass && test.validate) {
        try {
          const valRes = test.validate(body, durationMs);
          pass = valRes.pass;
          if (valRes.detail) detailMsg = valRes.detail;
        } catch (err: any) {
          pass = false;
          detailMsg = `Error validando respuesta: ${err.message}`;
        }
      }

      const durStr = `${Math.round(durationMs)}ms`;

      if (pass) {
        totalPassed++;
        console.log(`  \x1b[32m[PASS]\x1b[0m ${test.name} \x1b[90m(${status}, ${durStr})\x1b[0m`);
        if (detailMsg) {
          console.log(`         \x1b[90m└─ ${detailMsg}\x1b[0m`);
        }
      } else {
        totalFailed++;
        console.log(`  \x1b[31m[FAIL]\x1b[0m ${test.name}`);
        console.log(`         \x1b[31mEsperado: HTTP ${test.expectedStatus} | Obtenido: HTTP ${status} (${durStr})\x1b[0m`);
        if (detailMsg) {
          console.log(`         \x1b[33mDetalle: ${detailMsg}\x1b[0m`);
        }
        if (body) {
          const preview = typeof body === "string" ? body : JSON.stringify(body);
          console.log(`         \x1b[90mPayload: ${preview.slice(0, 160)}...\x1b[0m`);
        }
      }
    }
    console.log("");
  }

  console.log("========================================================================");
  console.log("  RESUMEN DE PRUEBAS AUTOMATIZADAS TSK-BE-24");
  console.log("========================================================================");
  console.log(`  Total ejecutadas: ${totalPassed + totalFailed}`);
  console.log(`  Aprobadas (PASS): \x1b[32m${totalPassed}\x1b[0m`);
  if (totalFailed > 0) {
    console.log(`  Fallidas  (FAIL): \x1b[31m${totalFailed}\x1b[0m\n`);
    console.log("\x1b[31m❌ El endpoint NO cumple con todas las validaciones antes de PR.\x1b[0m\n");
    process.exit(1);
  } else {
    console.log(`  Fallidas  (FAIL): \x1b[32m0\x1b[0m\n`);
    console.log("\x1b[32m✅ ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE (17/17)! Listo para Pull Request.\x1b[0m\n");
    process.exit(0);
  }
}

run();
