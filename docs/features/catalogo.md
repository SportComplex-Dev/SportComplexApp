# TSK-BE-04 — CRUD de Categorías e Instancias con Validación de Unicidad y Calendario Propio

> Rama de trabajo: `feature/tsk-be-04-crud-de-categorías-e-instancias`
> Responsable: Jose Romero · Fase F1 · Depende de `TSK-BD-06`
> Fecha de implementación: 2026-10-06

## 1. Qué se hizo y por qué

La base de datos ya tenía el modelo de `CategoriaServicio` y `Servicio` desde `TSK-BD-06`, pero faltaba la **lógica de negocio** completa para:

| Requisito | Implementación |
|-----------|----------------|
| **RF-03**: Catálogo de servicios por categoría | CRUD completo de `CategoriaServicio` + `Servicio` con validación de unicidad a nivel de complejo |
| **RF-04**: Calendario propio por instancia | Cada `Servicio` genera sus `FranjaHoraria` y `Disponibilidad` (15 días) de forma atómica |

### Cambios clave en BD (migraciones)

| # | Cambio | Archivo |
|---|--------|---------|
| 1 | Constraint único compuesto `(servicioId, franjaId, fecha)` en `Disponibilidad` — evita duplicados al regenerar calendario | `packages/db/prisma/migrations/20261006231500_disponibilidad_unique_constraint/migration.sql` |

> **Nota**: El índice parcial de membresía vigente (`TSK-BD-11`) también está en esta rama porque se mergeó desde `develop`.

---

## 2. Modelos y enums nuevos (Prisma)

```prisma
enum TipoCategoriaServicio { CANCHA, PISCINA, GIMNASIO, ZONA_HUMEDA }
enum ModalidadServicio { EXCLUSIVA, AFORO }
enum TipoPiscina { PUBLICA, PRIVADA }
enum EstadoServicio { ACTIVO, INHABILITADO }

model CategoriaServicio {
  id       Int    @id @default(autoincrement())
  nombre   String @unique @db.VarChar(60)
  tipo     TipoCategoriaServicio
  servicios Servicio[]
}

model Servicio {
  id              Int               @id @default(autoincrement())
  categoriaId     Int               @map("categoria_id")
  nombre          String            @unique @db.VarChar(80)  // ← Unicidad global por complejo
  capacidadMaxima Int               @map("capacidad_maxima")
  tarifa          Decimal           @db.Decimal(12, 2)
  modalidad       ModalidadServicio
  tipoPiscina     TipoPiscina?      @map("tipo_piscina")
  estado          EstadoServicio    @default(ACTIVO)

  categoria          CategoriaServicio   @relation(fields: [categoriaId], references: [id])
  franjasHorarias    FranjaHoraria[]
  disponibilidades   Disponibilidad[]
}

model FranjaHoraria {
  id         Int      @id @default(autoincrement())
  servicioId Int      @map("servicio_id")
  diaSemana  Int      @map("dia_semana") @db.SmallInt  // 1=Lun ... 7=Dom
  horaInicio DateTime @map("hora_inicio") @db.Time
  horaFin    DateTime @map("hora_fin") @db.Time

  servicio         Servicio
  disponibilidades Disponibilidad[]
}

model Disponibilidad {
  id                     BigInt   @id @default(autoincrement())
  servicioId             Int      @map("servicio_id")
  franjaId               Int      @map("franja_id")
  fecha                  DateTime @db.Date
  cuposTotales           Int      @map("cupos_totales")
  cuposOcupados          Int      @default(0) @map("cupos_ocupados")
  bloqueadaMantenimiento Boolean  @default(false) @map("bloqueada_mantenimiento")

  servicio Servicio      @relation(fields: [servicioId], references: [id])
  franja   FranjaHoraria @relation(fields: [franjaId], references: [id])
  reservas Reserva[]

  @@unique([servicioId, franjaId, fecha])  // ← Migración 20261006231500
  @@index([fecha, servicioId])
}
```

---

## 3. Repositorio (`packages/db/src/repositories/services.ts`)

### Operaciones de Categoría

```ts
createCategoria({ nombre, tipo })           // Valida duplicado por nombre (DuplicateError)
getCategorias()                              // Incluye _count.servicios
getCategoriaById(id)                         // Con servicios
updateCategoria(id, { nombre?, tipo? })      // Valida duplicado si cambia nombre
deleteCategoria(id)                          // Bloquea si tiene servicios (ForeignKeyConflictError)
```

