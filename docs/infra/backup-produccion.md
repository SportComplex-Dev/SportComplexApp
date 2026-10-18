# Backup y restauración de la BD de producción

> Estado: vigente 2026-10-18.

Pipeline automatizado para producir un backup íntegro y verificable de la BD de
producción (PostgreSQL + roles + identidades de Supabase Auth), cifrado y
custodiado fuera del servidor. Referencia histórica: TSK-BD-01 / SCRUM-222 /
HU-37 (ejecutado el 2026-10-18 como pre-requisito de la purga de usuarios de
prueba).

## Entorno

| Campo | Valor |
|---|---|
| Proyecto Supabase (producción) | `phyesjwtzrmrcvmtajay` |
| Credenciales | `apps/web/.env.backup.local` (gitignored; ver `.env.example` §Backup) |
| Script | `packages/db/scripts/backup-prod.mts` |
| Comando | `pnpm --filter @sportcomplex/db backup all` |

El script **aborta** si `BACKUP_DATABASE_URL` no apunta al proyecto de
producción (guard por `PROJECT_REF`).

## Cómo funciona

Fases por subcomando (orden que valida el criterio de aceptación clave: el
backup solo se considera bueno si la restauración local coincide):

1. **Dump**: `pg_dump --no-owner --no-privileges` (SQL completo) +
   `pg_dumpall --globals-only --no-role-passwords` (roles) +
   **snapshot de identidades Supabase Auth** vía Admin API
   (`GET /auth/v1/admin/users` paginado) + `manifest.json` con SHA-256 y
   conteo de filas por tabla.
2. **Cifrado**: `tar.gz` del run + **GPG simétrico AES-256**
   (`--symmetric --cipher-algo AES256`) con prueba de roundtrip (descifra y
   compara hash sin escribir el plano). Nota: el runbook histórico de
   `supabase-envs.md` (rama `develop`) describe un cifrado manual
   con `openssl enc -aes-256-cbc -pbkdf2`; el esquema **automatizado y
   vigente** para este flujo es GPG AES-256 — ambos quedan como referencia,
   no se mezclan en un mismo run.
3. **Verificación**: cluster PostgreSQL local transitorio
   (`initdb`/`pg_ctl` en puerto ≥ 54331) → restauración del dump (extensiones
   exclusivas de Supabase omitidas y anotadas) → comparación de conteos por
   tabla contra el manifiesto remoto.
4. **Custodia**: bucket privado `backups` de Supabase Storage (producción),
   prefijo `tsk-bd-01/<stamp>`, con re-verificación del hash del `.gpg`
   descargado.

## Comandos

```bash
# Backup completo (dump → encrypt → verify → upload)
pnpm --filter @sportcomplex/db backup all

# Fases individuales
pnpm --filter @sportcomplex/db backup dump
pnpm --filter @sportcomplex/db backup encrypt
pnpm --filter @sportcomplex/db backup verify
pnpm --filter @sportcomplex/db backup upload
```

## Decisiones y restricciones

- El directorio del cluster de verificación es configurable con
  `BACKUP_VERIFY_CLUSTER_DIR` (default `C:/SC/verify-cluster`).
- El `.gpg` solo puede abrirse con `BACKUP_GPG_PASSPHRASE` (gestor de
  contraseñas; si se pierde, los backups subidos son irrecuperables).
- `backups/`, `*.gpg` y `*auth_users_snapshot*.json` están en `.gitignore`.
- La passphrase y las credenciales nunca se versionan.
- Contramedida operativa relacionada (entorno aislado, no producción):
  `purge-test-users` en `packages/db/scripts/` (ver `supabase-envs.md` §3).

## Evidencia del run de aceptación (2026-10-18)

- Run: `backups/2026-10-18T18-18-01-229Z/` (gitignored; artefactos en el bucket)
- `manifest.json`: 57 tablas, `auth.identities: 17`, snapshot Auth con 17 usuarios
- `verify-report.json`: `ok: true`, 57/57 tablas restauradas, 0 diferencias
  (`supabase_vault` omitido localmente por ser extensión exclusiva de Supabase)
- `encrypt-report.json`: AES256, roundtrip verificado
- `upload-report.json`: 3 objetos en `backups/tsk-bd-01/2026-10-18T18-18-01-229Z/`,
  hash del `.gpg` verificado por descarga
