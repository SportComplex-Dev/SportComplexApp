# Documentación — SportComplex

Mapa de toda la documentación del monorepo, organizada por tema (no por tarea).

## Empieza aquí

| Doc | Para quién |
|---|---|
| [onboarding.md](./onboarding.md) | Dev nuevo: qué es el proyecto, cómo levantarlo, flujo de trabajo, anti-patrones |
| [documentation-guidelines.md](./documentation-guidelines.md) | Todos: cómo se documenta en este repo (por tema, no por tarea) |

## Arquitectura y diseño

| Doc | Contenido |
|---|---|
| [architecture/architecture.md](./architecture/architecture.md) | Estructura del monorepo, versiones fijadas, convenciones de código y flujo de ramas (prevalece sobre el resto) |
| [architecture/design-system.md](./architecture/design-system.md) | Tokens de diseño, UI, tipografía y especificación visual (DESIGN + system design fusionados) |
| [architecture/data-model.md](./architecture/data-model.md) | MER y DER de la base de datos |
| [architecture/performance-indexes.md](./architecture/performance-indexes.md) | Tuning de consultas con `EXPLAIN ANALYZE`, índices GiST |
| [architecture/packages-features.md](./architecture/packages-features.md) | Mapa de paquetes `features/*` + `shared`, DAG y reglas de migración |
| [architecture/api-contracts.md](./architecture/api-contracts.md) | Contratos REST + OpenAPI generado (`docs/api/openapi.json`) |
| [architecture/adrs/](./architecture/adrs/) | Decisiones de arquitectura (7 ADRs) |

## Producto (qué construimos)

| Doc | Contenido |
|---|---|
| [product/srs.md](./product/srs.md) | SRS: RF-00–RF-21, RNF-01–RNF-06, RN-01–RN-14 |
| [product/analytics-model.md](./product/analytics-model.md) | Modelo analítico y KPIs (RF-21) |
| [product/seed-dataset.md](./product/seed-dataset.md) | Dataset semilla y control de calidad |
| [product/occupancy-analysis.md](./product/occupancy-analysis.md) | Análisis de ocupación, demanda y recomendaciones tarifarias |

## Features (cómo está implementado)

| Doc | Dominio |
|---|---|
| [features/auth.md](./features/auth.md) | Google OAuth, vinculación de cuentas, plan de backend de auth, fix de login, empleados/roles y reglas de borrado |
| [features/recuperacion-contrasena.md](./features/recuperacion-contrasena.md) | Flujo de recuperación y restablecimiento de contraseña (`/forgot-password`, `/reset-password`), Zod y Suspense |
| [features/catalogo.md](./features/catalogo.md) | CRUD de categorías e instancias con unicidad y calendario propio |
| [features/reservas.md](./features/reservas.md) | Franjas horarias y aforo, ventana de 15 días, bloqueo temporal en checkout, multirreserva y multi-servicio en la misma franja, historial con cursor |
| [features/piscinas.md](./features/piscinas.md) | Motor de mantenimiento de piscinas, modalidad aforo concurrente/exclusividad |
| [features/control-acceso.md](./features/control-acceso.md) | Escáner QR (puesto de turno, modo consulta, resiliencia offline), denegación por discrepancia de zona, alertas de zona y franja vencida, validación de franja de ingreso |
| [features/pagos-pos.md](./features/pagos-pos.md) | Idempotencia Stripe, webhooks de pago, canje en modo turno, cobro POS, comprobante PDF, interfaz POS cashless |
| [features/membresias.md](./features/membresias.md) | Persistencia de membresías y catálogo de planes |
| [features/torneos.md](./features/torneos.md) | Modelo de torneos, bloqueos, inscripciones, endpoints admin y bloqueo preventivo |
| [features/chatbot-analitica.md](./features/chatbot-analitica.md) | Endpoints para chatbot y agregaciones analíticas |
| [features/reglamentos.md](./features/reglamentos.md) | Reglamentos y marco normativo (`/rules`) |

## Packages (código)

| Paquete | Doc |
|---|---|
| `packages/application` | [packages/application/README.md](../packages/application/README.md) |
| `packages/config` | [packages/config/README.md](../packages/config/README.md) |
| `packages/core` | [packages/core/README.md](../packages/core/README.md) |
| `packages/domain` | [packages/domain/README.md](../packages/domain/README.md) |
| `packages/security` | [packages/security/README.md](../packages/security/README.md) |
| `packages/seed` | [packages/seed/README.md](../packages/seed/README.md) |
| `packages/shared` | [packages/shared/README.md](../packages/shared/README.md) |
| `packages/ui` | [packages/ui/README.md](../packages/ui/README.md) |
| `packages/validation` | [packages/validation/README.md](../packages/validation/README.md) |
| `packages/automation` | [packages/automation/README.md](../packages/automation/README.md) |
| `packages/features` | [packages/features/README.md](../packages/features/README.md) |
| `packages/db` | [packages/db/README.md](../packages/db/README.md) |

## Automatización (n8n / webhooks)

| Doc | Contenido |
|---|---|
| [automation/overview.md](./automation/overview.md) | Arquitectura de automatización |
| [automation/workflows.md](./automation/workflows.md) | Workflows n8n por funcionalidad: OTP, QR, contingencia (con reintentos), reporte gerencial, festivos, cobro fallido, gestión de errores |
| [automation/webhooks.md](./automation/webhooks.md) | Integración de webhooks Stripe/Resend y sistema de contingencia |
| [automation/implementation-guide.md](./automation/implementation-guide.md) | Guía práctica de integración n8n en el backend |
| [automation/plantilla-correo-ticket.md](./automation/plantilla-correo-ticket.md) | Plantilla de correo y pase QR transaccional (TSK-FE-37) |

## Infraestructura y despliegue

Ver [infra/README.md](./infra/README.md) — VPS dedicado, Docker, Caddy, n8n, Storage y CI/CD.

## Convenciones para añadir documentación nueva

Ver [documentation-guidelines.md](./documentation-guidelines.md). Resumen: español, `kebab-case.md`, por tema (no por tarea), registrar el enlace en este índice, nada de docs por `TSK-XX`/`HU-XX`.