### Operaciones de Servicio (Instancia)

```ts
createServicio(data)                         // Transacción: valida unicidad nombre + crea franjas + genera disponibilidad 15 días
getServicios({ categoriaId?, estado?, search? })
getServicioById(id)                          // Con franjas + 30 disponibilidades
updateServicio(id, data)                     // Si cambian franjas: borra disponibilidades SIN reservas + regenera
deleteServicio(id, forceInactivate?)         // Bloquea si hay reservas CONFIRMADA/PENDIENTE_PAGO; forceInactivate=true → pasa a INHABILITADO
```

### Generación de disponibilidad (atómica, 15 días)

```ts
generateDisponibilidadesForServicio(servicioId, windowDays = 15, db = prisma)
```

- `cuposTotales = modalidad === EXCLUSIVA ? 1 : capacidadMaxima`
- Usa `upsert` con clave única `(servicioId, franjaId, fecha)` → idempotente
- Se ejecuta dentro de la misma transacción que `createServicio`

---

## 4. Validaciones Zod (`packages/validation/src/service.schema.ts`)

| Schema | Validaciones clave |
|--------|-------------------|
| `createCategoriaSchema` | nombre 2-60, tipo enum válido |
| `updateCategoriaSchema` | Parcial, mismas reglas |
| `franjaHorariaSchema` | diaSemana 1-7, HH:mm o HH:mm:ss, horaFin > horaInicio |
| `createServicioSchema` | Todos los campos obligatorios + **regla: piscina PRIVADA ⇒ EXCLUSIVA** |
| `updateServicioSchema` | Parcial, misma regla de piscina |
| `normalizeServicePayload()` | Mapea `name/categoryId/capacity/modality/schedule` → modelo canónico |

---

## 5. API Routes (Next.js App Router)

### Endpoint unificado: `/api/admin/services`

```http
GET  /api/admin/services?entity=services&categoriaId=1&estado=ACTIVO&search=cancha
GET  /api/admin/services?entity=categories
POST /api/admin/services
```

**POST** discrimina por payload:
```json
// Categoría
{ "entity": "CATEGORIA", "nombre": "Canchas", "tipo": "CANCHA" }

// Servicio (instancia)
{ "nombre": "Cancha 1", "categoriaId": 1, "capacidadMaxima": 10, "tarifa": 50000, "modalidad": "EXCLUSIVA", "franjasHorarias": [{ "diaSemana": 1, "horaInicio": "07:00", "horaFin": "08:00" }] }
```

### Detalle: `/api/admin/services/[id]`

```http
GET    /api/admin/services/[id]
PUT    /api/admin/services/[id]      // Actualización parcial + regenera calendario si cambian franjas
PATCH  /api/admin/services/[id]      // Igual que PUT
DELETE /api/admin/services/[id]?forceInactivate=true
```

### Categorías: `/api/admin/services/categories` y `/api/admin/services/categories/[id]`

CRUD estándar con mismos códigos de error.

---

## 6. Códigos de Error API

| Código | HTTP | Cuándo |
|--------|------|--------|
| `VALIDATION_ERROR` | 400 | Zod falla |
| `DUPLICATE_CATEGORY` | 409 | Nombre categoría existe |
| `DUPLICATE_INSTANCE_NAME` | 409 | Nombre servicio existe en complejo (creación) |
| `DUPLICATE_NAME` | 409 | Nombre servicio existe (actualización) |
| `CATEGORY_NOT_FOUND` | 404 | FK categoría inválida |
| `NOT_FOUND` | 404 | Recurso no existe |
| `INVALID_ID` | 400 | ID no numérico / ≤ 0 |
| `CATEGORY_HAS_SERVICES` | 409 | Borrar categoría con servicios |
| `ACTIVE_RESERVATIONS` | 409 | Borrar servicio con reservas activas (`canInactivate: true`) |
| `SERVER_ERROR` | 500 | Otros errores (sanitizado: no expone rutas/stack/BD) |

---

## 7. Tests

### Unitarios (`packages/validation/test/service.schema.test.ts`)
- Categorías válidas/inválidas
- Franjas: orden cronológico, día 1-7
- Servicios: capacidad > 0, regla piscina privada = EXCLUSIVA
- Normalizador legacy → canónico
- Retrocompatibilidad `serviceSchema`

