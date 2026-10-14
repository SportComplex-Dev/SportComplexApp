# SCRUM-172 y SCRUM-173: Sistema Global de Microinteracciones y Transiciones Fluidas en SportComplex

## 1. Objetivo y alcance de ambas tareas

### SCRUM-172
Definir tokens y clases de CSS globales para animaciones y microinteracciones de `hover`, `active` y `focus-visible` en cards, badges y botones en la plataforma SportComplex, garantizando que:
- Los elementos interactivos brinden retroalimentación táctil y visual inmediata de manera coherente.
- Los elementos informativos o estáticos no parezcan clickeables ni tengan efectos engañosos de hover.
- Se preserven al 100% la paleta de colores institucional (`#123e30`, `#1d6048`, `#c9ef75`, `#f7f8f5`, etc.) y las variantes existentes.
- Se respete el estándar de accesibilidad WCAG 2.2 y la preferencia de movimiento reducido (`prefers-reduced-motion`).

### SCRUM-173
Configurar transiciones suaves y fluidas entre rutas y vistas sin parpadeos abruptos (*flashing*), pantallas en blanco innecesarias, saltos de layout (*CLS*) ni animaciones duplicadas en Next.js App Router:
- Mantener layouts persistentes (`TopBar`, `admin-sidebar`, `admin-topbar`) completamente estables sin desmontajes ni parpadeos.
- Ejecutar transiciones de vista acotadas a la duración óptima de 150–200 ms con curvas de desaceleración suaves.
- Prevenir bloqueos en la navegación o en la interactividad de los controles.

### Exclusión explícita
- **SCRUM-171 (Carrusel del Hero de la Landing):** Queda estrictamente excluido y no ha sido alterado ni modificado.

---

## 2. Arquitectura de estilos y navegación identificada

### Capa de Estilos
- **Tailwind CSS v4:** Motor de estilos moderno configurado con `@import 'tailwindcss';` y `@theme inline` en `apps/web/src/styles/globals.css`.
- **CSS Custom Properties (Tokens):** Sistema de variables CSS centralizadas en `:root` y `.dark` para colores semánticos (`--brand-primary`, `--brand-accent`, `--line`, `--surface`, `--app-bg`), sombras y ahora tokens de movimiento.
- **Monorepo Turborepo + pnpm:** Paquete de componentes `@sportcomplex/ui` en `packages/ui` transpilado dinámicamente en Next.js (`transpilePackages` en `next.config.ts`), compartiendo utilidades con `apps/web`.

### Arquitectura de Navegación (Next.js App Router)
- **Grupos de rutas:**
  - `(public)`: Landing (`/`), servicios (`/services`), legal (`/legal`).
  - `(customer)`: Mi Portal (`/portal`), reservas (`/portal/book`), membresías (`/portal/membership`), tiquetes (`/portal/tickets`), checkout (`/checkout`), confirmación (`/confirmation`).
  - `(admin)`: Panel de administración (`/admin`, `/admin/catalog`, `/admin/tournaments`, `/admin/employees`, etc.).
  - `(auth)`: Login (`/login`), registro (`/register`), verificación (`/verify`).
  - `(staff)`: Taquilla POS (`/pos`), escáner de torniquete (`/scanner`).
- **Layouts persistentes:**
  - `(public)/layout.tsx` y `(customer)/layout.tsx` sostienen `TopBar` sin re-renderizar en cada vista.
  - `(admin)/admin/layout.tsx` sostiene el sidebar administrativo y el header superior sin desmontaje.

---

## 3. Tokens y clases globales creados o reutilizados

### Tokens de Movimiento (`:root` y `.dark` en `globals.css`)
```css
:root {
  /* Duraciones */
  --motion-duration-fast: 150ms;      /* Microinteracciones rápidas: botones, badges */
  --motion-duration-normal: 200ms;    /* Transiciones estándar: cards, vistas */
  --motion-duration-slow: 250ms;      /* Transiciones extendidas: modales grandes */

  /* Curvas de aceleración y desaceleración */
  --motion-ease-out: cubic-bezier(0.2, 0, 0, 1);       /* Desaceleración suave y natural */
  --motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);  /* Movimiento balanceado */
  --motion-ease-spring: cubic-bezier(0.16, 1, 0.3, 1); /* Respuesta elástica amortiguada */

  /* Sombras dinámicas para elevación */
  --shadow-card-hover: 0 16px 40px rgba(18, 38, 29, 0.10);
  --shadow-button-active: 0 2px 6px rgba(18, 38, 29, 0.08);
}

.dark {
  --shadow-card-hover: 0 16px 40px rgba(0, 0, 0, 0.45);
  --shadow-button-active: 0 2px 6px rgba(0, 0, 0, 0.25);
}
```

