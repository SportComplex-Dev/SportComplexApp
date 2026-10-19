# Entornos Supabase

> Estado: vigente 2026-10-19

> No commitear secretos. Las claves (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SEED_ADMIN_PASSWORD`) viven en GitHub Environment Secrets (`production`) y en el `.env` del VPS (modo `0600`). Nunca en git ni en este archivo.

## Mantenimiento (SCRUM-208 / SCRUM-209)

### 1. Mapeo de Proyectos Supabase & Custodia de Credenciales
- **Producción (`prod`):**
  - Proyecto Supabase Ref: `ouemmmwpygmizyvtcpuc` (en el panel aparece como `SportComplex-Dev`).
  - Uso: Base de datos oficial de producción (clientes, reservas y transacciones) desde la migración del 2026-10-19; incluye el bucket espejo `sportcomplex-assets`.
  - Custodia: Las credenciales (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`) residen en GitHub Environment Secrets (`production`) y en el `.env` del VPS (modo `0600`).
- **Desarrollo / heredado (`develop`):**
  - Proyecto Supabase Ref: `phyesjwtzrmrcvmtajay`
  - Uso: Entorno de integración y pruebas. Conserva los datos previos a la migración (10 usuarios en Auth, 12 reservas, 4 pagos al 2026-10-19). Configurado en `packages/db/.env` o `apps/web/.env.local`.
  - Custodia: Claves restringidas a desarrolladores autorizados en el almacén de secretos del equipo.

### 2. Backup Cifrado de Producción
Antes de cualquier ventana de mantenimiento o purga, generar el volcado binario y cifrarlo con **AES-256-CBC** usando derivación de clave moderna (**PBKDF2** con 100,000 iteraciones):

```bash
## 1. Volcado binario (usar Session Pooler IPv4 si tu red no tiene IPv6):
pg_dump "postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres" -Fc -f backup_prod_prod.dump

## 2. Cifrado criptográfico con PBKDF2:
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -in backup_prod_prod.dump -out backup_prod_prod.dump.enc

## 3. Custodia y limpieza segura:
## Mover 'backup_prod_prod.dump.enc' al almacenamiento seguro fuera de línea (Cold Storage / Vault).
## Destruir inmediatamente el archivo sin cifrar:
shred -u backup_prod_prod.dump 2>/dev/null || rm -f backup_prod_prod.dump
```

### 3. Ventana de Mantenimiento y Purga de Datos de Prueba en Producción
- **Ventana Oficial:** Domingos de madrugada (02:00 – 04:00 COT / UTC-5), horario de tráfico mínimo.
- **Auditoría y Purga:** Para no violar las restricciones `ON DELETE RESTRICT` (HU-21) de usuarios con reservas/pagos asociados y para purgar simultáneamente las identidades en Supabase Auth (`auth.users`), utilizar los scripts dedicados:

```bash
## Script TypeScript con lista blanca de staff (TSK-BD-02 / HU-37):
## protege los correos institucionales y emite purge-reports/purge-report-*.json
## con los IDs de los registros eliminados (auditoría).

## Modo dry-run (solo lectura / auditoría) — ejecutar SIEMPRE primero:
pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.ts --dry-run

## Modo ejecución:
pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.ts --execute

## Requisito previo: backup verificado de producción (TSK-BD-01),
## ver infra/backup-produccion.md.
```

### 4. Bootstrap de Producción (`bootstrap:prod`)
Para inicializar producción de forma limpia y estrictamente idempotente (crea roles del sistema, planes oficiales de membresía y 1 cuenta de administrador inicial en Supabase Auth y en la tabla `usuario` con hash Argon2id):

```bash
## Ejecución estándar (requiere SEED_ADMIN_PASSWORD obligatoria):
SEED_ADMIN_PASSWORD="tu-contraseña-segura" pnpm bootstrap:prod

## Para rotar la contraseña de una cuenta de administrador existente:
SEED_ADMIN_PASSWORD="nueva-contraseña-segura" pnpm bootstrap:prod --rotate-password
```
