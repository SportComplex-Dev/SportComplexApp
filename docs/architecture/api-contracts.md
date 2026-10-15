# Contratos API REST + OpenAPI

> Estado: vigente 2026-10-15

## Qué es

Contrato HTTP de la plataforma. `openapi.json` se **genera** (no se edita a mano) desde routes reales + schemas Zod.

## Cómo generar

```bash
pnpm docs:openapi
```

`scripts/generate-openapi.ts`: escanea `apps/web/src/app/api/**/route.ts` (paths + métodos `GET/POST/PUT/PATCH/DELETE`), convierte `[id]` → `{id}`, y vuelca `components.schemas` desde `@sportcomplex/validation` vía `zod-to-openapi`. Salida: `docs/api/openapi.json` (41 paths). Commitear el diff generado.

## Auth

- Sesión NextAuth/Supabase; `proxy.ts` perimetral: 401 sin sesión, 403 sin rol.
- Roles: Cliente→`/portal`, Vendedor→`/pos`, Lector→`/scanner`, Admin→`/admin`. `internal/*` exige `INTERNAL_API_KEY`; `cron/*` exige `CRON_SECRET`.

## Formato ok/fail

```json
{ "success": true, "data": {}, "timestamp": "2026-10-15T12:00:00.000Z" }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} }, "timestamp": "..." }
```

Helpers: `ok()` / `created()` (201) / `fail(code, message, status, details?)` de `@sportcomplex/shared`.

## Códigos

| Código | Cuándo |
|---|---|
| 200/201 | OK / creado (`created` en POST de booking/pago) |
| 400 | `VALIDATION_ERROR` (Zod falla) |
| 401 | `UNAUTHORIZED` (sin sesión) |
| 403 | `FORBIDDEN` (rol insuficiente, cuenta inactiva) |
| 404 | recurso inexistente (disponibilidad/servicio) |
| 409 | sin cupo o doble inhabilitación |
| 422 | fuera de ventana 15 días |
| 429 | `RATE_LIMITED` / `TOKEN_LOCKED` (OTP) |
| 503 | `AUTHORIZATION_UNAVAILABLE` (Auth caído, fail-closed) |

Tags: `Public`, `Auth`, `Bookings`, `Portal`, resto por primer segmento.

## Ref docs

- `docs/api/openapi.json` (generado), `packages/validation/README.md`, `packages/shared/README.md`, `apps/web/README.md`