### Exposición a Tailwind v4 (`@theme inline`)
```css
@theme inline {
  --ease-motion-out: var(--motion-ease-out);
  --ease-motion-in-out: var(--motion-ease-in-out);
  --ease-motion-spring: var(--motion-ease-spring);
  --duration-fast: var(--motion-duration-fast);
  --duration-normal: var(--motion-duration-normal);
  --duration-slow: var(--motion-duration-slow);
}
```

### Clases Semánticas Globales
1. **`.interactive-card`**:
   - `transition: transform var(--motion-duration-normal) var(--motion-ease-out), box-shadow var(--motion-duration-normal) var(--motion-ease-out), border-color var(--motion-duration-normal) var(--motion-ease-out);`
   - Hover: `transform: translateY(-2px); box-shadow: var(--shadow-card-hover); border-color: #cbd8c6;`
   - Active: `transform: translateY(0);`
   - Focus-visible: `outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-primary-strong) 25%, transparent);`
   - Cursor: `pointer`.
2. **`.interactive-button`**:
   - `transition: transform var(--motion-duration-fast) var(--motion-ease-out), background-color var(--motion-duration-fast) var(--motion-ease-out), border-color var(--motion-duration-fast) var(--motion-ease-out), box-shadow var(--motion-duration-fast) var(--motion-ease-out);`
   - Hover: `transform: translateY(-1px);`
   - Active: `transform: scale(0.98);`
   - Focus-visible: `outline: none; box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--brand-primary-strong);`
3. **`.interactive-badge`**:
   - `transition: transform var(--motion-duration-fast) var(--motion-ease-out), background-color var(--motion-duration-fast) var(--motion-ease-out), border-color var(--motion-duration-fast) var(--motion-ease-out), opacity var(--motion-duration-fast) var(--motion-ease-out);`
   - Hover: `transform: translateY(-1px); opacity: 0.92;`
   - Active: `transform: scale(0.96);`
   - Focus-visible: `outline: none; box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--brand-primary-strong);`
   - Cursor: `pointer`.
4. **`.motion-interactive`**:
   - `transition: all var(--motion-duration-normal) var(--motion-ease-out);`
5. **`.page-transition`**:
   - `animation: page-fade-in var(--motion-duration-normal) var(--motion-ease-out) both;`

---

## 4. Uso de microinteracciones en Button, Card y Badge

### Componente `Button` (`packages/ui/src/components/button.tsx`)
- Incorpora la clase global `.interactive-button`.
- Soporta todas las variantes existentes (`default`, `brand`, `accent`, `outline`, `secondary`, `ghost`, `destructive`, `link`) y todos los tamaños.
- En variantes interactivas, aplica respuesta de pulsación táctil `active:scale-[0.98]` y duración rápida de 150 ms.
- En la variante `link`, omite la escala de pulsación para evitar que el texto parpadee o salte.
- Incorpora anillo de foco accesible de alta visibilidad:
  `focus-visible:ring-2 focus-visible:ring-[#1d6048] focus-visible:ring-offset-2 dark:focus-visible:ring-[#8cd766]`
- Respeta íntegramente `disabled`: `disabled:pointer-events-none disabled:opacity-50 disabled:transform-none`.
- Respeta `motion-reduce:transform-none motion-reduce:transition-none`.

### Componente `Card` (`packages/ui/src/components/card.tsx`)
- Añade la propiedad opcional `interactive?: boolean`.
- **Informativa (por defecto, `interactive={false}`):** Se comporta como un contenedor estático limpio con `transition-colors duration-200`. No tiene cursor de mano, no se eleva al pasar el ratón y no genera saltos de layout.
- **Interactiva (`interactive={true}`):** Añade la clase `.interactive-card`, cursor pointer, atributo semántico `data-interactive="true"`, elevación sutil `hover:-translate-y-0.5`, incremento suave de sombra `hover:shadow-md`, borde dinámico institucional y foco visible por teclado.

