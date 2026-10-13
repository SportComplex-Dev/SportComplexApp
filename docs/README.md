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
| [features/auth.md](./features/auth.md) | Google OAuth, vinculación de cuentas, plan de backend de auth, fix de login, reglas de borrado de empleados |
| [features/catalogo.md](./features/catalogo.md) | CRUD de categorías e instancias con unicidad y calendario propio |
| [features/reservas.md](./features/reservas.md) | Franjas horarias y aforo, ventana de 15 días, bloqueo temporal en checkout, multirreserva, historial con cursor |
| [features/piscinas.md](./features/piscinas.md) | Motor de mantenimiento de piscinas, modalidad aforo concurrente/exclusividad |
| [features/control-acceso.md](./features/control-acceso.md) | Denegación por discrepancia de zona, validación de franja de ingreso |
| [features/pagos-pos.md](./features/pagos-pos.md) | Idempotencia Stripe, webhooks de pago, canje en modo turno, cobro POS, comprobante PDF, interfaz POS cashless |
| [features/membresias.md](./features/membresias.md) | Persistencia de membresías y catálogo de planes |
| [features/torneos.md](./features/torneos.md) | Modelo de torneos, bloqueos, inscripciones, endpoints admin y bloqueo preventivo |
| [features/chatbot-analitica.md](./features/chatbot-analitica.md) | Endpoints para chatbot y agregaciones analíticas |

## Automatización (n8n / webhooks)

| Doc | Contenido |
|---|---|
| [automation/overview.md](./automation/overview.md) | Arquitectura de automatización |
| [automation/workflows.md](./automation/workflows.md) | Workflows n8n por funcionalidad: OTP, QR, contingencia (con reintentos), reporte gerencial, festivos, cobro fallido, gestión de errores |
| [automation/webhooks.md](./automation/webhooks.md) | Integración de webhooks Stripe/Resend y sistema de contingencia |
| [automation/implementation-guide.md](./automation/implementation-guide.md) | Guía práctica de integración n8n en el backend |
| [automation/index.md](./automation/index.md) | Índice original de automatización |
| [automation/setup-summary.md](./automation/setup-summary.md) | Resumen de setup de n8n |

## Infraestructura y despliegue

Ver [infra/README.md](./infra/README.md) — VPS compartido, Docker, Caddy, n8n, Storage y CI/CD.

## Convenciones para añadir documentación nueva

Ver [documentation-guidelines.md](./documentation-guidelines.md). Resumen: español, `kebab-case.md`, por tema (no por tarea), registrar el enlace en este índice, nada de docs por `TSK-XX`/`HU-XX`.
