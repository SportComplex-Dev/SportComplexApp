# Nota de entrega HU-21.DB — cómo usar el blindaje sin romper nada

> Ya mergeado a `develop` (PR #34). Trabaja directamente sobre `develop` actualizado.

## 1. Cómo usar lo que se hizo (3 comandos)

```bash
git checkout develop && git pull origin develop
npx prisma generate --schema packages/db/prisma/schema.prisma
npx tsx --test test/hu21-empleado-integridad.test.ts   # desde packages/db
```

- `prisma generate` lee el `schema.prisma`, **no toca ninguna DB**: con eso ya puedes
  programar contra el contrato.
- El test confirma que todo sigue en verde antes de empezar.

Qué te llevas: FKs hacia `usuario` en `Restrict` (`pago`, `reserva` titular/vendedor,
`ticket_qr`, `asignacion_puesto`, `lectura_acceso`, `membresia`, `inhabilitacion_servicio`),
`onUpdate: Cascade` explícito, migración idempotente versionada y 4 tests de regresión.

## 2. Cómo NO mandar todo al caño (5 prohibiciones)

1. 🚫 NO corras `prisma migrate dev` ni `migrate reset` apuntando a la Supabase compartida:
   `reset` **BORRA todos los datos** y `dev` falla por drift preexistente (4 migraciones
   viejas sin aplicar en esa DB). En tu base local sí puedes hacer lo que quieras.
2. 🚫 NO apliques migraciones a mano (PgAdmin / DBeaver / psql en Staging / Prod).
   Solo entran por el pipeline (`migrate deploy`) tras el merge.
3. 🚫 NO cambies ningún `onDelete: Restrict` hacia `usuario` a `Cascade` / `SetNull`
   "para probar algo rápido": el test `hu21-empleado-integridad` lo detecta y falla.
   Excepción legítima y documentada: `TokenVerificacion` mantiene `Cascade`
   (token efímero de auth, no historial).
4. 🚫 NO borres usuarios con `prisma.usuario.delete()` ni `DELETE` SQL si tienen historial:
   el motor lo va a rechazar con `P2003 / foreign_key_violation` (ese es el punto).
   Usa baja lógica: `estado → INACTIVO` (+ `deleted_at`).
5. 🚫 NO commitees directo a `develop`: crea tu rama (`feature/...`) y abre PR contra `develop`.

## 3. Si algo falla

- Test en rojo → lee el nombre del caso (indica el CA exacto) antes de tocar el schema.
- Error `P2003 / foreign_key_violation` al borrar un usuario → comportamiento esperado,
  no bug: usa baja lógica.
- Dudas del deploy / drift → ver `docs/HU-21-DB-restricciones-borrado-empleados.md` §4.