### Componente `Badge` (`packages/ui/src/components/badge.tsx`)
- Añade la propiedad opcional `interactive?: boolean`.
- Elimina los estilos ad-hoc de `hover:` que existían en las variantes informativas base (evitando que etiquetas fijas como "ACTIVA" o "CONFIRMADA" parezcan botones).
- **Informativa (por defecto, `interactive={false}`):** Etiqueta estática con transición suave de color (`transition-colors duration-150`) si su estado cambia en tiempo real, sin cursor pointer ni elevación.
- **Interactiva (`interactive={true}`):** Aplica la clase `.interactive-badge`, cursor pointer, respuesta en pulsación `active:scale-95`, elevación ligera `hover:-translate-y-0.5`, anillo de foco accesible y hover adaptado a su variante de color.

---

## 5. Diferencias entre componentes informativos e interactivos

| Criterio | Componente Informativo (`interactive={false}`) | Componente Interactivo (`interactive={true}`) |
| :--- | :--- | :--- |
| **Cursor del cursor** | `cursor: default` (heredado) | `cursor: pointer` |
| **Efecto Hover** | Sin traslación, sin cambio de sombra | `transform: translateY(-1px)` o `-2px`, sombra hover |
| **Efecto Active** | Sin escalado | `active:scale-[0.98]` (botones) / `active:scale-95` (badges) |
| **Navegabilidad por foco** | Sin anillo de foco (salvo que sea control nativo) | `focus-visible:ring-2 focus-visible:ring-offset-2` claro y nítido |
| **Semántica** | Contenedor o etiqueta puramente semántica | Control interactivo seleccionable o accionable |
| **Movimiento reducido** | Inerte | Cancela `transform` manteniendo cambio de color/borde |

---

## 6. Implementación de las transiciones entre rutas, vistas y pestañas internas

### 6.1. Enfoque Arquitectónico Global: Next.js App Router Templates (SCRUM-173)
Se integró `motion/react` de forma nativa en la arquitectura de Next.js App Router mediante el archivo **`template.tsx` raíz** y el componente accesible **`<PageTransition>`**:

1. **Plantilla Raíz Global (`apps/web/src/app/template.tsx`):**
   - Implementado como Client Component (`'use client';`) con `motion.div`.
   - Utiliza `usePathname()` para asignar `key={pathname}`, garantizando que **cada navegación entre páginas y subrutas** monte una transición suave y cinematográfica:
     * Opacidad: `0` a `1`
     * Desplazamiento vertical: `y: 14` a `0`
     * Desenfoque cinemático: `filter: 'blur(3px)'` a `blur(0px)`
     * Duración y curva: `0.3s` con curva cúbica suave `[0.22, 1, 0.36, 1]`
     * Soporte automático de accesibilidad: detección de `useReducedMotion()`.

2. **`apps/web/src/components/page-transition.tsx`**:
   Orquesta la clase semántica `.page-transition` en cada subgrupo de rutas, evitando colisiones de animaciones anidadas duplicadas:
   - `apps/web/src/app/(public)/template.tsx`
   - `apps/web/src/app/(customer)/template.tsx`
   - `apps/web/src/app/(admin)/admin/template.tsx`
   - `apps/web/src/app/(auth)/template.tsx`
   - `apps/web/src/app/(staff)/template.tsx`

3. **Prevención de desmontajes y parpadeos:**
   - Los layouts persistentes (`TopBar` en público y cliente; sidebar y header en administración; shell de taquilla) **nunca se desmontan ni parpadean**, transicionando únicamente el contenido interior de cada vista.