### Integración API (`apps/web/src/app/api/admin/services/__tests__/route.test.ts`)
1. CRUD categorías (crear, duplicado 409, listar)
2. Alta categorías e instancias vía endpoint unificado
3. **Unicidad nombre instancia por complejo** → 409 `DUPLICATE_INSTANCE_NAME`
4. **Coexistencia calendarios independientes**: Cancha 1 y Cancha 2 no comparten disponibilidad
5. Actualización + eliminación segura (respeta reservas, inactivación preventiva)
6. **Sanitización errores**: solo duplicado real → 409; otros P2002 → 500 genérico sin rutas internas

---

## 8. Cómo usarlo — guía para el equipo

### Crear categoría
```ts
import { createCategoria } from "@sportcomplex/db";

await createCategoria({ nombre: "Canchas Sintéticas", tipo: "CANCHA" });
```

### Crear servicio con calendario
```ts
import { createServicio } from "@sportcomplex/db";

await createServicio({
  nombre: "Cancha 5",
  categoriaId: 1,
  capacidadMaxima: 12,
  tarifa: 75000,
  modalidad: "EXCLUSIVA",
  franjasHorarias: [
    { diaSemana: 1, horaInicio: "07:00", horaFin: "08:00" },
    { diaSemana: 3, horaInicio: "19:00", horaFin: "20:00" },
    { diaSemana: 6, horaInicio: "10:00", horaFin: "12:00" },
  ],
});
// → Transacción atómica: servicio + 3 franjas + ~45 disponibilidades (15 días)
```

### Actualizar franjas (regenera disponibilidad protegiendo reservas)
```ts
import { updateServicio } from "@sportcomplex/db";

await updateServicio(5, {
  franjasHorarias: [
    { diaSemana: 1, horaInicio: "07:00", horaFin: "08:00" },
    { diaSemana: 2, horaInicio: "18:00", horaFin: "19:00" },  // Nueva franja
  ],
});
// → Borra disponibilidades SIN reservas de franjas antiguas + crea nuevas
```

### Borrar servicio (seguro)
```ts
import { deleteServicio } from "@sportcomplex/db";

try {
  await deleteServicio(5);  // Falla si hay reservas activas
} catch (e) {
  if (e.name === "ServiceHasReservationsError") {
    // Opción: inactivar preservando reservas
    await deleteServicio(5, true);  // forceInactivate = true → estado = INHABILITADO
  }
}
```

---

## 9. Errores comunes y qué significan

| Error (Prisma/PG) | Causa | Acción |
|---|---|---|
| `P2002` en `categoria_servicio.nombre` | Categoría duplicada | Informar "ya existe esa categoría" |
| `P2002` en `servicio.nombre` | Servicio duplicado en complejo | Informar "ya existe un servicio con ese nombre" |
| `P2003` FK `categoriaId` | Categoría no existe | Validar antes de insertar |
| `P2002` en `disponibilidad` (servicioId, franjaId, fecha) | Race condition regenerando calendario | El `upsert` lo maneja; es idempotente |
| `ForeignKeyConflictError` (repo) | Borrar categoría con servicios | Mover/borrar servicios primero |
| `ServiceHasReservationsError` (repo) | Borrar servicio con reservas activas | Usar `forceInactivate=true` |

---

## 10. Comandos (desde raíz del monorepo)

```bash
# Regenerar cliente Prisma tras tocar schema
pnpm --filter @sportcomplex/db db:generate

# Aplicar migraciones (desarrollo)
pnpm --filter @sportcomplex/db db:migrate

# Desplegar en CI/VPS
pnpm --filter @sportcomplex/db db:migrate:deploy

# Seeds (roles + catálogo base)
pnpm --filter @sportcomplex/db db:seed

# Tests
pnpm --filter @sportcomplex/validation test
pnpm --filter web test
```

---

## 11. Verificación realizada (2026-10-06)

- Migración `disponibilidad_unique_constraint` aplicada ✓
- `prisma generate` + `tsc --noEmit` OK ✓
- Tests unitarios validación: 17/17 PASS ✓
- Tests integración API: 6/6 PASS ✓
- Sanitización errores verificada: no exponen rutas Windows, schema.prisma, ni stack traces ✓