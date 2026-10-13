# Reporte de Code Review Exhaustivo — Pull Request #46 (Revisión de Correcciones)

**Título:** `feat(admin): SC-141 administración de empleados y roles y SC-148 dashboard gerencial`  
**Rama de origen:** `feature/tsk-fe-21-23-admin-dashboard`  
**Rama base:** `origin/develop` (`d253ae9`)  
**Commit evaluado:** `8033265d9d5499034a1dad3c4959b5f2a7376682` (`8033265d`)  
**Commits de corrección analizados:** `59e8542` (*fix observaciones SEC-01..03, UI-01..03, TST-01*) y `8033265` (*merge develop*)  
**Commit previo auditado:** `45ea7652d6ab765566b033531ca7ba4a58997676` (`45ea765`)  
**Autor:** `smendozab097 <sebas.mb12@gmail.com>`  
**Fecha de revisión:** 12 de Octubre de 2026  
**Revisor:** Antigravity AI Senior Code Reviewer  
**Veredicto General:** ✅ **APROBADO CON OBSERVACIONES MENORES (APPROVE WITH MINOR COMMENTS)** — Los bloqueantes críticos de seguridad (SEC-01, SEC-02, SEC-03), la funcionalidad simulada en UI (UI-01, UI-02, UI-03), el desfase horario (COD-02) y la cobertura de pruebas de repositorio (TST-01) han sido satisfactoriamente resueltos y verificados contra la suite automatizada (122 tests pasando al 100% y build de producción Turbopack exitoso). Los aspectos pendientes corresponden a deuda técnica de mantenibilidad (modularización de monolitos frontend, tipado estricto `AnyDb`) y optimizaciones no bloqueantes para el despliegue.

---

## Índice