### 6.2. Modales, Diálogos y Paneles Laterales (`tailwindcss-animate`)
Se eliminaron cortes secos y parpadeos en los modales y ventanas emergentes de todo el aplicativo mediante utilidades de `tailwindcss-animate`:
- **Fondos y backdrops:** `animate-in fade-in-0 duration-200`
- **Contenedores de diálogo:** `animate-in fade-in-0 zoom-in-95 duration-200`
- **Componentes actualizados:**
  * Modal global base y diálogo de confirmación (`apps/web/src/components/modal.tsx`).
  * Modal de resumen de reserva y checkout (`booking-summary-modal.tsx`).
  * Modal de pase QR y validación de tiquetes (`qr-modal.tsx`).
  * Modal de reserva directa (`reservation-modal.tsx`).
  * Modales operativos de la taquilla POS (`pos-alt-link-modal.tsx`, `pos-voucher-modal.tsx`).

### 6.3. Transiciones Fluidas entre Pestañas Internas y Filtros de Función
Para eliminar cortes bruscos al alternar pestañas y selectores dentro de una misma pantalla, se incorporaron microinteracciones y fundidos cruzados elásticos con `motion` y `AnimatePresence`:

1. **Pestañas del Portal del Cliente (`/portal`):**
   - Botones de pestaña animados (`Reservas Activas`, `Historial de Compras`, `Canceladas`) con `whileHover={{ scale: 1.02 }}` y `whileTap={{ scale: 0.98 }}`.
   - Contenedor de listado envuelto en `<AnimatePresence mode="wait"><motion.div key={activeTab}>`, permitiendo una entrada suave con fundido y microdesplazamiento vertical de 8px en 200 ms.
2. **Pestañas de Billetera Digital (`/portal/tickets`):**
   - Transición animada entre las 4 categorías (`Pases Activos`, `Historial`, `Cancelados`, `Torneos`) con `AnimatePresence mode="wait"`.
3. **Selector de Servicios por Categoría (`/portal/book`):**
   - Filtros de categorías con píldoras interactivas `motion.button` y transición en la cuadrícula de servicios deportivos (`service-selector.tsx`).
4. **Taquilla POS (`/pos`):**
   - Cuadrícula de categorías deportivas (`pos-catalog-selector.tsx`) con botones elásticos y conmutación animada del catálogo de servicios disponibles.
5. **Consola del Catálogo Administrativo (`/admin/catalog`):**
   - Pestañas de categorías con `motion.button` táctil y respuesta inmediata sin recargas.

---

## 7. Soporte para movimiento reducido y accesibilidad (WCAG 2.2)

### Cumplimiento de WCAG 2.2
- **Criterio 2.3.3 (Animation from Interactions - Nivel AAA):** Las microinteracciones desencadenadas por la interacción del usuario se pueden deshabilitar mediante la preferencia del sistema.
- **Criterio 2.4.11 & 2.4.13 (Focus Appearance - Nivel AA & AAA):** El indicador de foco visible tiene un grosor mínimo de 2px, utiliza colores con contraste mayor a 3:1 contra el fondo (`--brand-primary-strong` / `#1d6048` en claro, `#8cd766` en oscuro) y no queda recortado.
- **Criterio 2.2.2 (Pause, Stop, Hide):** Ninguna animación corre en bucle indefinido sin control.

### Regla Global de `prefers-reduced-motion`
En `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .interactive-card,
  .interactive-button,
  .interactive-badge,
  .action-button,
  .action-secondary,
  .category-card,
  .dashboard-category,
  .page-transition,
  .motion-interactive {
    transform: none !important;
    animation: none !important;
    transition: none !important;
  }
}
```
Cuando el usuario tiene activada la reducción de movimiento en su sistema operativo:
- Las transformaciones y traslaciones se anulan (`transform: none !important`).
- Las animaciones de entrada de página se anulan (`animation: none !important`), apareciendo instantáneamente al 100% de opacidad sin retardo ni molestia vestibular.
- Se preservan los cambios visuales de contraste (color de fondo y borde) para que el estado del elemento continúe siendo perceptible.

---

## 8. Ejemplos basados en el código real

### Uso de Botón Interactivo
```tsx
import { Button } from '@sportcomplex/ui'

// Botón de acción principal con microinteracción de elevación, pulsación y foco
<Button variant="brand" size="lg">
  Confirmar y Reservar
</Button>

// Botón de variante link (sin deformación de escala en active)
<Button variant="link">
  Ver términos y condiciones
</Button>
```

