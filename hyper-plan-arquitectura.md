# Hyper Plan de Arquitectura — SportComplexApp

**Fecha:** 2026-10-14
**Base verificada:** `origin/develop@f961ee1` (post back-merge PR #88, 0 PRs abiertos)
**Alcance:** eliminación de mock en producción, fronteras de paquetes, modularización de monolitos, migraciones BD, guardrails CI
**Convención:** todos los campos y símbolos nuevos en español camelCase (`correoAdmin`, `clienteStripeId`, `eliminadoEn`, `actualizadoEn`). El mapeo a snake_case vive solo en el borde Prisma/SQL.

---

## 0. Estado de partida (evidencia)

| Área | Estado | Evidencia |
|---|---|---|
| PRs | 0 abiertos | #77, #81, #82, #83, #84, #86, #87, #88 mergeados |
| Back-merge | Hecho | PR #88 `main→develop`, commit `f961ee1` (vía `--admin` por E2E rojo) |
| `bootstrap:prod` | Implementado | `packages/db/prisma/bootstrap-prod.ts`: idempotente, exige `contrasenaAdminSemilla`, Supabase Auth Admin API, cero datos de prueba |
| `purge:test-users` | Implementado | dry-run por defecto, `--execute` ejecuta, respeta `RESTRICT` |
| E2E `ci-headless` | Rojo | CUOTA-001: `seed.ts:131` crea torneos con `categoriaId ?? 1` inexistente en BD fresca → `P2003` |
| Deuda arquitectura | Intacta | §1–§5 de este plan |

---

## 1. Fase 1 — Cero mock en producción (semana 1)

> Regla: producción nunca mockea data. Solo `**/__tests__/**`, `**/*.test.*` y `packages/db/test/mocks/` usan mocks.

### 1.1 Quitar `cuentasEjemplo` del login

**Archivos:** `apps/web/src/components/app-provider.tsx` (líneas 93–106), `apps/web/src/lib/stores.ts` (líneas 53–60)

**Cambio:**
```typescript
// ANTES (app-provider.tsx): login mock con cuentasEjemplo
const conocido = cuentasEjemplo.find((cuenta) => cuenta.correo.toLowerCase() === normalizado);

// DESPUÉS: solo NextAuth/BD
const iniciarSesion = useCallback(async (correo: string, contrasena: string) => {
  const respuesta = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
  if (!respuesta.ok) throw new Error('Credenciales inválidas.');
}, []);
```

Eliminar de `stores.ts`: `cuentasEjemplo`, `usarSesionAlmacenada` mock, `cuentasIniciales`. Mantener `usePersistentState` solo para borrador local (`borradorReserva`).

**Validación:**
```bash
grep -rn "cuentasEjemplo\|sampleAccounts" --include="*.ts" --include="*.tsx" apps/web/src | grep -v "__tests__" | grep -v ".test."
# esperado: 0 resultados
```

### 1.2 Landing page con datos reales

**Nuevo endpoint:** `apps/web/src/app/api/public/catalogo/route.ts`
```typescript
// GET /api/public/catalogo — cache 60s (ISR)
import { obtenerServicios, obtenerCategorias } from "@sportcomplex/db";
export async function GET() {
  const [servicios, categorias] = await Promise.all([
    obtenerServicios({ estado: "ACTIVO" }),
    obtenerCategorias(),
  ]);
  return ok({ servicios, categorias });
}
```

**Refactor:** `apps/web/src/app/(public)/page.tsx` — eliminar `import { ..., catalogoInicial, categoriasServicio } from "@sportcomplex/core"`; consumir `/api/public/catalogo` en Server Component.

### 1.3 Admin catálogo sin fallback mock

**Archivo:** `apps/web/src/app/(admin)/admin/catalog/page.tsx` (líneas 439–447, 458–467)

- Eliminar fallback a `catalogoInicial` cuando la API viene vacía.
- Eliminar `catch` que setea mock completo; en su lugar: `setCatalogo([])` + error visible + botón reintentar.
- Mostrar esqueleto de carga real mientras `cargando === true`.

### 1.4 POS con catálogo real

**Archivo:** `apps/web/src/app/(staff)/pos/page.tsx`

- Eliminar `import { usarCatalogo } from '@/lib/stores'`; fetch a `/api/admin/services?entidad=servicios` en `useEffect`.
- Eliminar `franjasPorDefecto` hardcodeadas (líneas 23–37); usar `/api/bookings?servicioId=&fecha=` con estado `cargandoFranjas` y lista vacía en error (no mock silencioso).
- Migrar `usarReservas` → `fetch('/api/bookings/history')`.

### 1.5 Portal reserva con API real

**Archivo:** `apps/web/src/app/(customer)/portal/book/components/service-selector.tsx`

- Eliminar import de `catalogoInicial`, `categoriasServicio` desde `@sportcomplex/core`.
- Consumir `/api/bookings/availability?fecha=` + `/api/public/catalogo`.
- Eliminar `categoriaPorSlug` local; usar datos de API.

### 1.6 Unificar sistema dual de IDs (crítico)

**Problema:** `resolverIdServicioCatalogo` (core, ej. `futbol-5-cancha-1 → 1`) vs `mapaIdNumericoServicio` (cart-utils, mismo slug → 4). Divergen.

**Fuente única:** `packages/seed/src/mapa-ids.ts`
```typescript
export const mapaIdServicio = {
  'tenis-cancha-1': { idBd: 17, slug: 'tenis-cancha-1', nombre: 'Cancha de tenis · Cancha 1' },
  'tenis-cancha-2': { idBd: 18, slug: 'tenis-cancha-2', nombre: 'Cancha de tenis · Cancha 2' },
  'padel-cancha-1': { idBd: 19, slug: 'padel-cancha-1', nombre: 'Pádel · Cancha 1' },
  'futbol-5-cancha-1': { idBd: 1, slug: 'futbol-5-cancha-1', nombre: 'Fútbol 5 · Cancha 1' },
  'futbol-5-cancha-2': { idBd: 2, slug: 'futbol-5-cancha-2', nombre: 'Fútbol 5 · Cancha 2' },
  'piscina-nado-libre': { idBd: 4, slug: 'piscina-nado-libre', nombre: 'Piscina · Nado libre' },
  'piscina-carril-entrenamiento': { idBd: 20, slug: 'piscina-carril-entrenamiento', nombre: 'Piscina · Carril entrenamiento' },
  'piscina-infantil': { idBd: 6, slug: 'piscina-infantil', nombre: 'Piscina · Zona infantil' },
  'gimnasio-sesion-individual': { idBd: 5, slug: 'gimnasio-sesion-individual', nombre: 'Gimnasio · Sesión individual' },
  'gimnasio-funcional': { idBd: 7, slug: 'gimnasio-funcional', nombre: 'Gimnasio · Zona funcional' },
  'zona-humeda-sauna': { idBd: 8, slug: 'zona-humeda-sauna', nombre: 'Zona húmeda · Sauna' },
  'zona-humeda-turco-jacuzzi': { idBd: 9, slug: 'zona-humeda-turco-jacuzzi', nombre: 'Zona húmeda · Turco y jacuzzi' },
} as const;

export type SlugServicio = keyof typeof mapaIdServicio;
export function obtenerIdBd(slug: SlugServicio): number { return mapaIdServicio[slug].idBd; }
export function obtenerSlug(idBd: number): SlugServicio | undefined {
  return (Object.entries(mapaIdServicio).find(([, v]) => v.idBd === idBd)?.[0]) as SlugServicio | undefined;
}
```

**Migración:** `core/domain/catalog.ts` re-exporta desde `@sportcomplex/seed`; `cart-utils.ts` importa `obtenerIdBd`. El seed de BD se genera desde este mapa (§2.2).

### 1.7 Localizar imágenes Unsplash

47+ URLs en `core/domain/catalog.ts`, `facility-showcase.tsx`, `lifestyle-and-digital-pass.tsx` → `/public/images/catalogo/<slug>.webp` + script `packages/seed/scripts/descargar-imagenes.ts` (fetch + sharp → webp 800w).

**Validación:**
```bash
grep -rn "images.unsplash.com" --include="*.ts" --include="*.tsx" packages/ apps/web/src
# esperado: 0 resultados
```

### Definition of Done — Fase 1

- [ ] `grep cuentasEjemplo|catalogoInicial|franjasPorDefecto` en prod → 0
- [ ] Landing carga de `/api/public/catalogo` en `pnpm build`
- [ ] Admin muestra error real si BD cae (no mock)
- [ ] POS y portal usan APIs reales
- [ ] IDs unificados en `@sportcomplex/seed`
- [ ] 0 URLs `unsplash.com` en código
- [ ] `pnpm typecheck` y `pnpm test` verdes

---

## 2. Fase 2 — Arquitectura limpia (semanas 2–3)

### Regla DAG de dependencias

```
domain → application → security → integrations
              ↓
           data ← web
              ↑
   validation (lee de domain) · seed (solo data) · ui (presentación)
```

`domain` tiene cero dependencias internas. `db` nunca importa `application`. `web` nunca importa subpaths `/src/`.

### 2.1 `@sportcomplex/domain` (tipos puros, nuevo)

```
packages/domain/src/
├── index.ts
├── catalogo/{ index.ts, tipos.ts, constantes.ts }
├── reserva/{ index.ts, tipos.ts, constantes.ts }       # reserva, estadoReserva, ticket, estadoTicket
├── membresia/{ index.ts, tipos.ts, constantes.ts }     # membresia, estadoMembresia, planMembresia, tasaDescuentoMembresia
├── usuario/{ index.ts, tipos.ts, constantes.ts }       # rol, estadoCuenta, hogarPorRol
├── precio/{ index.ts, tipos.ts }                       # dineroCentavos, metodoPago, resultadoDescuento
├── torneo/{ index.ts, tipos.ts }
├── analitica/{ index.ts, tipos.ts }
├── acceso/{ index.ts, tipos.ts }                       # ventanaAcceso, resultadoAcceso
└── constantes.ts                                       # zonaHoraria, diasVentanaReserva, minutosTtlCheckout
```

### 2.2 `@sportcomplex/seed` (data + sincronización, nuevo)

```
packages/seed/src/
├── index.ts
├── catalogo/{ index.ts, datos.ts, mapa-ids.ts, imagenes.ts }
├── sincronizar/{ index.ts, semillaABD.ts, bdASemilla.ts, validar.ts }
└── scripts/{ descargar-imagenes.ts, generar-semilla.ts }
```

Genera `db/prisma/seed.ts` desde `mapa-ids.ts` + `datos.ts`. Script `validar.ts` verifica consistencia semilla↔BD↔mapa en CI.

### 2.3 `@sportcomplex/application` (casos de uso, nuevo)

```
packages/application/src/
├── precio/{ aplicarDescuentoMembresia, calcularPrecioReserva, calcularPrecioConDescuento }
├── disponibilidad/{ obtenerDisponibilidad, verificarAforo, generarFranjasOperativas }
├── control-acceso/{ validarAcceso, verificarVentanaReserva, puertaAuth }
├── politica-piscina/
├── reserva/{ bloquearReserva, bloquearCarrito, cancelarReserva }
├── membresia/{ aplicarDescuento, validarMembresia }
└── torneo/{ inscribir, validarInscripcion }
```

Solo depende de `domain` + `validation`. Sin BD (patrón puertos/adaptadores).

### 2.4 `@sportcomplex/security` (nuevo)

```
packages/security/src/
├── qr/{ firmarTicket, verificarFirmaTicket, parsearPayloadQr, construirPayloadQr }
├── token/{ hashearSecreto, verificarSecreto, generarCodigoVerificacion, tokenExpirado, reenvioPermitido }
├── limite-tasa/
├── stripe/{ cliente, intento-pago, sesion-checkout, webhooks, tipos.ts }
├── correo/{ enviarCodigoVerificacion, plantillas/ }
└── festivos/                                            # desde core/integrations/nager-date
```

Resuelve los 7 imports `@sportcomplex/core/src/...` en web (el barrel exporta `token`).

### 2.5 `@sportcomplex/db` — solo acceso a datos

- Eliminar constantes duplicadas (`diasVentanaReserva`, mensajes contractuales) → usa `domain`.
- Exportar solo repositorios + `crearClientePrisma(cadenaConexion)`; quitar lectura de `.env` de `apps/web` en `client.ts`.
- Cada repositorio grande se parte en `consultas.ts` / `mutaciones.ts` / `mapeadores.ts` / `tipos.ts` (§3).
- Mapeadores snake_case↔camelCase en el borde: `avatar_url→avatarUrl`, `stripe_customer_id→clienteStripeId`, etc.

### 2.6 `@sportcomplex/ui` — fix dependencias

```json
{ "dependencies": {}, "peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" } }
```

`react`/`react-dom` solo en `peerDependencies` + `devDependencies`. Estructura: `componentes/<nombre>/{ index.ts, <Nombre>.tsx, <Nombre>.test.tsx }`, `plantillas/`, `lib/{ utils.ts, tema.ts }`, `ganchos/`.

### 2.7 `@sportcomplex/config` — configs reales

`eslint/{ base.js, nextjs.js, react.js, node.js }`, `typescript/{ base.json, nextjs.json, node.json }`, `prettier/`, `tailwind/preset.js`.

### 2.8 `exports` + build a `dist/`

Cada `package.json`:
```json
{ "main": "./dist/index.js", "types": "./dist/index.d.ts",
  "exports": { ".": "./dist/index.js", "./catalogo": "./dist/catalogo/index.js" },
  "scripts": { "build": "tsc --declaration --outDir dist" } }
```

`apps/web/tsconfig.json` → `paths` apuntan a `../../packages/*/dist` (hoy a `src`). Turbo `build.dependsOn: ["^build"]`.

### Definition of Done — Fase 2

- [ ] 7 packages con `exports` + build a `dist/`
- [ ] `domain` con cero dependencias internas
- [ ] `db` no lee `.env` de web; `ui` sin `react` en `dependencies`
- [ ] 0 imports `/src/` en web
- [ ] `pnpm build` genera artefactos en todos los packages

---

## 3. Fase 2.8 — Modularización de monolitos (paralelo a §2)

Patrón: `page.tsx` delgado + `componentes/` + `ganchos/` + `tipos.ts` + `utilidades/`.

| Archivo origen | Líneas | Estructura destino |
|---|---|---|
| `admin/catalog/page.tsx` | 1156 | `catalog/{ page, componentes/TablaCatalogo, FormularioCatalogo, FormularioCategoria, EditorHorario, DialogoConfirmacion, ganchos/usarCatalogo, usarCategorias, usarHorarios, tipos.ts, utilidades/mapeadores.ts }` |
| `scanner/page.tsx` | 1058 | `scanner/{ page, componentes/, ganchos/usarEscaner, servicio/{ api, validadores, estado } , tipos.ts }` |
| `portal/tickets/page.tsx` | 655 | `tickets/{ page, componentes/ListaTickets, ListaTorneos, ModalQr, ganchos/usarTickets, usarAccionesTicket, tipos.ts, utilidades/mapeadores-ticket.ts }` |
| `portal/page.tsx` | 482 | `portal/{ page, componentes/Encabezado, ProximaReserva, Pestañas, ListaReservas, GridCategorias, ganchos/usarReservasCliente, tipos.ts }` |
| `pos/page.tsx` | 500 | `pos/{ page, componentes/EncabezadoPos, SelectorServicio, FormularioCliente, PanelPago, ModalComprobante, ganchos/usarCatalogoPos, usarDisponibilidad, usarCobroPos, tipos.ts, constantes.ts, utilidades/ }` |
| `core/integrations/stripe.ts` | 583 | `security/stripe/{ cliente, intento-pago, sesion-checkout, webhooks, tipos.ts }` |
| `db/repositories/bookings.ts` | 791 | `db/repositories/bookings/{ index, consultas, mutaciones, mapeadores, tipos, errores }` (errores → `domain`) |
| `db/test/mock-prisma.ts` | 1755 | `db/test/mocks/{ index, fabricas/{ usuario, servicio, reserva, disponibilidad, pago, ticket, membresia }, escenarios/{ flujo-reserva, cobro-pos, inscripcion-torneo }, estado.ts, utilidades.ts }` |
| `core/domain/catalog.ts` | 411 | `domain/catalogo/{ tipos, constantes }` + `seed/catalogo/{ datos, mapa-ids, imagenes }` |

---

## 4. Migraciones BD (auditoría schema vs código)

### 4.1 `clienteStripeId` en `usuario` (crítica)

Sin esto no hay suscripciones recurrentes ni reutilización de `Customer` (el webhook recibe `customer` sin poder enlazarlo).

```sql
-- 20261015000000_agregar_cliente_stripe_a_usuario/migration.sql
ALTER TABLE "usuario" ADD COLUMN "stripe_customer_id" VARCHAR(100) UNIQUE;
CREATE INDEX IF NOT EXISTS "usuario_stripe_customer_id_idx" ON "usuario"("stripe_customer_id");
```

Prisma: `clienteStripeId String? @unique @map("stripe_customer_id") @db.VarChar(100)`.

### 4.2 `eliminadoEn` en `torneo` (crítica, auditoría HU-21)

```sql
-- 20261015000001_agregar_eliminado_en_a_torneo/migration.sql
ALTER TABLE "torneo" ADD COLUMN "deleted_at" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "torneo_deleted_at_idx" ON "torneo"("deleted_at");
```

Prisma: `eliminadoEn DateTime? @map("deleted_at") @db.Timestamptz`. Repositorios filtran `eliminadoEn: null`.

### 4.3 `actualizadoEn` en `inscripcion_torneo` (crítica)

```sql
-- 20261015000002_agregar_actualizado_en_a_inscripcion/migration.sql
ALTER TABLE "inscripcion_torneo" ADD COLUMN "actualizado_en" TIMESTAMPTZ DEFAULT now();
CREATE OR REPLACE FUNCTION actualizar_inscripcion_actualizado_en()
RETURNS TRIGGER AS $$ BEGIN NEW.actualizado_en = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inscripcion_torneo_actualizado_en
  BEFORE UPDATE ON "inscripcion_torneo"
  FOR EACH ROW EXECUTE FUNCTION actualizar_inscripcion_actualizado_en();
```

### 4.4 CHECKs (recomendada)

```sql
-- 20261015000003_agregar_restricciones_verificacion/migration.sql
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_capacidad_maxima_positiva" CHECK ("capacidad_maxima" > 0);
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_tarifa_no_negativa" CHECK ("tarifa" >= 0);
ALTER TABLE "plan_membresia" ADD CONSTRAINT "plan_membresia_descuento_30" CHECK ("descuento_pct" = 30.00);
ALTER TABLE "plan_membresia" ADD CONSTRAINT "plan_membresia_precio_no_negativo" CHECK ("precio" >= 0);
```

### 4.5 Campos en schema sin uso (implementar lectura o eliminar)

`avatarUrl`, `googleSub`, `suscripcionStripeId` (membresía), `webhookEnviadoEn`, `precioStripeId`. Decisión por campo en la PR de migración.

**Ejecución:**
```bash
pnpm --filter @sportcomplex/db prisma migrate dev --name <nombre>
pnpm --filter @sportcomplex/db prisma generate
pnpm --filter @sportcomplex/db test
```

---

## 5. Fase 3 — Guardrails + CI (semana 3–4)

### 5.1 Script `verificar:limites`

`scripts/verificar-limites.ts` (task turbo `verificar:limites`, obligatoria en CI):

| Regla | Patrón | Alcance | Excluye |
|---|---|---|---|
| Sin imports subpath | `@sportcomplex/[^/]+/src/` | `apps/web/**`, `packages/*/src/**` | tests |
| Sin mock en prod | `catalogoInicial\|cuentasEjemplo\|franjasPorDefecto\|reservasIniciales` | `apps/web/src/**`, `packages/*/src/**` | `__tests__`, `*.test.*`, `db/test/mocks` |
| Sin Unsplash | `images\.unsplash\.com` | `packages/**`, `apps/web/src/**` | — |
| Sin `any` en prod | `\bany\b` | `packages/*/src/**`, `apps/web/src/**` | tests, `mock-prisma.ts` |
| Sin dependencias circulares | `domain ← application|db|security` | grafo de imports | — |

### 5.2 TypeScript estricto

`config/typescript/base.json`: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`. Corregir los 12+ `any` en prod (repositorios `disponibilidad: any`, mappers, `portal-utils`).

### 5.3 Enforcement `hotfix/* → main`

Job en `ci.yml` que falla si `base == main` y la rama no empieza con `hotfix/`. Inexistente hoy (verificado).

### 5.4 ADRs

`docs/architecture/`: `001-limites-paquetes.md`, `002-separacion-domain-seed.md`, `003-cero-mock-en-produccion.md`, `004-resolucion-sistema-dual-ids.md`, `005-localizacion-imagenes.md`, `006-grafo-dependencias.md`.

### Definition of Done — Fase 3

- [ ] `pnpm verificar:limites` verde en CI
- [ ] 0 `any` en código de producción
- [ ] Job `hotfix/*` enforced
- [ ] 6 ADRs aprobados

---

## 6. Cuotas registradas

### CUOTA-001 — Fix seed torneos en BD fresca (origen: merge #88)

- **Origen:** commit `5e442ba` (PR #83). `seed.ts:131` crea torneos con `categoriaId = categoria?.id ?? 1`; en BD fresca no hay categorías → `P2003 (torneo_categoria_id_fkey)`, tumba `prisma db seed` y el job E2E (run 38621159622).
- **Fix:** resolver categoría por nombre y si no existe crearla (`Canchas/CANCHA`, `Piscinas/PISCINA`); usar su `id` real; eliminar fallbacks `?? 1` / `?? 2`.
- **Aceptación:** seed verde en BD vacía + `ci-headless` verde en `develop`.

---

## 7. Cronograma

| Semana | Enfoque | Entregable |
|---|---|---|
| 0 (hecha) | Merge PRs + back-merge #88 | `develop` unificado, 0 PRs abiertos |
| 1 | §1 mock elimination + CUOTA-001 | Cero mock en prod, E2E verde |
| 2 | §2.1–2.4 domain/seed/application/security | Nueva base de paquetes |
| 3 | §2.5–2.8 db/ui/exports/dist + §3 modularización | Boundaries fuertes |
| 4 | §4 migraciones + §5 guardrails/ADRs | No regresión garantizada |

## 8. Matriz de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Conflictos al modularizar monolitos | Media | Alto | Un archivo por PR, base `develop` al día |
| Romper tests al mover tipos | Media | Alto | Tests actualizados en la misma PR |
| Divergencia IDs rompe reservas en prod | Cierta | Crítico | §1.6 antes de cualquier deploy |
| Unsplash cae/rotura CSP | Media | Alto | §1.7 en Fase 1 |
| Regresión `any`/subpaths | Alta | Medio | `verificar:limites` obligatorio en CI |
| Reintroducción de dependencias circulares | Media | Alto | Validación de grafo en CI |
| `seed.ts` de develop corre en prod | Media | Crítico | Prod solo `bootstrap:prod` manual; `db:seed` confinado a develop/CI |
