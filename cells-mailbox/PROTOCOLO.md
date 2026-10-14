# Mailbox inter-células — protocolo obligatorio (L3 §4)

## Regla
Cero comunicación directa célula↔célula. Todo pasa por:
- **Decisiones/bloqueos**: relay vía tech-lead (orchestrator). La célula pregunta al lead, nunca al sibling.
- **Artefactos**: mailbox `cells-mailbox/<cell>/inbox/*.json` con envelope:
  `{from, to, type, artifact-path, summary, version}`.
  Tipos: `contract`, `artifact`, `blocker`, `fyi`.
  Artefactos = archivos versionados (schema, specs, mocks), nunca dumps de código en prosa; paths sobre dumps.

## Direcciones
- `cells-mailbox/db/inbox/` ← solo tech-lead y artefactos aprobados
- `cells-mailbox/backend/inbox/`
- `cells-mailbox/frontend/inbox/`
- `cells-mailbox/infra/inbox/`
- Outbox: cada célula escribe su respuesta como `cells-mailbox/<dest>/inbox/<origen>-<n>.json` en su propio worktree y avisa al lead con `worker_done` parcial o mensaje `fyi`; el lead replica al worktree destino en el merge.

## Anti-deadlock
Toda espera inter-célula lleva timeout y escala al tech-lead. Esperas circulares prohibidas — el lead decide.

## Violaciones
Escribir fuera de tu scope (`contracts/*-contrato.md`) o contactar otra célula directo = bloqueo y revert.