1. [Resumen Ejecutivo y Dictamen Actualizado](#1-resumen-ejecutivo-y-dictamen-actualizado)
2. [Tabla de Estado de Hallazgos Previos](#2-tabla-de-estado-de-hallazgos-previos)
3. [Matriz Consolidada de Hallazgos Actuales](#3-matriz-consolidada-de-hallazgos-actuales)
4. [Análisis de Regresiones y Hallazgos Nuevos](#4-análisis-de-regresiones-y-hallazgos-nuevos)
5. [Dimensión 1: Arquitectura y Patrones de Diseño](#5-dimensión-1-arquitectura-y-patrones-de-diseño)
6. [Dimensión 2: Calidad del Código y Mejores Prácticas](#6-dimensión-2-calidad-del-código-y-mejores-prácticas)
7. [Dimensión 3: Seguridad y Validación de Entrada](#7-dimensión-3-seguridad-y-validación-de-entrada)
8. [Dimensión 4: Tests y Cobertura](#8-dimensión-4-tests-y-cobertura)
9. [Dimensión 5: Performance y Escalabilidad](#9-dimensión-5-performance-y-escalabilidad)
10. [Dimensión 6: Documentación y Trazabilidad](#10-dimensión-6-documentación-y-trazabilidad)
11. [Plan de Acción y Recomendaciones Post-Merge](#11-plan-de-acción-y-recomendaciones-post-merge)

---

## 1. Resumen Ejecutivo y Dictamen Actualizado

El presente reporte audita el estado consolidado de la rama `feature/tsk-fe-21-23-admin-dashboard` en su HEAD `8033265d` frente a `origin/develop`, evaluando las correcciones introducidas por el autor en el commit `59e8542` y la posterior sincronización con la rama base en `8033265`.

### 1.1. Evaluación de las Correcciones
El autor atendió con celeridad y eficacia los riesgos más severos identificados en la revisión inicial del 11 de Octubre de 2026:
- **Erradicación de Datos Simulados en Fallos (SEC-01):** Se suprimió la inyección de datos mock ante errores de red o servidor en `/admin/dashboard` y `/admin/employees`. En su lugar, se implementó un manejo de errores explícito (`fetchError`), vaciado seguro de estados y banners interactivos de alerta con botón de *"Reintentar"*.
- **Integridad y Concurrencia en Altas (SEC-02):** Se homogeneizó la sanitización del correo (`.trim().toLowerCase()`) antes de las consultas de existencia y se interceptó el error de restricción única de Prisma (`P2002`), garantizando que colisiones concurrentes siempre devuelvan HTTP 409 (`EMAIL_ALREADY_EXISTS`) en lugar de HTTP 500.
- **Protección del Catálogo de Roles (SEC-03):** Se eliminó por completo la invocación a `db.rol.create` en `createEmployee`. La solicitud de roles inexistentes ahora es rechazada con HTTP 400 (`ROLE_NOT_FOUND`).
- **Exportación CSV Real (UI-01):** El botón de *"Exportar informe"* dejó de ser un placebo visual; ahora genera en memoria un archivo CSV con cabeceras, codificación UTF-8 con BOM (`\uFEFF`), escape de comillas y descarga automática del fichero `informe-operacion-[fechas].csv`.
- **Protección de Bajas Administrativas (UI-02):** Se condicionó la acción *"Dar de baja"* en la tabla de empleados para omitirse en filas con rol administrativo, desplegando un distintivo textual *"Administrador"*, evitando la llamada fallida que provocaba un 404 en el backend.
- **Gráficos de Alta Precisión (UI-03):** Se rectificó el cálculo de barras para valores nulos, graficando una altura del 0% cuando las asistencias o los ingresos son cero, eliminando la barra artificial del 8%.
- **Corrección de Zona Horaria (COD-02):** Se introdujo la utilidad `getBogotaDateString` basada en `Intl.DateTimeFormat` con zona horaria `America/Bogota` (UTC-5), erradicando el desfase *off-by-one* provocado por `toISOString()`.
- **Batería de Pruebas Unitarias de Repositorio (TST-01):** Se incorporaron 4 pruebas unitarias formales en `packages/db/src/repositories/employees.test.ts` con cobertura específica de ordenamiento, normalización, rechazo de duplicados y rechazo de roles inválidos.

### 1.2. Deuda Técnica Remanente (No Bloqueante)
Persisten observaciones de índole arquitectural y de mantenibilidad:
- Los componentes de página continúan siendo monolíticos (632 y 607 líneas) sin extracción a subcomponentes modulares (**ARC-01**).
- Persiste la declaración relajada `type AnyDb = any` en el repositorio de empleados (**COD-01**).
- Cero pruebas de componentes frontend con React Testing Library (**TST-02**).
- Consulta `listEmployees` sin paginación cursor/offset (**PERF-01**).
- Desincronización latente con Supabase Auth si dicho proveedor fuese activado (**SEC-04**).

### 1.3. Dictamen
**ESTADO: APROBADO PARA MERGE (APPROVE).**  
Los criterios de aceptación funcionales de **SC-141** (RF-18 / RN-10) y **SC-148** (RF-21 / RNF-04) se encuentran satisfechos, sin regresiones funcionales ni vulnerabilidades de severidad crítica/alta activas. La suite de pruebas ejecuta **122/122 pruebas exitosas** y el empaquetado de producción con Turbopack finaliza sin errores. Las observaciones restantes pueden gestionarse como deuda técnica planificada en el backlog.

---

## 2. Tabla de Estado de Hallazgos Previos

A continuación se detalla la trazabilidad exhaustiva de cada uno de los 15 hallazgos registrados en la revisión anterior contra el código actual en HEAD (`8033265d`):

| ID | Dimensión | Severidad Original | Archivo / Componente | Descripción del Hallazgo Previo | Estado Actual | Evidencia Concreta en Código (Commit 8033265d) |
|---|---|:---:|---|---|:---:|---|
| **SEC-01** | Seguridad | 🔴 Crítico | `AdminEmployeesPage` / `AdminDashboardPage` | Fallback silencioso a datos mock en producción ante fallos de red o 401/403/500, exponiendo datos ficticios. | ✅ **RESUELTO** | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` (L129-144, L309-327) y `apps/web/src/app/(admin)/admin/employees/page.tsx` (L68-80, L239-257): Se eliminaron los mocks. Ante fallo se ejecuta `setData(null)` o `setEmployees([])`, activando el estado `fetchError` y un banner con botón `Reintentar`. |
| **SEC-02** | Seguridad | 🟠 Alto | `createEmployee` (`employees.ts`) | Condición de carrera (TOCTOU) y error Prisma `P2002` no capturado (500 en lugar de 409); inconsistencia en sanitización de correo. | ✅ **RESUELTO** | `packages/db/src/repositories/employees.ts` (L100-113, L139-175): Se normaliza `normalizedEmail = data.correo.trim().toLowerCase()` antes de consultar e insertar. Bloque `try/catch` captura `err.code === "P2002"` lanzando `EmployeeError("...", "EMAIL_ALREADY_EXISTS", 409)`. Testeado en `employees.test.ts` (L73-101). |
| **SEC-03** | Seguridad | 🟠 Alto | `packages/db/src/repositories/employees.ts` | Creación dinámica en caliente de roles no autorizados (`db.rol.create`) cuando el rol solicitado no existía. | ✅ **RESUELTO** | `packages/db/src/repositories/employees.ts` (L131-137): Se eliminó `db.rol.create`. Si el rol no existe, arroja `EmployeeError("...", "ROLE_NOT_FOUND", 400)`. `mock-prisma.ts` (L1110-1117) retorna `null`. Testeado en `employees.test.ts` (L103-122). |
| **SEC-04** | Seguridad | 🟡 Medio | `apps/web/src/app/api/admin/employees/route.ts` | Desincronización con Supabase Auth si `isSupabaseAuthConfigured() === true`: usuarios creados en `public.usuario` no se crean en `auth.users`. | ⏳ **PENDIENTE** | `apps/web/src/app/api/admin/employees/route.ts` (L56-61): Solo inserta en Postgres local mediante Prisma. Si se activa Supabase Auth, el nuevo empleado no podrá autenticarse mediante `signInWithPassword`. |
| **UI-01** | Calidad / UX | 🔴 Crítico | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` | Botón "Exportar informe" placebo: notificaba éxito sin generar ni descargar ningún archivo CSV. | ✅ **RESUELTO** | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` (L146-184, L566): Implementada función `handleExportCsv` con formateo CSV completo, prefijo BOM `\uFEFF`, escape de comillas, Blob `text/csv`, descarga vía enlace `<a>` dinámico y `URL.revokeObjectURL`. |
| **UI-02** | Calidad / UX | 🟡 Medio | `apps/web/src/app/(admin)/admin/employees/page.tsx` | Botón "Dar de baja" visible para roles `ADMIN` y para el usuario activo, provocando error 404 del backend al pulsarse. | ✅ **RESUELTO** | `apps/web/src/app/(admin)/admin/employees/page.tsx` (L437-450): Condición `emp.rol?.nombre?.toUpperCase().includes('ADMIN') ? (<span ...>Administrador</span>) : (<button ...>Dar de baja</button>)`. Oculta el botón para cualquier colaborador con rol administrativo. |
| **UI-03** | Calidad / UX | 🟡 Medio | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` | Días con 0 asistencias o ingresos se graficaban erróneamente con barras del 8% de altura mínima. | ✅ **RESUELTO** | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` (L428, L478): Se cambió la fórmula a `item.attendance === 0 ? 0 : Math.max(4, ...)` y `item.revenue === 0 ? 0 : Math.max(4, ...)`. Altura estrictamente 0% si no hay registros. |
| **ARC-01** | Arquitectura | 🟠 Alto | `dashboard/page.tsx` y `employees/page.tsx` | Violación de SRP: componentes monolíticos de más de 615 líneas sin extracción de subcomponentes. | ⏳ **PENDIENTE** | Ambos archivos se mantienen monolíticos (`dashboard/page.tsx` con 632 líneas; `employees/page.tsx` con 607 líneas). No se crearon carpetas de componentes modulares locales. |
| **ARC-02** | Arquitectura | 🟡 Medio | Ambas páginas admin | Renderizado exclusivo en cliente (`'use client'` + `useEffect`) sin aprovechar Server Components ni streaming con Suspense. | ⏳ **PENDIENTE** | Ambas páginas inician con `'use client'` (L1) y delegan la totalidad del ciclo de vida a `useEffect` en el navegador del cliente. |
| **COD-01** | Calidad | 🟡 Medio | `packages/db/src/repositories/employees.ts` | Regresión de tipado estricto introduciendo `type AnyDb = any`. | ⏳ **PENDIENTE** | `packages/db/src/repositories/employees.ts` (L60): Mantiene `type AnyDb = any;` en los parámetros `options: { db?: AnyDb }` de las funciones de acceso a datos (L67, L97, L184). |
| **COD-02** | Calidad | 🟡 Medio | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` | Desfase horario (off-by-one) por inicializar rangos con `new Date().toISOString()` (UTC vs Colombia UTC-5). | ✅ **RESUELTO** | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` (L22-24, L90-96, L101-117): Utilidad `getBogotaDateString` empleando `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` aplicada en estado inicial y selector rápido de rangos. |
| **TST-01** | Tests | 🟠 Alto | `packages/db/src/repositories/employees.test.ts` | Cero tests unitarios o de integración en BD para `listEmployees` y `createEmployee`. | ✅ **RESUELTO** | `packages/db/src/repositories/employees.test.ts` (L11-122): Incorporados 4 tests formales: ordenamiento de `listEmployees`, alta exitosa de `createEmployee`, validación de unicidad de correo insensible a mayúsculas y rechazo de roles no existentes. |
| **TST-02** | Tests | 🟡 Medio | `apps/web/src/app/(admin)/admin/*` | Cero tests de componentes frontend para validación de filtros, modales y KPIs. | ⏳ **PENDIENTE** | No se agregaron archivos de prueba para los componentes de interfaz en `apps/web/src/app/(admin)`. |
| **PERF-01** | Rendimiento | 🟡 Medio | `listEmployees` (`employees.ts`) | Consulta no paginada (`findMany` sin límites `take`/`skip`/cursor). | ⏳ **PENDIENTE** | `packages/db/src/repositories/employees.ts` (L70-87): `findMany` continúa sin paginación en base de datos. |
| **DOC-01** | Documentación | 🟢 Bajo | `docs/` | Falta documentación técnica de arquitectura para `TSK-FE-21` y `TSK-FE-23`. | ⏳ **PENDIENTE** | No se creó documentación técnica de las tareas frontend en el directorio `docs/`. |

---

## 3. Matriz Consolidada de Hallazgos Actuales

Clasificación de los hallazgos vigentes en el código actual tras la integración de los fixes:

| ID | Dimensión | Severidad | Componente / Archivo | Resumen del Hallazgo | Estado |
|---|---|:---:|---|---|:---:|
| **ARC-01** | Arquitectura | 🟠 Alto | `dashboard/page.tsx` y `employees/page.tsx` | Páginas monolíticas de más de 600 líneas que concentran estado, fetching, modales y renderizado visual. | ⏳ Pendiente |
| **SEC-04** | Seguridad | 🟡 Medio | `apps/web/src/app/api/admin/employees/route.ts` | Falta de aprovisionamiento en Supabase Auth (`auth.users`) si dicho proveedor estuviese configurado. | ⏳ Pendiente |
| **ARC-02** | Arquitectura | 🟡 Medio | `dashboard/page.tsx` y `employees/page.tsx` | Client Components puros sin pre-renderizado SSR ni esqueletos en streaming con React Suspense. | ⏳ Pendiente |
| **COD-01** | Calidad | 🟡 Medio | `packages/db/src/repositories/employees.ts` | Persistencia de alias `type AnyDb = any` en parámetros del repositorio. | ⏳ Pendiente |
| **PERF-01** | Rendimiento | 🟡 Medio | `packages/db/src/repositories/employees.ts` | Consulta de personal no paginada (`findMany` sin `take`/`skip`). | ⏳ Pendiente |
| **TST-02** | Tests | 🟡 Medio | `apps/web/src/app/(admin)/admin/*` | Inexistencia de pruebas de integración de componentes frontend (RTL / Playwright). | ⏳ Pendiente |
| **NEW-02** | Arquitectura / Validación | 🟡 Medio | `packages/db/src/repositories/employees.ts` | `createEmployee` valida existencia de rol en DB pero no restringe a `ALL_EMPLOYEE_ROLES` a nivel de repositorio. | ⚠️ Nuevo |
| **DOC-01** | Documentación | 🟢 Bajo | `docs/` | Ausencia de archivo de especificación de tarea en `docs/TSK-FE-21-23-admin-dashboard.md`. | ⏳ Pendiente |
| **NEW-01** | Calidad / UX | 🟢 Bajo | `apps/web/src/app/(admin)/admin/dashboard/page.tsx` | Card de "Top Deporte Líder" mantiene fallback hardcodeado a `"Canchas"` si la lista de categorías está vacía. | ⚠️ Nuevo |

---

## 4. Análisis de Regresiones y Hallazgos Nuevos

Tras una inspección minuciosa del diff entre `45ea765` y `8033265d` y la ejecución de la suite de pruebas automatizadas, se concluye que **las correcciones no introdujeron regresiones funcionales ni rompieron pruebas existentes**. Los 122 tests del monorepo pasaron sin fallos. Sin embargo, se identificaron dos detalles técnicos derivados de los cambios:

### 4.1. NEW-01: Fallback Estático Residual en Tarjeta de Categoría Líder (Calidad / UX — 🟢 Bajo)
- **Ubicación:** `apps/web/src/app/(admin)/admin/dashboard/page.tsx` (L393)
- **Detalle:**  
  ```tsx
  <div className="text-xl sm:text-2xl font-black mt-3 text-purple-800 dark:text-purple-300 truncate">
    {data?.categoryPerformance[0]?.categoryName ?? 'Canchas'}
  </div>
  ```
- **Observación:** Mientras que los fallbacks de mock masivo fueron erradicados, persiste un fallback cosmético `"Canchas"`. Si el backend responde sin categorías o durante la carga con error, el indicador muestra arbitrariamente el texto `"Canchas"` en lugar de un neutral `"—"` o `"Sin datos"`.
- **Recomendación:** Sustituir por `{data?.categoryPerformance[0]?.categoryName ?? '—'}`.

### 4.2. NEW-02: `createEmployee` en Repositorio no Restringe a `ALL_EMPLOYEE_ROLES` (Arquitectura / Validación — 🟡 Medio)
- **Ubicación:** `packages/db/src/repositories/employees.ts` (L121-137)
- **Detalle:**  
  La función `createEmployee` verifica que el rol solicitado exista en la tabla `rol` (`db.rol.findFirst`), pero no valida que dicho rol pertenezca al catálogo permitido de colaboradores (`ALL_EMPLOYEE_ROLES = ["ADMIN", "ADMINISTRADOR", "VENDEDOR", ...]`):
  ```typescript
  // Si alguien pasa rolNombre: "CLIENTE", rol se encuentra en DB y se crea exitosamente
  const rol = await db.rol.findFirst({ where: { OR: [...] } });
  ```
- **Impacto:**  
  La capa de API (`createEmployeeSchema` en `auth.schema.ts`) restringe estrictamente `rolNombre` a un `z.enum` de roles operativos, por lo que el endpoint HTTP está completamente blindado. No obstante, a nivel de dominio en `@sportcomplex/db`, `createEmployee` podría permitir crear un usuario con rol `CLIENTE` si otro servicio interno lo invocara directamente.
- **Recomendación:** Agregar validación explícita en el repositorio:
  ```typescript
  if (!ALL_EMPLOYEE_ROLES.includes(targetRolNombre as any)) {
    throw new EmployeeError("El rol indicado no es un rol operativo válido.", "INVALID_EMPLOYEE_ROLE", 400);
  }
  ```

---

## 5. Dimensión 1: Arquitectura y Patrones de Diseño

### 5.1. Acoplamiento y Monolito Frontend (ARC-01)
Tanto `AdminDashboardPage` (632 líneas) como `AdminEmployeesPage` (607 líneas) continúan agrupando en un único archivo:
1. Control de estado de red (`fetchAnalytics`, `fetchEmployees`) y errores interactivos.
2. Lógica de manipulación de DOM y descarga de archivos binarios (`handleExportCsv`).
3. Estructura de modales emergentes (creación de empleado y diálogo de confirmación de baja lógica).
4. Cálculos derivados con `useMemo` (máximos para escalas de gráficos y métricas agregadas).
5. Renderizado visual de tablas de alta densidad y gráficos SVG personalizados.

**Evaluación:**  
Aunque el código es limpio y legible, la ausencia de separación modular limita la reutilización y dificulta las pruebas unitarias aisladas de UI. Se recomienda refactorizar como tarea técnica no bloqueante en el siguiente sprint:
```
apps/web/src/app/(admin)/admin/employees/
├── page.tsx                           # Contenedor orquestador
├── components/
│   ├── employee-kpi-cards.tsx         # Métricas superiores
│   ├── employee-filters.tsx           # Búsqueda y selectores
│   ├── employee-table.tsx             # Tabla y badges de estado
│   ├── employee-create-modal.tsx      # Modal de alta
│   └── employee-deactivate-modal.tsx  # Modal de confirmación (RN-10)
```

### 5.2. Estrategia de Renderizado (ARC-02)
El uso exclusivo de `'use client'` con `useEffect` provoca que el primer paint entregue un cascarón vacío al navegador antes de iniciar el ciclo asíncrono.  
Next.js App Router permite transformar la vista principal en un Server Component que obtenga los datos iniciales directamente desde los repositorios de Prisma, delegando la reactividad a subcomponentes de cliente mediante streaming con `<Suspense>`.

---

## 6. Dimensión 2: Calidad del Código y Mejores Prácticas

### 6.1. Tipado Relajado (`type AnyDb = any`) (COD-01)
En `packages/db/src/repositories/employees.ts` (L60), se mantiene:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;
```
Esto anula el tipado estricto en el parámetro `options.db` en las tres funciones del repositorio (`listEmployees`, `createEmployee`, `deactivateEmployee`). Para preservar la seguridad de tipos y alinearse con el resto de repositorios de `@sportcomplex/db`, debe utilizarse el tipo oficial de Prisma Client:
```typescript
import type { PrismaClient } from "@prisma/client";
type DbClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
```

### 6.2. Excelencia en la Descarga de CSV (UI-01)
La solución adoptada en `handleExportCsv` (`dashboard/page.tsx`, L146-184) es destacable:
- Inclusión del byte order mark `\uFEFF` para asegurar que Microsoft Excel en Windows interprete correctamente caracteres acentuados en español (tildes, eñes).
- Escapado adecuado de comillas dobles (`serv.serviceName.replace(/"/g, '""')`).
- Cálculo defensivo de tasas de redención evitando división por cero (`serv.totalSold > 0 ? ... : 0`).
- Limpieza de memoria en el ciclo de vida del navegador mediante `URL.revokeObjectURL(url)`.

### 6.3. Solución Robusta de Zona Horaria (COD-02)
La incorporación de `getBogotaDateString` (L22-24) resuelve de raíz el problema de desfase UTC reportado previamente:
```typescript
function getBogotaDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}
```
Al emplear el formato regional `'en-CA'`, la función garantiza el formato ISO `YYYY-MM-DD` evaluado estrictamente en la zona horaria legal de Colombia (`America/Bogota`, UTC-5), independientemente del huso horario en el que se encuentre el navegador del operador.

---

## 7. Dimensión 3: Seguridad y Validación de Entrada

### 7.1. Blindaje contra Carreras y Duplicados (SEC-02)
El repositorio de empleados (`packages/db/src/repositories/employees.ts`) implementa una defensa en dos tiempos ejemplar:
1. **Sanitización Anticipada:** Normaliza `normalizedEmail = data.correo.trim().toLowerCase()` al inicio de la función (L100), utilizándolo tanto en la consulta preventiva `findUnique` como en la inserción final.
2. **Control de Concurrencia a Nivel de Motor (TOCTOU):** Si dos administradores intentan registrar el mismo correo simultáneamente y ambas solicitudes superan la consulta `findUnique`, la restricción única a nivel de base de datos (`@@unique([correo])`) dispara un error Prisma `P2002`. El bloque `catch` (L161-174) traduce limpiamente este error técnico a un error de negocio `EmployeeError(..., "EMAIL_ALREADY_EXISTS", 409)`.

### 7.2. Integridad de Roles de Seguridad (SEC-03)
La eliminación de `db.rol.create` en `createEmployee` neutraliza el riesgo de inyección o creación arbitraria de roles en tiempo de ejecución. Cualquier rol no preexistente en la base de datos es rechazado con código 400 (`ROLE_NOT_FOUND`).

### 7.3. Protección de Cuentas Administrativas en Bajas (UI-02)
La inclusión de la validación:
```tsx
emp.rol?.nombre?.toUpperCase().includes('ADMIN') ? (
  <span className="text-[11px] font-medium text-[var(--subtle)] italic">
    Administrador
  </span>
) : (
  <button ... onClick={() => setDeactivatingEmployee(emp)}>Dar de baja</button>
)
```
elimina la posibilidad de que un administrador invoque accidentalmente la baja de cuentas administradoras. Esto se complementa con la salvaguarda de backend en `deactivateEmployee` (L207-209), que rechaza explícitamente cuentas que no sean `VENDEDOR` o `LECTOR` con un error 404.

### 7.4. Estado de la Sincronización con Supabase Auth (SEC-04)
El hallazgo **SEC-04** se mantiene como una observación latente: en caso de que el proyecto habilite Supabase Auth para la gestión centralizada de credenciales, el endpoint de creación de empleados necesitará invocar `supabase.auth.admin.createUser`. Dado que actualmente la aplicación opera con autenticación por credenciales locales hasheadas con Argon2id sobre Prisma, este punto no bloquea la operación actual.

---

## 8. Dimensión 4: Tests y Cobertura

### 8.1. Cobertura en `@sportcomplex/db` (TST-01)
El autor añadió 120 líneas de pruebas unitarias en `packages/db/src/repositories/employees.test.ts`, cubriendo:
1. `listEmployees retrieves employee accounts and orders by creadoEn desc`: Verifica que solo se incluyan roles de empleados y se respete el orden cronológico descendente.
2. `createEmployee registers employee with normalized email and valid role`: Verifica el alta con normalización y eliminación de espacios en blanco.
3. `createEmployee rejects duplicate emails even with different casing (SEC-02)`: Prueba deliberadamente un correo en mayúsculas `"  USUARIO@SPORTCOMPLEX.CO  "` contra un registro en minúsculas en base de datos, verificando que rechace con 409 (`EMAIL_ALREADY_EXISTS`).
4. `createEmployee rejects non-existent roles without creating them dynamically (SEC-03)`: Prueba un rol malicioso `"ROL_INEXISTENTE_HACK"`, verificando que se rechace con 400 (`ROLE_NOT_FOUND`) sin crear filas en la tabla `rol`.

### 8.2. Resultados de Ejecución Automatizada
La suite de pruebas completa del monorepo Turborepo fue ejecutada satisfactoriamente:
```
 Tasks:    9 successful, 9 total
 Cached:   1 cached, 9 total
 Tests:    122 passed, 0 failed, 122 total
```
Todas las pruebas de contratos Zod, repositorios de Prisma simulado y route handlers de Next.js pasaron al 100%.

### 8.3. Pruebas Pendientes de Frontend (TST-02)
Aún no se disponen de pruebas de componentes para `AdminDashboardPage` y `AdminEmployeesPage`. Se sugiere incorporar pruebas de integración con `@testing-library/react` para validar el comportamiento del formulario de alta, el filtrado por roles y la apertura del modal de confirmación de baja.

---

## 9. Dimensión 5: Performance y Escalabilidad

### 9.1. Paginación en `listEmployees` (PERF-01)
`packages/db/src/repositories/employees.ts` continúa realizando una consulta `findMany` sin cláusulas `take` ni `skip`.  
Para el contexto de un complejo deportivo donde la nómina operativa suele oscilar entre 10 y 50 colaboradores, el impacto actual en latencia y memoria es despreciable. No obstante, para garantizar escalabilidad a largo plazo ante personal rotativo con múltiples registros inactivos, se aconseja añadir soporte de paginación o filtrado por defecto de usuarios activos.

### 9.2. Eficiencia en Renders de Frontend
Los cálculos pesados de agregación en el dashboard (`maxRevenue`, `maxAttendance`, `stats` y `filteredEmployees`) se encuentran correctamente memorizados mediante hooks `useMemo`, previniendo cómputos innecesarios durante re-renderizados causados por inputs de texto.

---

## 10. Dimensión 6: Documentación y Trazabilidad

### 10.1. Trazabilidad en Código
El código incluye comentarios y referencias claras a las reglas de negocio **RF-18**, **RN-10**, **RNF-02**, **RF-21** y **RNF-04**.

### 10.2. Documentación de Tarea (DOC-01)
Persiste la ausencia de un documento técnico de cierre en `docs/` para `TSK-FE-21` y `TSK-FE-23`. Se recomienda añadir una breve nota técnica antes del release mayor.

---

## 11. Plan de Acción y Recomendaciones Post-Merge

Habiéndose resuelto satisfactoriamente todos los bloqueantes de severidad crítica y alta, se aprueba el Pull Request #46 para su integración en `develop`. Se sugiere al equipo abordar los siguientes puntos como tareas de refinamiento técnico en el siguiente ciclo:

### Tareas Menores Sugeridas (Post-Merge):
1. **Limpieza de Tipado en Repositorio (COD-01):**
   Reemplazar `type AnyDb = any` en `packages/db/src/repositories/employees.ts` por el tipo oficial de Prisma Client.
2. **Modularización de Componentes (ARC-01):**
   Extraer los modales de alta y baja en `apps/web/src/app/(admin)/admin/employees/components/`.
3. **Validación de Rol Operativo en Repositorio (NEW-02):**
   Añadir en `createEmployee` una aserción contra `ALL_EMPLOYEE_ROLES` para garantizar consistencia a nivel de base de datos.
4. **Placeholder en KPI de Categoría (NEW-01):**
   Sustituir el fallback estático `'Canchas'` por `'—'` cuando no existan categorías en el rango.
5. **Documentación Técnica (DOC-01):**
   Registrar la memoria de diseño en `docs/TSK-FE-21-23-admin-dashboard.md`.

---
*Reporte actualizado y verificado por Antigravity AI Senior Code Reviewer el 12 de Octubre de 2026 sobre el commit 8033265d.*
