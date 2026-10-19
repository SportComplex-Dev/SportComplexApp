---
name: frontend-premium
description: UI premium por roles con tokens, motion, Zod de validation, QR único y force-static en apps/web. Usa esta skill cuando crees rutas, componentes ui/features o flujos checkout QR scanner POS.
---

# frontend-premium

> Estado: vigente 2026-10-15

Coordina `apps/web` + `ui` + `features-*`: la web orquesta, el chrome vive en `ui`, la lógica de rol en `features-*`.

## Triggers

- Nueva página/ruta, componente compartido o flujo checkout/QR/scanner/POS.
- Cambio visual (tokens, dark, motion) o caída de LCP.
- Form sin Zod o fecha mal zonificada.
- Duplicación de modal/QR entre web y features.

## Reglas oro

1. **Web coordina**: compone `ui` + `features-*`; cero lógica de negocio en `app/` (delega a `core`/`application`/`db`).
2. **Chrome → `ui`**: `Modal`, `ActionButton`, `ConfirmDialog`, `Button`, `Card` solo de `@sportcomplex/ui`.
3. **Feature → `features-*`**: booking (catálogo/checkout), portal (`TicketQrModal` único + `QrGraphic`), pos, scanner, tournament, admin.
4. Validación con **Zod en `validation`** (`safeParse` → `fail(400)`); QR único (portal), nunca duplicar modales.
5. `(public)` **force-static** (LCP < 1.5 s); fechas con `Intl` + `TIMEZONE=America/Bogota` (06:00–22:00, ventana 15 días).
6. Tokens `--brand-*`, dark mode y `motion` sutil; iconos `lucide-react`.
7. Respuesta y errores vía `ok`/`fail` de `@sportcomplex/shared`; countdown de `expiraEn` tras `201` del lock.

## Verificación (comandos exactos)

```bash
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter @sportcomplex/ui test
pnpm --filter @sportcomplex/features-booking test
pnpm --filter @sportcomplex/features-portal test
pnpm --filter web build
```

LCP: landing `/` debe despachar HTML estático (SSG) sin cómputo para anónimos; `proxy.ts` solo redirige autenticados.

## Anti-patrones

- `Modal` duplicado en web en vez de importar de `ui`.
- `timeSlots` fijos hardcodeados (usar `generarFranjasOperativas`).
- `fetch` sin `ok`/`fail` de `@sportcomplex/shared`.
- `new Date()` sin `TIMEZONE` / `date-fns-tz` (franja vencida, off-by-day).
- Lógica de precios en el componente (va en `core/services/pricing` + `application/precio`).
- Segundo `TicketQrModal`/`QrModal`/`PortalQrModal` (eliminados; solo uno en portal).
- `409` reintentado a ciegas (mostrar "cupo agotado" + refrescar slots).

## Ejemplos

```tsx
// Bien: componer
import { Button, Modal } from "@sportcomplex/ui";
import { CatalogoGrid } from "@sportcomplex/features-booking/components";
import { TicketQrModal } from "@sportcomplex/features-portal/components";
// Fecha Bogotá
import { TIMEZONE } from "@sportcomplex/domain/constantes";
new Intl.DateTimeFormat("es-CO", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(f);
```

```tsx
// Mal: chrome local + slots fijos
const timeSlots = ["08:00", "09:00"]; // prohibido
function ModalLocal() { /* duplicado */ }
```

## Checklist

- [ ] Chrome importado de `ui`; QR único de portal.
- [ ] Form validado con Zod (`validation`), errores con `fail`.
- [ ] Fechas `America/Bogota`, ventana 15 d, horario 06–22.
- [ ] `(public)` estática, LCP < 1.5 s, dark verificado.
- [ ] Tokens `--brand`, `motion` sin bloquear, `lucide` consistente.
- [ ] `409/422` con mensaje + refresco (sin reintento ciego).
- [ ] Tests web + paquete verdes.

## Ref docs

- `apps/web/README.md`, `packages/ui/README.md`, `packages/features/README.md`, `docs/architecture/design-system.md`, `docs/architecture/packages-features.md`
