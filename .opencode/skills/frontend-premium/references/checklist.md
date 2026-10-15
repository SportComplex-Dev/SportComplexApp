# frontend-premium — checklist rápida

- [ ] Web orquesta rutas/layouts; chrome genérico en `ui`; feature en `features-*`.
- [ ] Validación con `import {xSchema} from "@sportcomplex/validation"` (no duplicar).
- [ ] Fechas `Intl/formatInTimeZone` con `TIMEZONE` (`America/Bogota`), ventana `[hoy,hoy+15]`.
- [ ] QR único (`TicketQrModal+QrGraphic`); `force-static` en `(public)`; `use client` solo CSR.
- [ ] Tokens `--brand-*`, `lucide-react`, `motion`, AA 4.5:1, `prefers-reduced-motion`.
- [ ] `pnpm --filter web typecheck|lint|test` desde `apps/web` verde.
