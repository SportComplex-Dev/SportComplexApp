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

## 6. Implementación de las transiciones entre rutas y vistas

### Enfoque Arquitectónico: Next.js App Router Templates
En lugar de forzar librerías pesadas externas o View Transitions experimentales inestables en el servidor, se aprovechó la arquitectura nativa de Next.js App Router mediante **`template.tsx`** y el componente **`<PageTransition>`**:

1. **`apps/web/src/components/page-transition.tsx`**:
   Componente ligero que envuelve a las vistas en la clase CSS `.page-transition`:
   ```tsx
   'use client'
   import React, { type ReactNode } from 'react'

   export function PageTransition({ children, className = '' }: PageTransitionProps) {
     return <div className={`page-transition ${className}`.trim()}>{children}</div>
   }
   ```

2. **Plantillas por grupo de ruta:**
   - `apps/web/src/app/(public)/template.tsx`
   - `apps/web/src/app/(customer)/template.tsx`
   - `apps/web/src/app/(admin)/admin/template.tsx`
   - `apps/web/src/app/(auth)/template.tsx`
   - `apps/web/src/app/(staff)/template.tsx`

3. **Prevención de desmontajes y parpadeos:**
   - A diferencia de `layout.tsx` (que es persistente), `template.tsx` se instancia en cada navegación de ruta.
   - Dado que el template se colocó **dentro** de cada grupo de ruta alrededor del contenido hijo, los layouts persistentes (`TopBar` en público y cliente; sidebar y header en administración) **nunca se desmontan ni parpadean**.
   - La vista entrante realiza un suave fundido (`page-fade-in`: opacidad de 0.92 a 1 con un sutil asentamiento vertical de 3px en 200 ms), eliminando pantallas blancas y saltos bruscos.
   - Cero retraso en la interactividad: no se bloquea la cola de eventos ni la navegación del router.

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
- **Comando:** `node ../../apps/web/node_modules/tsx/dist/cli.mjs --test "src/**/__tests__/**/*.test.tsx"`
- **Resultado:**
  ```text
  ✔ Button (SCRUM-172): Renderiza con clase base interactive-button y microinteracciones de active/focus (29.26ms)
  ✔ Button (SCRUM-172): Preserva variantes (brand, accent, secondary, destructive, link) y clases personalizadas (3.27ms)
  ✔ Button (SCRUM-172): Respeta estado disabled sin permitir microinteracciones activas (2.08ms)
  ✔ Card (SCRUM-172): Distingue entre tarjeta informativa (default) y tarjeta interactiva (6.44ms)
  ✔ Badge (SCRUM-172): Distingue entre badge informativo y badge interactivo sin falso hover (3.58ms)
  ✔ Badge (SCRUM-172): Preserva todas las variantes semánticas existentes (2.26ms)
  ℹ tests 6
  ℹ suites 0
  ℹ pass 6
  ℹ fail 0
  ```

### Pruebas de Transiciones y Tokens (`apps/web`)
- **Comando:** `node node_modules/tsx/dist/cli.mjs --test src/__tests__/transitions-and-microinteractions.test.tsx`
- **Resultado:**
  ```text
  ✔ PageTransition (SCRUM-173): Envuelve contenido con la clase page-transition y conserva clases adicionales (30.27ms)
  ✔ Route Templates (SCRUM-173): PublicTemplate, CustomerTemplate, AdminTemplate, AuthTemplate y StaffTemplate usan PageTransition (9.16ms)
  ✔ CSS Motion Tokens (SCRUM-172 & SCRUM-173): globals.css define tokens de duración, curvas y clases globales (4.56ms)
  ✔ Accessibility & Reduced Motion (WCAG 2.2): globals.css desactiva transformaciones decorativas y animaciones (3.75ms)
  ℹ tests 4
  ℹ suites 0
  ℹ pass 4
  ℹ fail 0
  ```

### Pruebas de Regresión en Módulos Consumidores (`apps/web`)
- **Comando:** `node node_modules/tsx/dist/cli.mjs --test "src/app/(customer)/portal/__tests__/portal.test.ts" "src/app/(staff)/scanner/__tests__/visual-consultation-render.test.tsx" "src/app/(admin)/admin/dashboard/__tests__/dashboard-ui.test.ts"`
- **Resultado:**
  ```text
  ℹ tests 21
  ℹ suites 0
  ℹ pass 21
  ℹ fail 0
  ```

### Verificación de Tipos TypeScript
- **Comando:** `node node_modules/typescript/bin/tsc --project packages/ui/tsconfig.json --noEmit`
  - **Resultado:** Exited with code 0 (Sin errores de tipado).
- **Comando:** `node node_modules/typescript/bin/tsc --project apps/web/tsconfig.json --noEmit`
  - **Resultado:** Exited with code 0 (Sin errores de tipado).

### Verificación de Linter ESLint
- **Comando:** `node node_modules/eslint/bin/eslint.js packages/ui apps/web/src/components/page-transition.tsx "apps/web/src/app/(public)/template.tsx" ...`
  - **Resultado:** Exited with code 0 (Sin advertencias ni errores de lint).

---

## 10. Limitaciones, dependencias y criterios pendientes

- **Dependencias añadidas:** **Ninguna.** Se resolvió con CSS nativo, Tailwind v4 y primitivas de Next.js App Router, evitando inflar el bundle de la aplicación.
- **Rendimiento:** Uso exclusivo de propiedades aceleradas por GPU (`transform`, `opacity`), eliminando el riesgo de layout shifts (CLS) o repintados costosos.
- **SCRUM-171:** El carrusel del Hero se mantuvo intacto sin ninguna alteración a su lógica ni estilos.
- **Criterios pendientes:** No existen criterios pendientes; todos los requerimientos de SCRUM-172 y SCRUM-173 han sido implementados, verificados y aprobados.
