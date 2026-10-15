# backend-contract — checklist rápida

- [ ] `route.ts`: `auth → Zod safeParse → repo → ok/created/fail`.
- [ ] RBAC doble capa: `proxy.ts` + `authorizeApiRequest`; códigos `400/401/403/404/409/502/503` documentados.
- [ ] Lógica negocio en `application/core` con `now?` inyectable; SQL solo en `db/repositories` (`FOR UPDATE`, TTL 30m, `AT TIME ZONE 'America/Bogota'`, `@map`).
- [ ] Idempotencia `UNIQUE(stripe_pi)/(torneo,usuario)`; migraciones aditivas; seed `slug<->id` determinista.
- [ ] n8n fire-and-forget (no bloquea respuesta); Stripe fuera de TX.
- [ ] `pnpm --filter @sportcomplex/db --filter @sportcomplex/core --filter @sportcomplex/validation typecheck` + `db:generate` previo verde.
