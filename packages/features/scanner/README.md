# Feature scanner (`packages/features/scanner`)

> Estado: vigente 2026-10-15

## Qué es

Control de acceso en portería: 11 componentes, `useScannerController`, `useAudioFeedback`, `scannerService`, types. Cámara vía `html5-qrcode`, tolerante a red.

## Estructura / Exports

```
src/{components,hooks,services,types}/
src/hooks/{useScannerController,useAudioFeedback}.ts
src/services/scannerService.ts
```

Deps: `ui`, `core`, `shared`. Exports: `.`, `./components`, `./hooks`, `./services`, `./types`.

## Cómo usar

```tsx
import { useScannerController } from "@sportcomplex/features-scanner/hooks";

const { estado, escanear } = useScannerController({ modo: "turno" });
```

## Límites (No hacer)

- No validar QR en cliente (verificar en `POST /api/access` con HMAC).
- No guardar lecturas fuera de `ejecutarLectura` (auditoría 1 fila/escaneo).
- No bloquear el scanner si cae la red (modo consulta + reintento).

## Testing

```bash
pnpm --filter @sportcomplex/features-scanner test
pnpm --filter @sportcomplex/features-scanner typecheck
```

60 tests co-locados.

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/control-acceso.md`
