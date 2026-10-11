# TSK-BD-12 — Modelo Relacional y Migraciones de Torneos, Bloqueos e Inscripciones

- **Tarea ID:** [SCRUM-165] TSK-BD-12
- **Épica:** [SCRUM-164] [EPIC-10] Gestión de Torneos, Bloqueo de Pistas e Inscripciones
- **Responsable:** Sebastián Mendoza Brieva
- **Componente:** Database (`@sportcomplex/db`)
- **Rama:** `feature/SCRUM-165-modelos-torneos`
- **Motor:** PostgreSQL

---

## 1. Alcance y Objetivos

1. **Modelado Entidad-Relación:**
   - Incorporar al esquema de Prisma los modelos `Torneo`, `TorneoBloqueo` e `InscripcionTorneo`.
   - Extender el enum `TipoPago` con el valor `TORNEO`.
   - Definir los enums `EstadoTorneo` y `EstadoInscripcionTorneo`.
2. **Migración SQL Aditiva:**
   - Garantizar compatibilidad con las 16 tablas existentes sin pérdida de datos ni regresiones.
   - Definir claves foráneas con reglas de integridad referencial (`ON DELETE RESTRICT` / `ON UPDATE CASCADE` en usuarios y servicios, `ON DELETE CASCADE` en bloqueos de torneo eliminados).
3. **Repositorio y Pruebas Unitarias:**
   - Crear `packages/db/src/repositories/tournaments.ts` con funciones para creación, listado, obtención, actualización, inscripción y canje de tickets.
   - Proveer tests unitarios completos en `packages/db/src/repositories/tournaments.test.ts`.

---

## 2. Modelos Relacionales (Prisma)

### 2.1. `Torneo`
- Representa el evento deportivo organizado por el club.
- Clave primaria UUID (`id`).
- Relacionado con `Usuario` (`adminId`, creador), `CategoriaServicio` (`categoriaId`).
- Atributos: `titulo`, `descripcion`, `nivel`, `fechaInicio`, `fechaFin`, `cuposTotales`, `cuposOcupados`, `precioInscripcion`, `estado`.

### 2.2. `TorneoBloqueo`
- Asocia el torneo con las pistas deportivas (`Servicio`) y los rangos de fecha/hora de juego.
- Permite al motor de reservas (`TSK-BE-25`) identificar qué franjas quedan reservadas para el torneo y no pueden ser tomadas por reservas particulares.

### 2.3. `InscripcionTorneo`
- Registro de un usuario en un torneo (`torneoId`, `usuarioId`). Restricción `UNIQUE(torneo_id, usuario_id)`.
- Atributos para dobles/equipos (`nombrePareja`).
- Enlace opcional a `Pago` (`pagoId`).
- Código de ticket UUID (`ticketCodigoUuid`) con firma HMAC, estado `EMITIDO` -> `USADO`, fecha y empleado de validación en portería.

---

## 3. Script de Migración SQL

Migración: `packages/db/prisma/migrations/20261011120000_modulo_torneos/migration.sql`

```sql
ALTER TYPE "TipoPago" ADD VALUE IF NOT EXISTS 'TORNEO';

DO $$ BEGIN
  CREATE TYPE "EstadoTorneo" AS ENUM ('BORRADOR', 'INSCRIPCIONES_ABIERTAS', 'EN_CURSO', 'FINALIZADO', 'CANCELADO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoInscripcionTorneo" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADA', 'CANCELADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "torneo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "nivel" VARCHAR(60) NOT NULL,
    "fecha_inicio" TIMESTAMPTZ NOT NULL,
    "fecha_fin" TIMESTAMPTZ NOT NULL,
    "cupos_totales" INTEGER NOT NULL,
    "cupos_ocupados" INTEGER NOT NULL DEFAULT 0,
    "precio_inscripcion" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "estado" "EstadoTorneo" NOT NULL DEFAULT 'BORRADOR',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "torneo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "torneo_bloqueo" (
    "id" SERIAL NOT NULL,
    "torneo_id" UUID NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "hora_inicio" TIMESTAMPTZ NOT NULL,
    "hora_fin" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "torneo_bloqueo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inscripcion_torneo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "torneo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "pago_id" UUID,
    "estado" "EstadoInscripcionTorneo" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "nombre_pareja" VARCHAR(120),
    "ticket_codigo_uuid" UUID DEFAULT gen_random_uuid(),
    "ticket_estado" "EstadoTicket" NOT NULL DEFAULT 'EMITIDO',
    "ticket_usado_en" TIMESTAMPTZ,
    "ticket_usado_por" UUID,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inscripcion_torneo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "torneo_fecha_inicio_estado_idx" ON "torneo"("fecha_inicio", "estado");
CREATE INDEX IF NOT EXISTS "torneo_bloqueo_servicio_id_hora_inicio_hora_fin_idx" ON "torneo_bloqueo"("servicio_id", "hora_inicio", "hora_fin");
CREATE UNIQUE INDEX IF NOT EXISTS "inscripcion_torneo_torneo_id_usuario_id_key" ON "inscripcion_torneo"("torneo_id", "usuario_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inscripcion_torneo_ticket_codigo_uuid_key" ON "inscripcion_torneo"("ticket_codigo_uuid");
CREATE INDEX IF NOT EXISTS "inscripcion_torneo_usuario_id_estado_idx" ON "inscripcion_torneo"("usuario_id", "estado");
```

---

## 4. Verificación y Resultados de Pruebas

- `@sportcomplex/db`: 78 pruebas unitarias aprobadas (100% éxito).
- `tsc --noEmit`: Tipado estricto sin errores.
- `eslint .`: Cero errores de linting.
