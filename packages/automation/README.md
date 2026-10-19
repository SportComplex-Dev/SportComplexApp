# Workflows n8n (`packages/automation`)

> Estado: vigente 2026-10-15

## Qué es

8 workflows versionados como JSON (fuente lista para importar a n8n). El backend los dispara fire-and-forget con HMAC; n8n responde y despacha correos vía Resend.

## Estructura / Exports

```
workflows/envio-codigo-verificacion-otp.json   # OTP registro (webhook auth/enviar-codigo)
workflows/despacho-correo-qr.json              # QR reserva confirmada
workflows/contingencia-reintentos.json         # outbox + backoff (TSK-BE-22b)
workflows/notificacion-contingencia.json       # aviso inhabilitación (HMAC)
workflows/reporte-gerencial-programado.json    # cron lunes 07:00 America/Bogota
workflows/sincronizacion-festivos-colombia.json# Nager.Date → festivos
workflows/fallo-cobro-membresia.json           # cobro recurrente fallido
workflows/gestion-errores.json                 # dead-letter global
```

Sin `package.json`: no se compila, se importa.

## Cómo usar

```bash
for f in packages/automation/workflows/*.json; do python3 -m json.tool "$f" > /dev/null && echo "OK $f"; done
```

Deploy: n8n → Workflows → Import from file → seleccionar JSON → activar con **Separate** (un workflow por archivo, nunca fusionar). Configurar `RESEND_API_KEY`, `N8N_CONTINGENCY_HMAC_SECRET`, `ADMIN_REPORT_RECIPIENTS`.

## Límites (No hacer)

- No commitear secretos/URLs prod en los JSON (usar env de n8n).
- No llamar a n8n de forma bloqueante desde la route (timeout 2.5 s, sin reintentos en caliente).
- No cambiar payloads sin actualizar `validation/business/automation.schema.ts`.

## Testing

```bash
for f in packages/automation/workflows/*.json; do python3 -m json.tool "$f" > /dev/null && echo "OK $f"; done
pnpm --filter @sportcomplex/validation test
```

Manual: disparar webhook-test con `curl` (ejemplos en `docs/automation/workflows.md`).

## Ref docs

- `docs/automation/` (overview, workflows, webhooks, implementation-guide, index, setup-summary), `docs/automation/webhooks.md` (firma HMAC)
