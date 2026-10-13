# TSK-BE-25 — Endpoints Administrativos de Torneos y Motor de Bloqueo Preventivo

- **Tarea ID:** [SCRUM-166] TSK-BE-25
- **Épica:** [SCRUM-164] [EPIC-10] Gestión de Torneos, Bloqueo de Pistas e Inscripciones
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
