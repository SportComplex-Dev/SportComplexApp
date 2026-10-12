# AKROS Club · System Design & UI Architecture Specification

> **Documento Oficial de Diseño de Sistema y Arquitectura de Interfaz**  
> **Proyecto:** Plataforma de Gestión de Reservas, Venta y Control de Acceso Deportivo (`SportComplex`)  
> **Marca Institucional:** AKROS Active Lifestyle Club  
> **Normativa de Referencia:** Vinculado a [DESIGN.md](./DESIGN.md), [ARCHITECTURE.md](./ARCHITECTURE.md) y [SRS.md](./SRS.md).  
> **Zona Horaria Canónica:** Colombia (`America/Bogota`, UTC-5).

---

## 1. Visión y Principios del Sistema de Diseño

El sistema de diseño de **AKROS** proyecta una estética premium, dinámica y atlética orientada a la excelencia deportiva, la hospitalidad y la tecnología sin fricción:

1. **Jerarquía Visual y Sofisticación:** Fondo lienzo pulido (`#f7f8f5` en modo claro, `#0b120f` en modo oscuro) con acentos de color verde bosque (`#123e30`) y energía lima de alta visibilidad (`#c9ef75`).
2. **Arquitectura Zero-Friction:** Despacho estático ultra-rápido en borde (**SSG `force-static`** en `/`) garantizando **LCP < 1.5s**, con conmutación instantánea de tema sin saltos de layout ni flashes de hidratación.
3. **Consistencia de Tokens de Dos Niveles:**
   * **Tokens Base/Primitivos:** Paleta de color HSL/HEX y escala tipográfica fluida en `globals.css`.
   * **Tokens Semánticos:** Variables contextuales (`--surface-card`, `--app-bg`, `--border`, `--ink`, `--subtle`) que conmutan automáticamente entre modos `light` y `dark`.
4. **Accesibilidad Universal (WCAG 2.1 AA):** Ratios de contraste superiores a 4.5:1 en textos corporales y 3:1 en elementos interactivos, soporte para navegación por teclado, focus rings visibles y respeto a preferencias de movimiento reducido (`prefers-reduced-motion`).

---

## 2. Pila Tecnológica y Monorepo

* **Framework:** Next.js 16.3.7 (App Router, Standalone Mode).
* **Motor de Estilos:** Tailwind CSS v4.3.3 con directiva `@theme inline` y CSS Custom Properties.
* **Componentes Atómicos:** Paquete `@sportcomplex/ui` gobernado por Shadcn UI y componentes accesibles (Button, Card, Badge, Input).
* **Tipografía:** *Plus Jakarta Sans* (400, 500, 600, 700, 800) cargada vía `next/font/google` con swap de fuente cero-layout-shift.
* **Iconografía:** Lucide React (`lucide-react`) estandarizada a 16px/20px en botones e indicadores.

---

## 3. Matriz de Tokens de Color y Superficies

| Token Semántico | Modo Claro (Light) | Modo Oscuro (Dark) | Uso / Propósito |
|---|---|---|---|
| `--app-bg` | `#f7f8f5` | `#0b120f` | Fondo principal de la aplicación y landing page |
| `--surface` | `#ffffff` | `#141d18` | Superficie de navegación, topbar y modales |
| `--surface-card` | `#ffffff` | `#15201b` | Contenedores de instalaciones, eventos y pases |
| `--surface-soft` | `#f1f3ee` | `#1c2721` | Fondos secundarios y chips informativos |
| `--border` / `--line` | `#e2e6df` | `#26352d` | Separadores y contornos de tarjetas |
| `--ink` | `#121a16` | `#f2f5f1` | Texto principal, títulos e hipervínculos activos |
| `--subtle` / `--ink-muted` | `#526058` | `#9eaba3` | Párrafos, descripciones y metadatos |
| `--brand-accent` (`--lime`) | `#c9ef75` | `#b9e66b` | Botones de acción primaria, badges y acentos activos |
| `--brand-primary` | `#123e30` | `#d9f29f` | Identidad verde bosque institucional |
| `--shadow-card` | `rgba(18,38,29,0.06)` | `rgba(0,0,0,0.45)` | Elevación tridimensional y profundidad |

---

## 4. Estrategia de Conmutación de Modo (Dark / Light)

El motor de temas se gobierna mediante la clase `.dark` inyectada en la raíz `<html>` (`document.documentElement`), sincronizada bidireccionalmente con `localStorage('akros_theme')` y la directiva `colorScheme` de Next.js:

* **Selector Universal de Cascada:**
  ```css
  :root.dark,
  .dark,
  .dark .club-app,
  .club-app.dark {
    color-scheme: dark;
    /* Reasignación completa de variables semánticas */
  }
  ```
* **Cero Destellos (Zero Flash):** Detección temprana en el cliente y sincronización perimetral.
* **Componentes Responsivos al Tema:** El componente `Brand` alterna automáticamente entre `Akros-logo-bosque.png` en modo claro y `Akros-logo.png` (alta luminancia) en modo oscuro.

---

## 5. Arquitectura de Componentes de la Landing Page

1. **TopBar Institucional (`apps/web/src/components/top-bar.tsx`):**
   * Logo AKROS escalado con alta visibilidad y soporte dark/light.
   * Navegación canónica desktop y drawer móvil accesible.
   * Toggle de tema de un solo clic (`theme-toggle`).
   * CTA unificado de alta conversión: **"Accede al club"** (`action-button nav-access`).
2. **Hero Cinematográfico:** Presentación institucional con fotografía inmersiva de instalaciones, indicador en vivo de sede, clima y rating social.
3. **Showcase de Instalaciones (`FacilityShowcase`):** Selector de pestañas para pádel, canchas sintéticas, piscina climatizada, gimnasio y zona húmeda con detalles técnicos y precios base.
4. **Catálogo de Servicios ("Encuentra tu espacio"):** Tarjetas visuales interactivas con fotografía representativa de alta definición, `IconBox` temático superpuesto y tarificación inicial.
5. **Membresías y Acceso Recurrente (`MembershipsSection`):** Exposición de planes con el 30% de descuento estatutario (TSK-BD-11 / RF-16).
6. **Agenda de Eventos y Tercer Tiempo (`ClubEvents`, `LifestyleAndDigitalPass`):** Integración social, coworking y maqueta del **Pase Digital QR** con botón directo a la billetera de tiquetes.
7. **Preguntas Frecuentes y Políticas (`FaqSection`):** Acordeón accesible por categorías para resolver dudas operativas previas a la reserva.
8. **Footer Corporativo (`InstitutionalFooter`):** Horarios, ubicación física en Medellín, canales de soporte y enlaces contractuales.

---

## 6. Pautas de Recursos Gráficos y Activos de Producción

* **Favicon e Isotipo:** Centralizados en `/images/Akros-logo.png` y `/images/Akros-logo-bosque.png`, eliminando placeholders o activos genéricos de prototipado.
* **Manejo de Proporciones:** Todo elemento `<Image />` en Next.js debe declarar `style={{ width: 'auto', height: 'auto' }}` o dimensiones simétricas para evitar alertas de distorsión en tiempo de ejecución.
* **Política de Preload:** Solo los recursos críticos del Hero (`LCP`) utilizan `priority`. Las imágenes bajo el pliegue (showcase, categorías, lounge) se cargan de forma diferida (`lazy`) optimizando el ancho de banda.
