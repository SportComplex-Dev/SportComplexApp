# Política quota (orden usuario 2026-10-14)

Ante primer `429` / `RESOURCE_EXHAUSTED` / `quota exhausted` en cualquier célula:
1. Tech-lead envía `--interrupt` a los 4 terminales (pausa, NO `worker-stop` para no matar dispatch).
2. No se reintenta ni se relanza nada (reintentos queman ventana de reset).
3. Se avisa al usuario y se espera re-enrol con cuenta de tokens pristinos.
4. Solo tras confirmación del usuario se reanuda (re-inject `continúa`) o se relanza.
