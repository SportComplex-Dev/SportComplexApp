# Mailbox inter-células — protocolo obligatorio (L3 §4)

## Principio
El **mailbox ES el canal célula↔célula**. Las células se comunican directamente vía mailbox para artefactos.
El tech-lead solo interviene para **arbitraje** (decisiones/bloqueos), no como proxy de todo.

## Canales

| Tipo | Canal | Quién inicia |
|---|---|---|
| **Artefactos** (schemas, specs, mocks, types) | `cells-mailbox/<dest>/inbox/<origen>-<n>.json` | célula origen → célula destino directo |
| **Decisiones/bloqueos** (necesitan arbitraje) | `cells-mailbox/tech-lead/inbox/<origen>-<n>.json` | célula → tech-lead |
| **Notificaciones FYI** | mailbox destino + `worker_done` parcial | célula origen |

## Envelope estándar
```json
{
  "from": "cell-booking",
  "to": "cell-pos",
  "type": "artifact",
  "artifact-path": "packages/features/booking/types/booking.ts",
  "summary": "Nuevo tipo CartItem exportado para carrito POS",
  "version": "v2"
}
```

## Direcciones (inboxes)

```
cells-mailbox/
├── ui/inbox/
├── shared/inbox/
├── booking/inbox/
├── tournament/inbox/
├── pos/inbox/
├── scanner/inbox/
├── portal/inbox/
├── tech-lead/inbox/          # solo para arbitraje
└── PROTOCOLO.md
```

## Flujo típico

1. **cell-booking** termina `types/booking.ts` con nuevo `CartItem`
2. Escribe `cells-mailbox/pos/inbox/booking-001.json` con `artifact-path` al tipo
3. **cell-pos** lee su inbox, ve el artefacto, actualiza su `PosClientForm`
4. **cell-pos** responde `cells-mailbox/booking/inbox/pos-001.json` type `fyi` "integrado"
4. Ambas reportan `worker_done` con manifest

## Anti-deadlock

- Toda espera inter-célula tiene **timeout 4h** + escala a tech-lead
- Esperas circulares prohibidas — tech-lead decide y rompe el ciclo
- Si no hay respuesta en timeout: `type: "blocker"` a tech-lead

## Violaciones

| Qué | Consecuencia |
|---|---|
| Escribir fuera de tu scope (`contracts/*`, `packages/<otra>/`) | Bloqueo + revert |
| Contactar otra célula **fuera del mailbox** para decisiones | Bloqueo |
| Artefacto sin envelope / sin `artifact-path` | Rechazo automático |