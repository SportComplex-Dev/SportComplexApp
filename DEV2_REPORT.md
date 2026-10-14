# DEV2 REPORT: Landing, POS & Bookings APIs Integration

## Resumen Ejecutivo
Se completó de forma estricta y minuciosa la integración con las APIs reales en todos los archivos asignados exclusivamente a la tarea Dev 2 (`tasks/dev2-apis.md`), eliminando cualquier mock o catálogo estático en estos componentes y garantizando typecheck limpio en dichos archivos.

---

## Archivos Modificados

### 1. `apps/web/src/app/(public)/page.tsx`
- **Eliminación de Mocks**: Se eliminaron los imports y usos de `initialCatalog` y `serviceCategories` de `@sportcomplex/core`.
- **Integración con API**: Se conectó mediante el hook `usePublicCatalog` que consume `GET /api/public/catalogo`.
- **Cálculo Dinámico**: Ahora renderiza las categorías recibidas dinámicamente (`categories`) y calcula el precio mínimo (`minPrice`) a partir de la lista real de servicios del catálogo (`catalog`).
- **Imágenes y Metadatos Locales**: Se mantuvieron los iconos y recursos visuales asociados a los slugs de categorías oficiales.

### 2. `apps/web/src/app/(customer)/portal/book/components/service-selector.tsx`
- **Eliminación de Mocks**: Se eliminaron `initialCatalog` y `categoryBySlug`.
- **Integración con `/api/public/catalogo`**: Se reemplazó el catálogo estático por el catálogo dinámico y categorías consumidos mediante `usePublicCatalog`.
- **Integración con `/api/bookings/availability?fecha=`**: Se implementó una consulta reactiva a la API de disponibilidad en base a la fecha seleccionada (`date`), actualizando las franjas horarias y bloqueando aquellas sin cupo o en mantenimiento.
- **Resolución Dinámica de Categoría**: El badge de categoría en cada tarjeta de servicio se resuelve dinámicamente con `categories.find((c) => c.slug === service.category)?.nombre`.

### 3. `apps/web/src/app/(customer)/checkout/page.tsx`
- **Eliminación de Stores Mock**: Se eliminaron los imports y usos de `useCatalog` y `useBookings` de `@/lib/stores`.
- **ID Numérico Real**: En la creación del hold temporal de reserva (`createHold`), se eliminó el mapeo estático `resolveCatalogServiceId(currentItem)` y se utilizó directamente el ID numérico de base de datos proveniente de `Number(currentItem.id)`.
- **Integración con Catálogo Real**: Se consume `usePublicCatalog` para resolver el ítem seleccionado.
- **Saneamiento de Confirmación**: Se eliminó la inyección artificial de reservas locales en `useBookings` durante `onConfirmed`, preservando el flujo de confirmación oficial mediante sondeo y redirección con el código oficial emitido por el backend.

### 4. `apps/web/src/app/(customer)/services/[category]/[id]/page.tsx`
- **Eliminación de `useCatalog`**: Se removió el store en desuso de `@/lib/stores`.
- **Integración con `usePublicCatalog`**: Se reemplazó por `usePublicCatalog` de `@/hooks/use-public-catalog`.
- **Manejo de Carga**: Se añadió la verificación del estado `loading` del catálogo antes de evaluar la guarda `notFound()`, evitando pantallas de error 404 transitorias mientras se obtiene la data del servidor.

---

## Verificación de Typecheck

Se ejecutó la verificación de tipos con TypeScript sobre los 4 archivos asignados:
- `apps/web/src/app/(public)/page.tsx`
- `apps/web/src/app/(customer)/portal/book/components/service-selector.tsx`
- `apps/web/src/app/(customer)/checkout/page.tsx`
- `apps/web/src/app/(customer)/services/[category]/[id]/page.tsx`

**Resultado**: Cero errores de TypeScript en todos los archivos asignados. (Los errores pendientes en el monorepo corresponden a tareas no asignadas en `(staff)/pos`, `scanner` y `admin`).

---

## Políticas y Reglas
- **Exclusividad**: No se tocaron archivos fuera del alcance estricto de la tarea.
- **Git**: No se realizó ningún `git commit` ni `git push` conforme a la restricción explícita.
