# Torneos
> Estado: vigente 2026-10-15

- **Componente:** Database (`@sportcomplex/db`)
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
   - Crear `packages/db/src/repositories/catalog/tournaments.ts` con funciones para creación, listado, obtención, actualización, inscripción y canje de tickets.
   - Proveer tests unitarios completos en `packages/db/src/repositories/catalog/tournaments.test.ts`.

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
## TSK-BE-25 — Endpoints Administrativos de Torneos y Motor de Bloqueo Preventivo

> Ref histórica — Tarea: [SCRUM-166] TSK-BE-25
> Ref histórica — Épica: [SCRUM-164] [EPIC-10] Gestión de Torneos, Bloqueo de Pistas e Inscripciones
- **Componentes:** `@sportcomplex/db`, `@sportcomplex/validation`, `apps/web`
- **Ramas:** `feature/SCRUM-166-endpoints-admin-torneos-bloqueo` -> `develop`

---

## 1. Contexto y Objetivos

El módulo de gestión administrativa de torneos permite a los administradores del complejo deportivo:
1. Crear, consultar, editar y cancelar/eliminar torneos deportivos.
2. Asignar franjas y pistas deportivas específicas requeridas para los eventos del torneo.
3. Ejecutar un **motor de bloqueo preventivo de franjas**:
   - Detectar conflictos con reservas particulares previamente activas (`CONFIRMADA` o `PENDIENTE_PAGO` no expiradas).
   - Bloquear las franjas horarias correspondientes marcando `bloqueadaMantenimiento = true` en `Disponibilidad`.
   - Aprovisionar franjas futuras fuera de la ventana deslizante de 15 días con bloqueo inmediato para evitar sobreventa (*overbooking*).
   - Respetar inhabilitaciones físicas o de mantenimiento correctivo (`InhabilitacionServicio`) al liberar pistas tras la cancelación o eliminación de un torneo.
   - Restringir el cruce de medianoche en las franjas para mantener la consistencia del calendario horario.

---

## 2. Contrato de API REST

Todos los endpoints administrativos requieren autenticación y rol canónico `Administrador`.

### 2.1. `POST /api/admin/tournaments`
Crea un nuevo torneo y registra sus bloqueos de pista.

- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "titulo": "Torneo Apertura Pádel 2026",
  "descripcion": "Torneo oficial de pádel categoría abierta",
  "categoriaId": 1,
  "nivel": "OPEN",
  "fechaInicio": "2026-11-07T08:00:00-05:00",
  "fechaFin": "2026-11-07T18:00:00-05:00",
  "cuposTotales": 16,
  "precioInscripcion": 60000,
  "estado": "BORRADOR",
  "bloqueos": [
    {
      "servicioId": 1,
      "horaInicio": "2026-11-07T08:00:00-05:00",
      "horaFin": "2026-11-07T12:00:00-05:00"
    }
  ]
}
```
- **Respuestas:**
  - `201 Created`: Torneo registrado exitosamente con bloqueos aplicados.
  - `400 Bad Request`: Error de validación Zod (`VALIDATION_ERROR`).
  - `409 Conflict`: Pista ocupada por reservas previas (`COURT_SLOT_CONFLICT`).
  - `401 / 403`: No autenticado o sin rol de `Administrador`.

### 2.2. `GET /api/admin/tournaments`
Lista torneos con paginación y filtros opcionales.

- **Query Params:**
  - `page`: Número de página (default 1).
  - `limit`: Límite de elementos por página (default 20, max 100).
  - `estado`: Filtro por estado (`BORRADOR`, `INSCRIPCIONES_ABIERTAS`, `EN_CURSO`, `FINALIZADO`, `CANCELADO`).
  - `categoriaId`: ID de la categoría o deporte.
  - `soloActivos`: Booleano para filtrar estados no cancelados.
  - `search`: Término de búsqueda por título o descripción.
- **Respuestas:**
  - `200 OK`: Lista paginada de torneos.

### 2.3. `GET /api/admin/tournaments/[id]`
Consulta el detalle completo de un torneo, sus pistas bloqueadas y lista de participantes inscritos.

- **Parámetros de Ruta:** `id` (UUID v4).
- **Respuestas:**
  - `200 OK`: Detalle del torneo.
  - `400 Bad Request`: `INVALID_ID` si no es un UUID válido.
  - `404 Not Found`: Torneo no encontrado.

### 2.4. `PATCH / PUT /api/admin/tournaments/[id]`
Actualiza los metadatos, estado o configuración de bloqueos de un torneo.

- **Parámetros de Ruta:** `id` (UUID v4).
- **Reglas de Transición de Estado (FSM):**
  - `BORRADOR` -> `INSCRIPCIONES_ABIERTAS`, `CANCELADO`
  - `INSCRIPCIONES_ABIERTAS` -> `EN_CURSO`, `CANCELADO`
  - `EN_CURSO` -> `FINALIZADO`, `CANCELADO`
  - `FINALIZADO` -> (Estado terminal)
  - `CANCELADO` -> (Estado terminal)
- **Respuestas:**
  - `200 OK`: Torneo actualizado.
  - `400 Bad Request`: Validación o transición ilegal (`INVALID_STATE_TRANSITION`).
  - `409 Conflict`: Conflicto de pistas en el nuevo horario.

### 2.5. `DELETE /api/admin/tournaments/[id]`
Cancela o purga un torneo:
- Si el torneo está en `BORRADOR` y no tiene inscritos: eliminación física en cascada y liberación de bloqueos.
- Si tiene inscritos o no está en `BORRADOR`: transición controlada a `CANCELADO` y liberación de bloqueos.

---

## 3. Arquitectura del Motor de Bloqueo Preventivo

### 3.1. Detección de Conflictos (`verificarConflictoReservas`)
- Evalúa solapamiento de horario entre el intervalo del bloqueo solicitado `[horaInicio, horaFin]` y las franjas horarias configuradas (`FranjaHoraria`) del servicio.
- Realiza el cómputo de segundos transcurridos en el día calendario legal (`America/Bogota`, UTC-5).
- Si existen reservas en estado `CONFIRMADA` o `PENDIENTE_PAGO` (con TTL vigente) que intersectan la franja, aborta arrojando `TournamentError(COURT_SLOT_CONFLICT, 409)`.

### 3.2. Aprovisionamiento Anticipado (> 15 Días)
- Si un torneo se programa a más de 15 días vista (fuera de la ventana de disponibilidad generada por el cron diario), `aplicarBloqueosDisponibilidad` genera de forma proactiva mediante `upsert` las filas requeridas en `Disponibilidad` marcándolas con `bloqueadaMantenimiento = true`.
- Evita condiciones de carrera y previene overbooking cuando el cron diario alcance esa fecha.

### 3.3. Liberación Segura de Bloqueos (`liberarBloqueosTorneo`)
- Al cancelar o eliminar un torneo, se desactiva el bloqueo de pista (`bloqueadaMantenimiento = false`).
- Antes de reabrir la franja al público, verifica si existe una `InhabilitacionServicio` activa en esa fecha para ese servicio. Si la cancha está inhabilitada por avería o mantenimiento correctivo, se mantiene bloqueada.

### 3.4. Transaccionalidad Atómica (ACID)
Todas las operaciones que mutan torneos y disponibilidad (`crearTorneo`, `actualizarTorneo`, `actualizarEstadoTorneo`, `eliminarTorneo`) operan bajo una transacción `prisma.$transaction`.

## Trazabilidad

> Ref histórica: SCRUM-164/165/166 (EPIC-10) · ramas `feature/SCRUM-165-modelos-torneos`, `feature/SCRUM-166-endpoints-admin-torneos-bloqueo`