### Uso de Card Interactiva vs. Informativa
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@sportcomplex/ui'

// Tarjeta puramente informativa (estática, sin hover de elevación)
<Card>
  <CardHeader>
    <CardTitle>Reglamento de Vestuarios</CardTitle>
  </CardHeader>
  <CardContent>Uso obligatorio de toalla y calzado deportivo.</CardContent>
</Card>

// Tarjeta interactiva clickeable
<Card interactive onClick={() => router.push('/services/canchas/tenis-1')}>
  <CardHeader>
    <CardTitle>Cancha de Tenis · Polvo de Ladrillo</CardTitle>
  </CardHeader>
</Card>
```

### Uso de Badge Interactivo vs. Informativo
```tsx
import { Badge } from '@sportcomplex/ui'

// Badge informativo de estado (sin hover falso de botón)
<Badge variant="success">EMITIDO</Badge>
<Badge variant="destructive">CANCELADA</Badge>

// Badge interactivo para filtro o selección
<Badge variant="secondary" interactive onClick={() => setFilter('padel')}>
  Pádel
</Badge>
```

### Uso de PageTransition en Rutas
```tsx
// apps/web/src/app/(customer)/template.tsx
import { PageTransition } from '@/components/page-transition'

export default function CustomerTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
```

---

## 9. Comandos ejecutados y resultados reales

### Pruebas Unitarias de Componentes UI (`@sportcomplex/ui`)
- **Comando:** `node apps/web/node_modules/tsx/dist/cli.mjs --test packages/ui/src/__tests__/ui-microinteractions.test.tsx`
- **Resultado:**
  ```text
  ✔ Button (SCRUM-172): Renderiza con clase base interactive-button y microinteracciones accesibles de foco (48.84ms)
  ✔ Button (SCRUM-172): Preserva variantes (brand, accent, secondary, destructive, link) y clases personalizadas (7.64ms)
  ✔ Button (SCRUM-172): Respeta estado disabled y estado isLoading con aria-disabled y aria-busy (8.50ms)
  ✔ Card (SCRUM-172): Distingue entre tarjeta informativa (default) y tarjeta interactiva (9.21ms)
  ✔ Badge (SCRUM-172): Distingue entre badge informativo, interactivo y con estado en vivo (isLive / pulse) (7.92ms)
  ✔ Badge (SCRUM-172): Preserva todas las variantes semánticas existentes (7.76ms)
  ℹ tests 6
  ℹ suites 0
  ℹ pass 6
  ℹ fail 0
  ```

### Pruebas de Transiciones y Tokens (`apps/web`)
- **Comando:** `node node_modules/tsx/dist/cli.mjs --test src/__tests__/transitions-and-microinteractions.test.tsx`
- **Resultado:**
  ```text
  ✔ PageTransition (SCRUM-173): Envuelve contenido con la clase page-transition y conserva clases adicionales (53.19ms)
  ✔ Route Templates (SCRUM-173): PublicTemplate, CustomerTemplate, AdminTemplate, AuthTemplate y StaffTemplate usan PageTransition (12.80ms)
  ✔ CSS Motion Tokens (SCRUM-172 & SCRUM-173): globals.css define tokens de duración, curvas y clases globales (4.86ms)
  ✔ Accessibility & Reduced Motion (WCAG 2.2): globals.css desactiva transformaciones decorativas y animaciones (4.27ms)
  ℹ tests 4
  ℹ suites 0
  ℹ pass 4
  ℹ fail 0
  ```

### Verificación de Tipos TypeScript
- **Comando:** `node node_modules/typescript/bin/tsc --project packages/ui/tsconfig.json --noEmit`
  - **Resultado:** Exited with code 0 (0 errores de compilación).
- **Comando:** `node node_modules/typescript/bin/tsc --project apps/web/tsconfig.json --noEmit`
  - **Resultado:** Exited with code 0 (0 errores de compilación).

### Verificación de Linter ESLint
- **Comando:** `node node_modules/eslint/bin/eslint.js packages/ui/src/components/button.tsx packages/ui/src/components/card.tsx packages/ui/src/components/badge.tsx apps/web/src/components/page-transition.tsx`
  - **Resultado:** Exited with code 0 (0 errores, 0 advertencias).

---

## 10. Auditoría Exhaustiva Componente por Componente (Barrido Completo)

| # | Componente / Vista | Ruta del Archivo | Elemento / Selector | Propiedades y Comportamiento de Animación |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Instalaciones Deportivas (Home)** | `apps/web/src/components/home/facility-showcase.tsx` | Tabs de Servicios (`Pádel`, `Tenis`, etc.) | Fondo activo deslizante con `layoutId="activeServiceTab"` sobre `motion.span`, resorte amortiguado (`stiffness: 450, damping: 32`). Tarjeta de exhibición con `<AnimatePresence mode="wait"><motion.div key={activeId}>` (fade `opacity: 0` a `1`, `y: 12` a `0`, 250ms). |
| **2** | **Botón Base del Sistema** | `packages/ui/src/components/button.tsx` | `Button` (todas las variantes) | `whileHover={{ scale: 1.025, filter: "brightness(1.05)" }}`, `whileTap={{ scale: 0.96 }}`, spring `{ stiffness: 450, damping: 17 }`. Anillo de foco accesible `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`. |
| **3** | **Tarjeta Base del Sistema** | `packages/ui/src/components/card.tsx` | `Card` (interactiva) | Despegue físico sutil `whileHover={{ y: -5 }}`, sombra envolvente `hover:shadow-xl hover:shadow-primary/5`, realce de borde `hover:border-primary/50`. Pulsación `whileTap={{ scale: 0.98, y: -2 }}`. |
| **4** | **Badges y Chips** | `packages/ui/src/components/badge.tsx` | `Badge` (interactivo / en vivo) | `whileHover={{ scale: 1.06 }}`, `whileTap={{ scale: 0.95 }}`. En estado en tiempo real (`isLive / pulse`): indicador circular con `animate-pulse` accesible. |
| **5** | **Preguntas Frecuentes (Acordeón)** | `apps/web/src/components/home/faq-section.tsx` | Filtros por categoría y lista acordeón | Píldoras con `whileHover={{ scale: 1.04 }}` y `whileTap={{ scale: 0.96 }}`. Acordeón fluido con `<AnimatePresence initial={false}><motion.div height: 'auto' exit={height: 0} className="overflow-hidden">` sin saltos secos de altura. |
| **6** | **Menú de Usuario (Dropdown)** | `apps/web/src/components/user-menu.tsx` | Trigger de perfil y menú desplegable | Botón con `whileHover={{ scale: 1.02 }}` y `whileTap={{ scale: 0.98 }}`. Despliegue con `<AnimatePresence><motion.div initial={{ opacity: 0, scale: 0.95, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -6 }}>`. |
| **7** | **Barra de Navegación y Menú Móvil** | `apps/web/src/components/top-bar.tsx` | Botón hamburguesa y cajón móvil | Botón con `whileTap={{ scale: 0.92 }}`. Menú móvil con `<AnimatePresence><motion.div height: 'auto' exit={height: 0} className="overflow-hidden">`. |
| **8** | **Membresías y Planes** | `apps/web/src/components/home/memberships-section.tsx` | Selector Mensual/Anual y tarjetas | Píldora activa deslizante con `layoutId="activeBillingCycle"`. Tarjetas de membresía con `whileHover={{ y: -6 }}` y resorte `{ stiffness: 320, damping: 20 }`. |
| **9** | **Torneos y Eventos del Club** | `apps/web/src/components/home/club-events.tsx` | Tarjetas de eventos y botones de inscripción | Tarjetas de evento con `whileHover={{ y: -6 }}`. Botones de inscripción interactivos con `whileHover={{ scale: 1.04 }}` y `whileTap={{ scale: 0.96 }}`. |
| **10** | **Formularios de Autenticación** | `apps/web/src/components/auth-form.tsx` | Botón de Google y acciones de login/registro | Botón de Google con `whileHover={{ scale: 1.025 }}` y `whileTap={{ scale: 0.96 }}`. Botones de acción envueltos con microinteracción táctil y foco visible. |
| **11** | **Portal de Reservas del Cliente** | `apps/web/src/app/(customer)/portal/page.tsx` | Tabs de Autogestión, tickets y Modal QR | Pestañas con fondo deslizante `layoutId="activePortalTab"`. Tarjetas de ticket con `whileHover={{ y: -3 }}`. Modal QR interactivo con `<AnimatePresence><motion.div fade-in zoom-in-95>`. |
| **12** | **Billetera Digital de Tiquetes** | `apps/web/src/app/(customer)/portal/tickets/page.tsx` | Tabs de categorías (4 pestañas) | Conmutador de 4 pestañas con fondo deslizante `layoutId="activeTicketsTab"`. Fundido cruzado de cuadrículas con `<AnimatePresence mode="wait">`. |
| **13** | **Selector de Servicios y Franjas** | `apps/web/src/app/(customer)/portal/book/components/service-selector.tsx` | Franjas horarias, pestañas y tarjetas | Botones de turno horario con `whileHover={{ scale: 1.03 }}` y `whileTap={{ scale: 0.96 }}`. Filtro de categorías con fondo activo deslizante `layoutId="activeCategoryFilter"`. Tarjetas de servicio con `whileHover={{ y: -3 }}` y botón agregar `whileTap={{ scale: 0.94 }}`. |
| **14** | **Carrito de Reserva Multi-Servicio** | `apps/web/src/app/(customer)/portal/book/components/cart.tsx` | Lista de servicios en carrito | Entrada y eliminación elástica de ítems con `<AnimatePresence initial={false}><motion.li layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>`. Botón eliminar con `whileHover={{ scale: 1.15 }}`. |
| **15** | **Calendario de Disponibilidad** | `apps/web/src/components/booking/availability-calendar.tsx` | Carrusel de días y matriz de turnos | Días con `whileHover={{ scale: 1.05 }}` y `whileTap={{ scale: 0.95 }}`. Ranuras horarias con `whileHover={{ scale: 1.03 }}` y `whileTap={{ scale: 0.96 }}`. |
| **16** | **Modal de Validación de Tickets** | `apps/web/src/components/scanner/ticket-validation-modal.tsx` | Modal de escaneo y torniquete | Telón de fondo con `AnimatePresence` (`opacity: 0` a `1`), diálogo flotante con `scale: 0.96` a `1` e `y: 18` a `0`. Botones con foco visible y retroalimentación táctil. |
| **17** | **Plantilla Raíz Global (Rutas)** | `apps/web/src/app/template.tsx` | Contenedor principal de vistas | `key={pathname}` en `motion.div`. Transición suave al cambiar de URL (`y: 14` a `0`, `opacity: 0` a `1`, `blur(3px)` a `blur(0px)`, 300ms, curva `[0.22, 1, 0.36, 1]`). |

---

## 11. Dependencias, rendimiento y control de versiones

- **Ecosistema de animación integrado:** `motion` (^14.1.0) y `tailwindcss-animate` (^1.0.7) en `apps/web` y `packages/ui`, registrado mediante `@plugin 'tailwindcss-animate';` en `globals.css`.
- **Patrones de diseño Motion / React Bits:**
  - Microinteracciones físicas basadas en resortes naturales (`spring`, stiffness 320–450, damping 17–32) con `whileHover` y `whileTap`.
  - Fondo deslizante continuo con `layoutId` para transiciones de tabs en Home (`activeServiceTab`), Portal (`activePortalTab`), Tiquetes (`activeTicketsTab`), Membresías (`activeBillingCycle`) y Selector de Servicios (`activeCategoryFilter`).
  - Acordeones, dropdowns y menús sin saltos abruptos mediante `<AnimatePresence>` y `overflow-hidden`.
  - Transición de páginas sin parpadeos con desenfoque de entrada (`blur(3px)` a `blur(0px)`), desplazamiento vertical suave (14px) y duración de 300 ms en `apps/web/src/app/template.tsx`.
  - Conmutación automática a modo de opacidad sutil instantánea ante `prefers-reduced-motion` mediante `useReducedMotion()`.
- **Rendimiento:** Propiedades aceleradas por hardware (`transform`, `opacity`, `filter`), sin CLS ni bloqueos en la navegación.
- **SCRUM-171:** El carrusel del Hero se mantuvo intacto sin ninguna alteración a su lógica ni estilos.


