---
name: docs-sync
description: Crea o actualiza documentación por dominio (product, architecture, features, automation, infra, onboarding) con plantilla Estado, registro en índices y validación de links. Usa esta skill cuando toques docs, crees READMEs o propongas ADRs en SportComplex.
---

# docs-sync

> Estado: vigente 2026-10-15

Guardián de `docs/` y READMEs: decide crear vs actualizar, aplica plantilla y deja todo enlazado.

## Triggers

- Nuevo `packages/*` o `apps/*` sin README; nuevo `features-*` sin ficha.
- Cambio de código que altera un `docs/features/*` o `docs/automation/*`.
- Propuesta de ADR, índice `docs/README.md` desactualizado, links rotos.
- README sin snippet, sin testing exacto o con H1 por tarea.

## Reglas oro

1. **Crear vs actualizar por dominio:**
   - `product/` (RF/RN nuevos), `architecture/`, `infra/` → **actualizar** el doc del tema, no crear archivo.
   - `features/*` → **actualizar mismo PR** que el código (doc desactualizado = bug).
   - `packages/*` / `apps/*` faltantes → **crear** README con plantilla (H1 dominio, Qué es, Estructura/Exports, Cómo usar, Límites No hacer, Testing, Ref docs).
   - `automation` (index/setup) → **fusionar**, no duplicar: enlaza, no copies.
   - ADR → **crear** `docs/architecture/adrs/NNN-kebab.md` + registrar en índice.
2. Naming `kebab-case.md`, **1x H1**, español, banner `> Estado: vigente YYYY-MM-DD`.
3. Sin `TSK-XX`/`HU-XX` en H1 ni archivos por tarea; IDs solo como referencia histórica en el cuerpo.
4. Todo doc nuevo se **registra en `docs/README.md`** (o README padre).
5. Un doc = una fuente de verdad: enlaza, no dupliques; fecha solo lo transitorio.

## Workflow (6 pasos)

1. Clasificar dominio: `product|architecture|features|automation|infra|onboarding`.
2. Decidir crear vs actualizar (tabla de arriba); **leer el doc existente antes de crear**.
3. Aplicar plantilla (`documentation-guidelines.md` §5) + banner Estado + snippet ejecutable.
4. Registrar enlace en `docs/README.md` (tabla del tema correcto).
5. Validar links con `grep` (todo `./x.md` debe existir) + `pnpm docs:check`.
6. Verificar que el PR incluye código + doc juntos; pedir revisión si cambia ADR.

## Verificación (comandos exactos)

```bash
pnpm docs:check
grep -rnoE '\]\(\./[^)]+\.md\)' docs packages/*/README.md apps/web/README.md | head -50
ls docs/features/ docs/automation/ docs/architecture/adrs/
grep -rn "^# " docs/features/reservas.md | head -5
```

Si `docs:check` falla, reparar el link o el índice antes de seguir; no commitear docs rotos.

## Anti-patrones

- Doc por tarea (`TSK-123.md`, `HU-45-pagos.md`) en vez de por tema.
- Duplicar contenido entre `automation/index.md` y `setup-summary.md` en vez de fusionar.
- Crear README sin snippet ejecutable ni comando de testing exacto.
- Olvidar registrar el enlace en el índice.
- Editar `docs/api/openapi.json` a mano (se genera con `pnpm docs:openapi`).
- Banner `Estado` ausente o fecha vieja en doc transitorio.

## Ejemplos

```markdown
# Reservas

> Estado: vigente 2026-10-15

## Contexto
Ventana 15 días (RN-04), TTL 30 min...

## Testing
pnpm --filter @sportcomplex/db test
```

ADR nuevo: copiar `002-separacion-domain-seed.md` como base, numerar `NNN-kebab`, estado Propuesto/Aprobado.

## Checklist

- [ ] Dominio clasificado y decisión crear/actualizar justificada.
- [ ] Kebab-case, 1x H1, español, banner Estado.
- [ ] Sin TSK/HU en H1 ni archivo suelto por tarea.
- [ ] Snippet ejecutable + testing exacto incluidos.
- [ ] Enlace registrado en `docs/README.md`.
- [ ] `pnpm docs:check` verde y `grep` de links sin rotos.
- [ ] Mismo PR que el código que documenta.

## Ref docs

- `docs/documentation-guidelines.md`, `docs/README.md`, `docs/architecture/packages-features.md`
