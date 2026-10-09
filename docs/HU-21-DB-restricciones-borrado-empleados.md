# HU-21.DB — Restricciones de integridad y reglas de borrado para empleados

> Rama de trabajo: `feature/hu-21-db-restrict-empleado` (pendiente de crear/PR contra `develop`)
> Responsable: DBA / Ingeniería de Datos · Fecha de implementación: 2026-10-09
> Alcance: solo `packages/db` (schema + migración + test). Sin cambios en API, Middleware ni scripts manuales.

## 1. Qué se hizo y por qué

El sistema transiciona a **baja lógica** (`Usuario.estado = INACTIVO` / `deleted_at`), pero en los
Route Handlers persisten operaciones de **borrado físico** (`DELETE`). Si la base de datos tuviera
reglas `CASCADE`, un borrado por error arrastraría ventas y escaneos, destruyendo historial
financiero y de auditoría. La base de datos debe ser la **última línea de defensa**: rechazar el
`DELETE` a nivel de motor con error de llave foránea.

Auditoría previa (hallazgo clave): el esquema **ya estaba blindado de facto** — la migración
`20260930132534_init_sport_complex` genera `ON DELETE RESTRICT` en todas las FKs hacia `usuario`
de negocio. Lo que faltaba era hacerlo **explícito, entregable y regresionable**:

| # | Cambio | Por qué | Archivo |
|---|--------|---------|---------|
| 1 | `onUpdate: Cascade` explícito en las 9 relaciones hacia `Usuario` (antes implícito por default de Prisma) + comentarios `HU-21.DB` | CA-03 auditable a simple vista; el SQL generado no cambia, pero el contrato queda declarado | `packages/db/prisma/schema.prisma` |
| 2 | Comentario de excepción en `TokenVerificacion.usuario` (mantiene `onDelete: Cascade`) | Token efímero de auth, no historial; purga de tokens debe seguir funcionando. Decisión acordada, fuera del alcance de CA-02 | mismo archivo |
| 3 | Migración `20261009000000_hu21_restrict_borrado_empleado/migration.sql` idempotente (`DROP CONSTRAINT IF EXISTS` + `ADD ... ON DELETE RESTRICT ON UPDATE CASCADE`, 9 FKs) | CA-04: entregable controlado vía pipeline, sin tocar Staging/Production a mano | `packages/db/prisma/migrations/...` |
| 4 | Test de regresión `test/hu21-empleado-integridad.test.ts` (4 casos, estático, sin DB) | Certifica CA-01/02/03/04 en cada CI: schema + SQL auditados automáticamente | `packages/db/test/...` |

Mapeo HU → esquema real (no existen modelos literales `Empleado/Venta/Escaneo`):

| HU | Esquema real |
|----|--------------|
| Empleado | `Usuario` (baja lógica vía `estado` + `deleted_at`) |
| Venta | `Pago` (`usuario_id`) + `Reserva` (`vendedor_id`) |
| Escaneo | `LecturaAcceso` (`empleado_id`) + `TicketQr` (`usado_por`) + `AsignacionPuesto` (`empleado_id`) |
| Otros historiales del empleado | `Reserva` (`titular_id`), `Membresia` (`usuario_id`), `InhabilitacionServicio` (`admin_id`) |

## 2. Requerimientos que cumple el esquema (evidencia)

- **CA-01 Rechazo de borrado activo.** Las 9 FKs son `ON DELETE RESTRICT`:
  `pago_usuario_id_fkey`, `reserva_titular_id_fkey`, `reserva_vendedor_id_fkey`,
  `ticket_qr_usado_por_fkey`, `asignacion_puesto_empleado_id_fkey`,
  `lectura_acceso_empleado_id_fkey`, `membresia_usuario_id_fkey`,
  `inhabilitacion_servicio_admin_id_fkey` (+ `usuario_rol_id_fkey` reafirmada).
  Un `DELETE FROM usuario` con historial aborta con `foreign_key_violation` (P2003 en Prisma).
  Evidencia: `migration.sql` de la HU + test `CA-01/CA-04`.
- **CA-02 Erradicación de cascadas y nulos.** `rg "onDelete: (Cascade|SetNull)" schema.prisma`
  solo devuelve: la excepción documentada `TokenVerificacion` (línea 148),
  `FranjaHoraria→Servicio` (no involucra a usuario) y `SetNull` en FKs que **no referencian**
  a `usuario` (`pago.membresia_id`, `reserva.pago_id/membresia_id/inhabilitacion_id`,
  `lectura_acceso.asignacion_id`). Evidencia: tests `CA-02` y `CA-02-excepción`.
- **CA-03 Preservación de actualizaciones.** Las 8 relaciones protegidas declaran
  `onUpdate: Cascade` explícito; updates de IDs fluyen a tablas hijas, solo el delete se bloquea.
  Evidencia: test `CA-03`.
- **CA-04 Entregable controlado e idempotente.** Migración versionada con patrón
  `DROP IF EXISTS` + `ADD`, re-ejecutable sin pérdida de datos; **no se ejecutó nada manual**
  en la DB compartida. Evidencia: test `CA-01/CA-04` (idempotencia) + este documento.

## 3. Verificación (cómo reproducir)

```bash
# Desde packages/db
npx prisma validate --schema prisma/schema.prisma   # schema válido
npx tsx --test test/hu21-empleado-integridad.test.ts # 4/4 pass
npm test        # 54/54 pass (suite completa)
npm run typecheck  # limpio
# CA-02 manual: rg "onDelete:" prisma/schema.prisma (ver tabla §2)
```

## 4. Notas de despliegue (leer antes del merge)

- **No se aplicó `migrate dev` a la DB compartida a propósito** (CA-04): el intento detectó
  *drift* — la DB remota (Supabase) no tiene aplicadas las migraciones
  `add_avatar_url_to_usuario`, `membresia_vigente_uniq`, `disponibilidad_unique_constraint` y
  `reserva_ttl_partial_index` (índices renombrados + columna `avatar` faltante). Prisma pidió
  `migrate reset` (borrar datos) y se abortó. La migración HU-21 se generó como artefacto
  controlado sin tocar datos.
- **Antes del deploy**, el pipeline (`prisma migrate deploy`) aplicará las 4 migraciones
  pendientes + esta. Si el entorno diverge en nombres de índices, revisar el drift reportado.
- Fuera de alcance (no tocado): controladores API con borrado físico (tarea Backend),
  validaciones de roles del Middleware, estados de sesión. La baja lógica sigue siendo la vía
  oficial (`estado → INACTIVO`); este cambio solo garantiza que el borrado físico falle de
  forma segura si alguien lo intenta.
