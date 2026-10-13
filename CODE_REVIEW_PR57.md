# REPORTE DE CODE REVIEW — PULL REQUEST #57

**SportComplex Platform — Gestión de Reservas, Torneos y Control de Acceso**  
**Auditoría Técnica Senior de Calidad, Arquitectura, Seguridad y Rendimiento**

---

## 1. Metadatos de la Revisión

| Parámetro | Detalle |
| :--- | :--- |
| **Pull Request** | **#57** |
| **Título del PR** | `feat(tournaments): (TSK-BE-26) endpoints de catálogo e inscripción a torneos con emisión de QR seguro` |
| **Rama del PR** | `feature/SC-167-inscripcion-torneos-qr` |
| **Rama Base** | `origin/develop` (rama padre: `feature/SCRUM-166-endpoints-admin-torneos-bloqueo` / PR #48) |
| **Commit Evaluado** | `da5b5c80040e962502375da347913840eebe5579` (`da5b5c80`) |
| **Fecha de Revisión** | 2026-10-12 |
| **Rol del Revisor** | Revisor Senior de Código / Arquitecto de Software & Seguridad |
| **Entorno de Verificación** | Node.js v22.14.0 · Turborepo v2.11.4 · Prisma v7.10.0 · TypeScript 5.7.3 · pnpm 12.6.0 |

---

## 2. Resumen Ejecutivo y Dictamen

### 2.1. Dictamen Oficial
> ### ❌ **DICTAMEN: CHANGES REQUESTED (RECHAZADO HASTA CORRECCIÓN DE VULNERABILIDADES Y BLOQUEANTES)**
>
> Aunque el PR implementa con éxito los contratos funcionales básicos del catálogo público y emite payloads de QR conforme al estándar `SC1:<uuid>:<hmac>` de la plataforma, contiene **vulnerabilidades críticas de seguridad financiera, condiciones de carrera en el control de cupos (overbooking) e incompatibilidades severas con PostgreSQL** que provocarán caídas `500 SERVER_ERROR` en producción. Los tests actuales pasaron únicamente debido a limitaciones y simplificaciones del mock en memoria de Prisma.

### 2.2. Resumen de Aspectos Evaluados

1. **Aspectos Positivos Destacados**:
   - Integración coherente con el sistema de respuesta unificado (`ok`, `created`, `fail` de `@/lib/api-response`).
   - Implementación del cálculo dinámico en tiempo real de `cuposDisponibles` e `inscripcionesAbiertas` en el catálogo y detalle.
   - Adopción del estándar de QR criptográfico del monorepo (`SC1:<ticketCodigoUuid>:<hmac-sha256>`).
   - Integración de RBAC en `POST /register` restringido a roles `Cliente` y `Administrador`.
   - Compatibilidad limpia con Next.js 15+ App Router (`context.params: Promise<{ id: string }>`).
   - Todos los tests unitarios existentes pasan (`131 passed`) y el chequeo estático `turbo run typecheck` compila sin errores de tipos.

2. **Riesgos y Bloqueantes Principales**:
   - **Bypass de Pago / Fraude Financiero ([CRIT-01])**: El endpoint `/register` confía ciegamente en parámetros del cliente (`pagoId` o `stripePaymentIntentId`), marcando la inscripción como `CONFIRMADA` y emitiendo el ticket QR sin verificar el pago en Stripe ni en la tabla `pago`.
   - **Condición de Carrera en Cupos ([CRIT-02])**: La reserva de cupos omite el bloqueo pesimista `SELECT ... FOR UPDATE` o una actualización condicional atómica, permitiendo sobreventa (overbooking) bajo concurrencia.
   - **Fallback Inseguro en Clave Secreta HMAC ([HIGH-01])**: Se utiliza `"sportcomplex-secret"` como valor por defecto si falta `QR_HMAC_SECRET`, comprometiendo la autenticidad del QR y disintiendo del resto de endpoints que exigen 503 `QR_NOT_CONFIGURED`.
   - **Incompatibilidad de Tipos y Restricción Única en Base de Datos ([HIGH-02], [HIGH-03])**: Pasar `stripePaymentIntentId` como `pagoId` viola el tipo UUID y clave foránea de PostgreSQL. Reintentar o pagar una inscripción `PENDIENTE_PAGO` colisiona con `@unique([torneoId, usuarioId])`, detonando errores `P2002` no capturados.
   - **Fuga de Capas y Exposición de PII ([MED-01], [MED-02])**: Importación directa de `prisma` en rutas web y consulta innecesaria de emails de todos los competidores en el endpoint de detalle público.

---

## 3. Matriz de Hallazgos por Severidad

| Código | Severidad | Área | Archivo(s) / Línea(s) | Descripción Breve | Bloqueante |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **CRIT-01** | 🔴 **CRÍTICA** | Seguridad / Negocio | `apps/web/src/app/api/tournaments/[id]/register/route.ts#L54-L64` | Bypass de verificación de pago: confirmación automática y emisión de QR sin validar transacción en Stripe ni base de datos. | **SÍ** |
| **CRIT-02** | 🔴 **CRÍTICA** | Arquitectura / Concurrencia | `packages/db/src/repositories/tournaments.ts#L657-L663, L706-L710` | Condición de carrera (Race Condition) en control de cupos: omisión de `FOR UPDATE` o actualización condicional permite overbooking. | **SÍ** |
| **HIGH-01** | 🟠 **ALTA** | Seguridad Criptográfica | `apps/web/src/app/api/tournaments/[id]/register/route.ts#L69-L72` | Fallback inseguro a `"sportcomplex-secret"` si falta `QR_HMAC_SECRET`; discrepancia con política de 503 `QR_NOT_CONFIGURED`. | **SÍ** |
| **HIGH-02** | 🟠 **ALTA** | Integridad DB / Tipado | `apps/web/src/app/api/tournaments/[id]/register/route.ts#L54-L63`<br>`packages/db/prisma/schema.prisma#L462` | `stripePaymentIntentId` (string `pi_...`) no es UUID ni clave foránea de `pago.id`; genera error SQL `22P02`/`23503` en Postgres. | **SÍ** |
| **HIGH-03** | 🟠 **ALTA** | Lógica de Negocio / DB | `packages/db/src/repositories/tournaments.ts#L665-L690` | Reintento o pago posterior de inscripción `PENDIENTE_PAGO` intenta nuevo `create` y detona colisión única `P2002` (500 Server Error). | **SÍ** |
| **MED-01** | 🟡 **MEDIA** | Arquitectura | `apps/web/src/app/api/tournaments/route.ts#L4, L58`<br>`apps/web/src/app/api/tournaments/[id]/route.ts#L4, L38` | Violación del patrón repositorio: importación directa de `prisma` en route handlers de Next.js en lugar de delegar a `@sportcomplex/db`. | NO |
| **MED-02** | 🟡 **MEDIA** | Rendimiento / Privacidad | `apps/web/src/app/api/tournaments/[id]/route.ts#L24, L52-54`<br>`packages/db/src/repositories/tournaments.ts#L420-L428` | Sobrecarga de datos y exposición innecesaria de PII: se consultan todos los inscritos con correo para luego hacer `delete` en memoria. | NO |
| **MED-03** | 🟡 **MEDIA** | Control de Acceso | `apps/web/src/app/api/tournaments/route.ts#L15, L37` | Parámetro `estado=BORRADOR` en catálogo público permite a clientes o anónimos ver torneos en borrador no publicados. | NO |
| **MED-04** | 🟡 **MEDIA** | Lógica de Negocio / UI | `apps/web/src/app/api/tournaments/route.ts#L58-L65`<br>`apps/web/src/app/api/tournaments/[id]/route.ts#L38-L60` | Indicador `yaInscrito: true` incluye inscripciones en estado `CANCELADA`, engañando al usuario en la interfaz. | NO |
| **LOW-01** | 🔵 **BAJA** | Validación de Entrada | `packages/validation/src/tournament.schema.ts#L138` | `pagoId` en `registerTournamentSchema` no valida formato UUID mediante `.uuid()`. | NO |
| **LOW-02** | 🔵 **BAJA** | Diseño de API | `apps/web/src/app/api/tournaments/route.ts#L80` | Endpoint de catálogo soporta `page` y `limit` pero no retorna objeto de paginación (`total`, `page`, `totalPages`). | NO |
| **INFO-01** | ⚪ **INFO** | Testing / Fiabilidad | `packages/db/test/mock-prisma.ts#L1388-L1411` | Mock de pruebas no valida unicidad `@@unique` ni tipos de columnas Postgres, enmascarando los fallos HIGH-02 y HIGH-03. | NO |

---

## 4. Análisis Detallado por Áreas

### Área 1: Arquitectura y Patrones de Diseño

#### 1.1. Violación del Patrón Repositorio y Fuga de Abstracción ([MED-01])
El estándar de la arquitectura de SportComplex desacopla la persistencia en `packages/db/src/repositories/*`. Las rutas Next.js de la capa web deben consumir únicamente funciones del dominio del repositorio.
Sin embargo, en:
- `apps/web/src/app/api/tournaments/route.ts` (L4, L58):
  ```typescript
  import { listarTorneos, prisma } from "@sportcomplex/db";
  ...
  const misInscripciones = await prisma.inscripcionTorneo.findMany({ ... });
  ```
- `apps/web/src/app/api/tournaments/[id]/route.ts` (L4, L38):
  ```typescript
  import { obtenerTorneoPorId, prisma, TournamentError } from "@sportcomplex/db";
  ...
  miInscripcion = await prisma.inscripcionTorneo.findUnique({ ... });
  ```

**Impacto Arquitectónico**:
- Acoplamiento directo del runtime de la aplicación web a las tablas y clientes de Prisma.
- Obliga a los tests unitarios de las rutas web a inicializar o manipular el cliente global `prisma` en lugar de poder inyectar o mockear métodos de repositorio de alto nivel.
- Dificulta la reutilización de consultas de inscripciones de usuario en otros módulos o canales (ej. bot, taquilla POS).

#### 1.2. Reutilización Indebida de Consultas Administrativas para Clientes ([MED-02])
En `GET /api/tournaments/[id]`, el handler ejecuta `obtenerTorneoPorId(id)`. Esta función fue diseñada originalmente en PR #48 para la vista del Administrador e incluye:
```typescript
inscripciones: {
  include: { usuario: { select: { id: true, nombre: true, correo: true } } },
}
```
En la ruta pública, el desarrollador aplicó un parche manual:
```typescript
const torneoData = { ...torneo } as Record<string, unknown>;
delete torneoData.inscripciones;
```
Esto viola el Principio de Segregación de Interfaces (ISP). El repositorio debe ofrecer una proyección optimizada para cliente (ej. `obtenerDetallePublicoTorneo`), evitando traer datos sensibles de otros socios que inmediatamente serán descartados.

---

### Área 2: Calidad del Código y Mejores Prácticas

#### 2.1. Manipulación de Objetos y Delete en Tiempo de Ejecución
El uso de `delete torneoData.inscripciones` tras un casting a `Record<string, unknown>` desactiva la seguridad de tipos de TypeScript y degrada el rendimiento de los objetos en el motor V8 (desoptimizando las *hidden classes*). La exclusión de campos debe realizarse mediante proyecciones Prisma (`select`), `omit` tipado de TypeScript o esquemas DTO explícitos.

#### 2.2. Manejo de Contexto Asíncrono en Next.js 15+
Se destaca positivamente que en `apps/web/src/app/api/tournaments/[id]/route.ts` y `register/route.ts` se utilizó adecuadamente la convención asíncrona para parámetros dinámicos:
```typescript
interface RouteContext {
  params: Promise<{ id: string }>;
}
const { id } = await context.params;
```
Esto asegura compatibilidad completa con el App Router de Next.js sin advertencias de deprecación.

---

### Área 3: Seguridad y Validación de Entrada

#### 3.1. Vulnerabilidad Crítica: Fraude Financiero por Bypass de Pago ([CRIT-01])
En `apps/web/src/app/api/tournaments/[id]/register/route.ts`:
```typescript
50: // 1. Validar torneo y condiciones de costo
51: const torneo = await obtenerTorneoPorId(parsedId.data);
52: const precio = Number(torneo.precioInscripcion ?? 0);
53: const esGratuito = precio === 0;
54: const pagoRef = parsed.data.pagoId || parsed.data.stripePaymentIntentId || null;
55: const confirmado = esGratuito || Boolean(pagoRef);
56: 
57: // 2. Transacción atómica de inscripción y control de cupos (ARC-01)
58: const inscripcion = await inscribirUsuarioTorneo({
59:   torneoId: parsedId.data,
60:   usuarioId: authorization.actor.id,
61:   nombrePareja: parsed.data.nombrePareja,
62:   pagoId: pagoRef,
63:   confirmado,
64: });
```
**Análisis de Seguridad**:
- Si un torneo cuesta `$50.000 COP`, un usuario malicioso solo necesita enviar:
  ```json
  { "pagoId": "fake-payment-id" }
  ```
  o
  ```json
  { "stripePaymentIntentId": "pi_inventado_123" }
  ```
- El código evalúa `Boolean(pagoRef) === true` y envía `confirmado: true`.
- `inscribirUsuarioTorneo` establece inmediatamente `estado: "CONFIRMADA"`.
- Se genera la firma HMAC y se emite un **Ticket QR válido y activo** con el que el usuario podrá entrar al torneo el día del evento sin haber pagado un solo centavo.
- **Corrección Mandatoria**: Los pagos de Stripe jamás se confirman por declaración del cliente en un endpoint de registro. Deben confirmarse exclusivamente mediante:
  1. El webhook seguro de Stripe (`invoice.paid` / `payment_intent.succeeded`) validado con `STRIPE_WEBHOOK_SECRET`, o
  2. La validación en base de datos de un registro previo en la tabla `Pago` cuyo estado sea `APROBADO`, monto igual o mayor a `precioInscripcion`, y que pertenezca a ese usuario y no haya sido utilizado en otra inscripción.

#### 3.2. Fallback Inseguro en Clave Secreta HMAC ([HIGH-01])
En `apps/web/src/app/api/tournaments/[id]/register/route.ts`:
```typescript
69: const qrSecret =
70:   process.env.QR_HMAC_SECRET ||
71:   process.env.NEXTAUTH_SECRET ||
72:   "sportcomplex-secret";
73: const signature = signTicket(inscripcion.ticketCodigoUuid, qrSecret);
```
**Análisis de Riesgo**:
1. **Clave Débil Hardcodeada**: Si `QR_HMAC_SECRET` y `NEXTAUTH_SECRET` faltan en un contenedor o entorno de staging, el sistema firma con `"sportcomplex-secret"`. Cualquier usuario puede calcular el HMAC SHA-256 de su ticket o de tickets ajenos.
2. **Inconsistencia Crítica con el Escáner**: En los endpoints de validación de portería (`/api/tickets/verify/[code]`, `/api/access`, `/api/v1/bot/validate-ticket`), el estándar del monorepo es:
   ```typescript
   const qrSecret = process.env.QR_HMAC_SECRET;
   if (!qrSecret) return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
   ```
   Si la inscripción se firmó con `NEXTAUTH_SECRET` o `"sportcomplex-secret"`, el escáner de la puerta de acceso rechazará al socio legítimo en la entrada (`INVALID_SIGNATURE`), provocando incidentes operativos graves en el complejo deportivo.

#### 3.3. Incompatibilidad de Clave Foránea en `pagoId` ([HIGH-02])
En el esquema de Prisma (`packages/db/prisma/schema.prisma`):
```prisma
model InscripcionTorneo {
  ...
  pagoId String? @map("pago_id") @db.Uuid
  pago   Pago?   @relation(fields: [pagoId], references: [id], onDelete: SetNull, onUpdate: Cascade)
}
```
- La columna física en Postgres es `UUID` y tiene restricción de clave foránea hacia la tabla `Pago(id)`.
- Si el cliente envía `stripePaymentIntentId` (`"pi_3Mtw..."`), la asignación directa a `pagoId` provoca un error de base de datos Postgres:
  `ERROR: 22P02: invalid input syntax for type uuid: "pi_3Mtw..."`.
- En caso de enviar un UUID sintético que no exista en la tabla `Pago`, Postgres arroja error `23503: foreign key constraint "inscripcion_torneo_pago_id_fkey" violation`.
- En ambos casos el endpoint captura la excepción y retorna un inesperado `500 SERVER_ERROR`.

#### 3.4. Exposición de Torneos en Borrador en el Catálogo Público ([MED-03])
En `apps/web/src/app/api/tournaments/route.ts`:
```typescript
35: const filtros = {
36:   ...parsed.data,
37:   soloActivos: parsed.data.estado ? undefined : (parsed.data.soloActivos ?? true),
38: };
```
Si un cliente ejecuta `GET /api/tournaments?estado=BORRADOR`, `parsed.data.estado` tiene valor `"BORRADOR"`, desactivando `soloActivos` y consultando torneos en borrador. Los torneos no listados o en fase de planificación interna deben restringirse estrictamente a `/api/admin/tournaments`.

---

### Área 4: Tests y Cobertura

#### 4.1. Análisis de la Suite Ejecutada
- Ejecución verificada: `turbo run test` completó exitosamente con **131 tests pasando**.
- `apps/web/src/app/api/tournaments/__tests__/route.test.ts` aporta 8 casos de prueba estructurados:
  - Catálogo público con cupos calculados.
  - Detalle individual y validación UUID.
  - Autenticación requerida (401).
  - Rechazo de torneos no abiertos (400).
  - Inscripción gratuita exitosa y verificación de formato QR `SC1:<uuid>:<sig>`.
  - Prevención de duplicados para inscripciones confirmadas (409).
  - Control de capacidad excedida (409).
  - Diferenciación de estado según costo (`PENDIENTE_PAGO` vs `CONFIRMADA`).

#### 4.2. Falsos Positivos y Limitaciones del Mock en Memoria ([INFO-01])
A pesar del 100% de aprobación en pruebas, existen importantes **falsos positivos** debidos a `mock-prisma.ts`:
1. `mock.inscripcionTorneo.create`:
   ```typescript
   async create({ data, include }: any) {
     const item: any = { ... };
     inscripcionesTorneo.push(item);
     return res;
   }
   ```
   No valida unicidad sobre `[torneoId, usuarioId]` ni valida que `pagoId` sea un UUID válido ni que exista en la colección de pagos.
2. En `route.test.ts#L312-L352`:
   Para probar `PENDIENTE_PAGO` se usó `user-cliente-2`, y para probar `CONFIRMADA con pago` se usó `user-cliente-3`.
   **Nunca se probó el ciclo de vida real**: un usuario que primero se inscribe en `PENDIENTE_PAGO` y luego intenta pagar. Si el test hubiese usado el mismo usuario, habría fallado evidenciando el bug HIGH-03.

#### 4.3. Casos de Prueba Faltantes
- [ ] Ausencia de `QR_HMAC_SECRET` (debe retornar 503 `QR_NOT_CONFIGURED`, tal como se prueba en los tests de boletos de reserva).
- [ ] Intento de consultar `GET /api/tournaments?estado=BORRADOR` por un cliente (debe ignorarse o retornar 403/400).
- [ ] Consulta de `GET /api/tournaments/[id]` para un torneo en `BORRADOR` por un cliente.
- [ ] Reintento de inscripción por un usuario con inscripción previa en `PENDIENTE_PAGO`.
- [ ] Acceso a `POST /register` por parte de un usuario con rol `Empleado_Lector` o `Vendedor` (debe retornar 403).

---

### Área 5: Performance y Escalabilidad

#### 5.1. Condición de Carrera en Control de Cupos ([CRIT-02])
En `packages/db/src/repositories/tournaments.ts`:
```typescript
643: return db.$transaction(async (tx: any) => {
644:   const torneo = await tx.torneo.findUnique({ where: { id: input.torneoId } });
...
657:   if (torneo.cuposOcupados >= torneo.cuposTotales) {
658:     throw new TournamentError("No hay cupos disponibles...", "CAPACITY_EXCEEDED", 409);
659:   }
...
705:   if (estadoInicial === "CONFIRMADA") {
706:     await tx.torneo.update({
707:       where: { id: input.torneoId },
708:       data: { cuposOcupados: { increment: 1 } },
709:     });
710:   }
```
**Análisis de Concurrencia**:
- En PostgreSQL bajo `READ COMMITTED`, `findUnique` **no bloquea la fila**.
- Si un torneo tiene 1 cupo restante y 50 usuarios envían su inscripción en el mismo segundo:
  1. Las 50 transacciones leen concurrentemente la fila y ven que `cuposOcupados < cuposTotales`.
  2. Las 50 transacciones pasan la condición y crean 50 filas en `inscripcionTorneo`.
  3. Las 50 transacciones ejecutan `update({ data: { cuposOcupados: { increment: 1 } } })`.
  4. Resultado: El torneo termina con `cuposOcupados = 65 / 16`. **Overbooking masivo**.
- **Regla del Proyecto Violada**: La documentación oficial del repositorio (`packages/db/src/repositories/README.md#L105`) estipula textualmente:
  > *"Regla: ningún camino que modifique cupos_ocupados puede omitir FOR UPDATE... Concurrencia (criterio de aceptación): Lanzar N en paralelo sobre la misma fila con 1 cupo libre: esperado 1 éxito + (N-1) 409 y cupos_ocupados final +1."*

#### 5.2. Error P2002 al Reintentar Inscripción Pendiente ([HIGH-03])
En `packages/db/src/repositories/tournaments.ts`:
```typescript
665: const inscripcionExistente = await tx.inscripcionTorneo.findUnique({
666:   where: {
667:     torneoId_usuarioId: { torneoId: input.torneoId, usuarioId: input.usuarioId },
668:   },
669: });
670: 
671: if (inscripcionExistente) {
672:   if (inscripcionExistente.estado === "CONFIRMADA") {
673:     throw new TournamentError("El usuario ya se encuentra inscrito...", "ALREADY_REGISTERED", 409);
674:   }
675: }
...
690: const inscripcion = await tx.inscripcionTorneo.create({ ... });
```
Si el usuario ya tiene un registro con `estado: "PENDIENTE_PAGO"` o `estado: "CANCELADA"`, el bloque `if` no lanza error y continúa hacia `tx.inscripcionTorneo.create(...)`. Al ejecutar `create`, Prisma intenta insertar una tupla con un par `(torneo_id, usuario_id)` ya existente en la tabla, colisionando con el índice único `@@unique([torneoId, usuarioId])`. Prisma arroja `PrismaClientKnownRequestError` con código `P2002`, traduciéndose en un HTTP 500 no controlado.

#### 5.3. Paginación Incompleta en el Catálogo ([LOW-02])
El endpoint `/api/tournaments` acepta `page` y `limit`, pero la respuesta devuelve únicamente el arreglo crudo de elementos. No se calcula ni se entrega:
- `total`: número total de registros que coinciden con los filtros.
- `totalPages`: cantidad de páginas disponibles.
- `hasNextPage` / `hasPrevPage`.
Sin estos metadatos, los componentes frontend de paginación o scroll infinito no pueden determinar cuándo detener la carga.

---

### Área 6: Documentación y Contratos de API

1. **JSDoc de Endpoints**:
   Las rutas cuentan con bloques JSDoc básicos con referencias a requerimientos (`RF-15`, `RNF-01`, `TSK-BE-26`). Sin embargo, se menciona `RF-15` (Control de acceso con escáner de boletos) en lugar de documentar las especificaciones del catálogo y registro de torneos.
2. **Documentación de Errores de API**:
   Falta documentar exhaustivamente los códigos de error que pueden emitir los endpoints para el equipo de frontend:
   - `400`: `VALIDATION_ERROR`, `INVALID_ID`, `REGISTRATION_CLOSED`, `INVALID_PAYLOAD`.
   - `401`: `UNAUTHORIZED`.
   - `403`: `FORBIDDEN`.
   - `404`: `NOT_FOUND`.
   - `409`: `ALREADY_REGISTERED`, `CAPACITY_EXCEEDED`.
   - `503`: `QR_NOT_CONFIGURED`.
3. **Documentación en Repositorio**:
   El archivo `packages/db/src/repositories/README.md` no fue actualizado para incluir los contratos y comportamientos de `inscribirUsuarioTorneo`, `obtenerInscripcionPorTicket` ni `canjearTicketTorneo`.

---

## 5. Auditoría de Regresiones en Endpoints Administrativos (PR #48)

En commit `da5b5c80`, el diff incluye una modificación en:
`apps/web/src/app/api/admin/tournaments/__tests__/route.test.ts`:
- **Cambio**: Se ajustaron las horas ISO en las pruebas de `08:00:00Z` a `13:00:00Z` (y de `14:00:00Z` a `19:00:00Z`).
- **Análisis**: En hora de Bogotá (`America/Bogota`, UTC-5), `08:00:00Z` corresponde a las `03:00 AM`. Dado que las franjas de disponibilidad se generan en horario operativo diurno, el test original era frágil ante conversiones de zona horaria de `dateInBogota`. Moverlo a `13:00:00Z` (08:00 AM Bogotá) alinea la prueba con franjas reales.
- **Dictamen de Regresión**: **SIN REGRESIONES**. Los endpoints administrativos `/api/admin/tournaments/*` no sufrieron alteraciones operativas ni de comportamiento.

---

## 6. Plan de Acción y Código de Refactorización Recomendado

Para que este Pull Request pueda ser aprobado e integrado en `develop`, se deben aplicar los siguientes cambios estructurados en dos fases prioritarias:

### Fase 1: Bloqueantes Críticos y de Seguridad (Mandatorio antes de Merge)

#### 1. Corregir la Validación de Secretos HMAC en `/register/route.ts`
Eliminar el fallback inseguro y responder `503 QR_NOT_CONFIGURED` previo a cualquier operación de base de datos si falta la variable de entorno:

```typescript
// apps/web/src/app/api/tournaments/[id]/register/route.ts

// Validar secret antes de procesar la transacción
const qrSecret = process.env.QR_HMAC_SECRET;
if (!qrSecret) {
  return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET en el servidor.", 503);
}
```

#### 2. Corregir la Concurrencia y el Flujo de Reintentos en `inscribirUsuarioTorneo`
En `packages/db/src/repositories/tournaments.ts`, utilizar una actualización condicional atómica para evitar sobreventa (o `SELECT ... FOR UPDATE`), y actualizar la inscripción existente si ya existía en estado no confirmado:

```typescript
// packages/db/src/repositories/tournaments.ts

export async function inscribirUsuarioTorneo(
  input: InscribirUsuarioInput,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  return db.$transaction(async (tx: any) => {
    // 1. Obtener y validar torneo
    const torneo = await tx.torneo.findUnique({ where: { id: input.torneoId } });
    if (!torneo) {
      throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
    }

    if (torneo.estado !== "INSCRIPCIONES_ABIERTAS") {
      throw new TournamentError(
        `Las inscripciones no están abiertas para este torneo (estado: ${torneo.estado}).`,
        "REGISTRATION_CLOSED",
        400,
      );
    }

    // 2. Verificar inscripción previa
    const inscripcionExistente = await tx.inscripcionTorneo.findUnique({
      where: {
        torneoId_usuarioId: {
          torneoId: input.torneoId,
          usuarioId: input.usuarioId,
        },
      },
    });

    if (inscripcionExistente) {
      if (inscripcionExistente.estado === "CONFIRMADA") {
        throw new TournamentError(
          "El usuario ya se encuentra inscrito en este torneo.",
          "ALREADY_REGISTERED",
          409,
        );
      }
      if (inscripcionExistente.estado === "PENDIENTE_PAGO" && !input.confirmado) {
        // Ya tiene una inscripción pendiente de pago registrada
        return inscripcionExistente;
      }
    }

    // 3. Determinar estado inicial
    const estadoInicial: EstadoInscripcionTorneoValor = input.confirmado
      ? "CONFIRMADA"
      : Number(torneo.precioInscripcion) === 0
        ? "CONFIRMADA"
        : "PENDIENTE_PAGO";

    // 4. Si se va a confirmar, reservar cupo de forma atómica y condicional (evita overbooking)
    if (estadoInicial === "CONFIRMADA") {
      const updateResult = await tx.torneo.updateMany({
        where: {
          id: input.torneoId,
          cuposOcupados: { lt: torneo.cuposTotales },
        },
        data: {
          cuposOcupados: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new TournamentError(
          "No hay cupos disponibles para este torneo.",
          "CAPACITY_EXCEEDED",
          409,
        );
      }
    }

    // 5. Crear o actualizar registro sin violar @@unique([torneoId, usuarioId])
    if (inscripcionExistente) {
      return tx.inscripcionTorneo.update({
        where: { id: inscripcionExistente.id },
        data: {
          nombrePareja: input.nombrePareja?.trim() ?? inscripcionExistente.nombrePareja,
          pagoId: input.pagoId ?? inscripcionExistente.pagoId,
          estado: estadoInicial,
          ticketEstado: estadoInicial === "CONFIRMADA" ? "EMITIDO" : inscripcionExistente.ticketEstado,
        },
        include: {
          torneo: true,
          usuario: { select: { id: true, nombre: true, correo: true } },
        },
      });
    }

    return tx.inscripcionTorneo.create({
      data: {
        torneoId: input.torneoId,
        usuarioId: input.usuarioId,
        nombrePareja: input.nombrePareja?.trim() ?? null,
        pagoId: input.pagoId ?? null,
        estado: estadoInicial,
        ticketEstado: "EMITIDO",
      },
      include: {
        torneo: true,
        usuario: { select: { id: true, nombre: true, correo: true } },
      },
    });
  });
}
```

#### 3. Eliminar Aceptación de Pagos No Verificados en `/register/route.ts`
Para torneos de pago (`precioInscripcion > 0`), el registro inicial debe quedar en `PENDIENTE_PAGO` a menos que se verifique un `pagoId` existente, aprobado y asociado al usuario en la tabla `Pago`:

```typescript
// apps/web/src/app/api/tournaments/[id]/register/route.ts

let confirmado = false;
let pagoIdValido: string | null = null;

if (esGratuito) {
  confirmado = true;
} else if (parsed.data.pagoId) {
  // Validar contra tabla Pago en el repositorio
  const pago = await verificarPagoParaTorneo(parsed.data.pagoId, authorization.actor.id, precio);
  if (!pago) {
    return fail("PAYMENT_INVALID", "El identificador de pago no es válido o no cubre el monto.", 400);
  }
  confirmado = true;
  pagoIdValido = pago.id;
}
```

---

### Fase 2: Calidad Arquitectónica y Experiencia de Usuario

#### 1. Encapsular Consultas en el Repositorio de Torneos
Crear funciones en `@sportcomplex/db/repositories/tournaments.ts`:
- `obtenerInscripcionesUsuarioParaTorneos(usuarioId: string, torneoIds: string[])`: Retorna IDs de torneos donde el usuario tiene inscripción activa (`estado: { in: ["CONFIRMADA", "PENDIENTE_PAGO"] }`).
- `obtenerInscripcionUsuario(torneoId: string, usuarioId: string)`: Retorna la inscripción individual del usuario.
- Eliminar los `import { prisma }` directos en `apps/web/src/app/api/tournaments/route.ts` y `[id]/route.ts`.

#### 2. Restringir Visibilidad de Torneos en Borrador
En `apps/web/src/app/api/tournaments/route.ts`:
```typescript
// Forzar que el catálogo público solo devuelva estados visibles
const estadosPermitidos = ["INSCRIPCIONES_ABIERTAS", "EN_CURSO", "FINALIZADO"];
if (parsed.data.estado && !estadosPermitidos.includes(parsed.data.estado)) {
  return fail("INVALID_FILTER", "Estado de torneo no disponible para consulta pública.", 400);
}
```

#### 3. Mejorar los Tests con Escenarios de Falla
- Agregar prueba para ausencia de `QR_HMAC_SECRET` verificando respuesta 503.
- Agregar prueba de pago posterior para una inscripción previamente en `PENDIENTE_PAGO`.
- Agregar prueba de restricción de cupo concurrente.

---

## 7. Conclusión

El Pull Request #57 introduce una funcionalidad de alto valor para la plataforma SportComplex y sienta las bases correctas para la emisión de códigos QR seguros conforme a las especificaciones de la plataforma. Sin embargo, debido a los riesgos críticos de fraude en inscripciones de pago, posibilidad de sobreventa de cupos bajo concurrencia y caídas no controladas por incompatibilidad con PostgreSQL, **no es apto para despliegue en su estado actual**.

Una vez implementadas las correcciones descritas en la **Fase 1**, el PR cumplirá con los estándares de seguridad, robustez y escalabilidad requeridos para su aprobación e integración a `develop`.
