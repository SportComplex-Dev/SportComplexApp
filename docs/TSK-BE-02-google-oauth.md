# TSK-BE-02 — Google OAuth y vinculación de cuentas

## Requisitos y persistencia

La SRS (`RF-01`) y la arquitectura (`§8.1`) establecen que una cuenta Google
queda activa inmediatamente. El esquema de `USUARIO` de `TSK-BD-06` ya incluye
`google_sub` único, `correo` único, `avatar_url`, `nombre`, `estado` y el rol.
Por eso esta tarea no requiere una migración.

El callback de Auth.js en `apps/web/src/auth.ts` persiste la identidad Google
antes de crear la sesión:

- Solo acepta perfiles Google con `email_verified = true`.
- Busca primero por `google_sub` y luego por correo, sin distinguir mayúsculas.
- Vincula el `google_sub` a la fila existente y actualiza nombre, correo, avatar
  y estado a `ACTIVO`; no cambia el rol existente.
- Crea un único usuario con rol `CLIENTE` cuando el correo/sub no existe.
- Rechaza correos ambiguos, sub ya asociado a otra cuenta, cuentas borradas
  lógicamente e inactivas.

La unicidad de `correo` y `google_sub` en PostgreSQL es la última defensa contra
duplicados concurrentes. El JWT de Auth.js guarda el id, rol y estado para que
el middleware autorice solo sesiones activas. La cookie de sesión es
`HttpOnly`, `SameSite=Lax` y `Secure` en producción; en desarrollo local HTTP
no se marca `Secure` para que el navegador pueda enviarla.

## Configuración local y Google Cloud

1. Configura `AUTH_SECRET` con un valor aleatorio propio (por ejemplo,
   `openssl rand -base64 32`) y completa `AUTH_GOOGLE_ID` y
   `AUTH_GOOGLE_SECRET` en `apps/web/.env.local`.
2. En Google Cloud Console, configura OAuth como aplicación web y añade el
   origen `http://localhost:3000` y el URI autorizado
   `http://localhost:3000/api/auth/callback/google`.
3. En producción, usa el dominio HTTPS real y su URI
   `https://<dominio>/api/auth/callback/google`; configura las variables
   correspondientes en el entorno de despliegue, no en el repositorio.
4. Inicia el frontend (`pnpm --filter web dev`) y prueba el botón “Continuar
   con Google”.

## Verificación del criterio de aceptación

Con un usuario de prueba ya existente con `correo = juan@example.com`:

1. Inicia sesión con la cuenta Google cuyo correo verificado sea
   `juan@example.com`.
2. Comprueba en la base de datos que siga existiendo una sola fila para ese
   correo, que `google_sub` tenga el subject de Google y que `estado = ACTIVO`.
3. Confirma que `rol_id` no cambió y que el navegador recibió la cookie de
   sesión `HttpOnly` (y `Secure` al probar en HTTPS).

La cuenta puede inspeccionarse sin exponer secretos:

```sql
SELECT id, correo, google_sub, nombre, avatar_url, estado, rol_id
FROM usuario
WHERE lower(correo) = lower('juan@example.com');
```
