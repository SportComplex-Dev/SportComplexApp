# AKROS Club · SportComplex: Sistema de Diseño & Especificación de Arquitectura de Producción
> **Versión:** 2.0.0-PROD  
> **Identidad de Marca:** AKROS Athletic & Wellness Club (Medellín, Colombia)  
> **Línea Base Tecnológica:** Next.js 16.3.7 (App Router, Server Actions, SSG/SSR/CSR), React 19, TypeScript 5.7.3, Tailwind CSS 4.3.3, Turborepo 2.11.4, pnpm 12.6.0, Prisma ORM 7.10.0 con Supabase / PostgreSQL 16, Stripe SDK (100% Cashless), Ed25519 / HMAC QR Access System, Lucide React 1.16+.

---

## 1. Visión Ejecutiva y Referentes Sensoriales

**AKROS Club (SportComplex)** es la plataforma digital de gestión deportiva y bienestar de alto nivel diseñada para operar complejos atléticos multisede en Medellín (*Sede Poblado* y *Sede Laureles*).

El sistema digitaliza íntegramente la experiencia del club a través de cuatro frentes unificados:
1. **Vitrina Pública y Experiencia del Cliente (`apps/web/src/app/(public)` y `(customer)`):**
   - Catálogo interactivo de instalaciones de alto rendimiento: Pádel panorámico con vidrio continuo, Tenis en polvo de ladrillo ITF, Campo de fútbol sintético certificado, Natación semiolímpica climatizada a 28°C, Gimnasio con biomecánica avanzada y Circuito de recuperación/zona húmeda (sauna finlandés y baño turco).
   - Reserva horaria con bloqueo anti-colisión de 30 minutos (RN-01, RN-07) y ventana máxima de 15 días calendario.
   - Pasarela 100% Cashless mediante Stripe (RN-13) con descuento automático del 30% para socios con membresía vigente (RN-08).
   - Emisión instantánea de pases digitales con QR criptográfico antifraude y comprobante PDF descargable (RN-14, RNF-05).
2. **Control de Acceso en Portería y Torniquetes (`apps/web/src/app/(staff)/scanner`):**
   - Validación instantánea con cámara nativa vía `html5-qrcode` (< 400 ms) operada por el rol `Empleado_Lector`, con tolerancia a fallas de red y verificación de vigencia horaria (RN-06).
3. **Punto de Venta Presencial Cashless (`apps/web/src/app/(staff)/pos`):**
   - Operación de mostrador para el rol `Empleado_Vendedor`, emisión directa de turnos y generación de recibos PDF para impresión térmica o estándar.
4. **Gobierno Corporativo y Administración (`apps/web/src/app/(admin)/admin`):**
   - Panel de control para el `Administrador`: afluencia en tiempo real, catálogo físico, aforos, gestión de personal con borrado lógico (RF-18) e inhabilitación por contingencia/mantenimiento (RF-19).

### 1.1 Referentes de Diseño e Inspiración Sensorial
* **The Grind (`thegrind.nl`):** Bienvenida cinematográfica con revelado tipográfico progresivo, transiciones fluidas y estética editorial atlética.
* **Waverun Media (`waverunmedia.com`):** Revelado stagger en tarjetas, microinteracciones magnéticas y bordes con iluminación sutil.
* **Alpine Guides (`alpineguides.co.nz`):** Contadores métricos rodantes en tiempo real, jerarquía limpia y badges técnicos.
* **Lacoste Ace Breaker:** Simulación geométrica de líneas de cancha, badges técnicos y dinamismo visual en el agendamiento deportivo.

---

## 2. Arquitectura del Monorepo Modular (Turborepo + pnpm)

El repositorio se estructura en un Monorepo gobernado por **Turborepo** y **pnpm workspaces**, aislando el dominio de la infraestructura web:

```
sport-complex/
├── apps/
│   └── web/                           # Aplicación Fullstack Unificada Next.js 16
│       ├── public/
│       │   ├── images/                # Activos fotográficos y logotipos de instalaciones
│       │   └── branding/              # Isotipos institucionales AKROS
│       ├── src/
│       │   ├── app/
│       │   │   ├── (public)/          # Landing Page SSG (force-static) y legal
│       │   │   ├── (auth)/            # Login, Registro y Verificación (15 min)
│       │   │   ├── (customer)/        # Portal Cliente (/portal, /portal/book, /portal/tickets, /portal/membership)
│       │   │   ├── (staff)/           # Punto de Venta (/pos) y Escáner QR (/scanner)
│       │   │   ├── (admin)/           # Consola de Administración (/admin/dashboard, services, employees, incident)
│       │   │   ├── api/               # API Routes REST y Webhooks (Stripe, access, pdf)
│       │   │   └── layout.tsx         # Root Layout con fuentes y proveedores globales
│       │   ├── middleware.ts          # Control de acceso perimetral RBAC
│       │   └── styles/
│       │       └── globals.css        # Configuración base y tokens de Tailwind CSS v4
├── packages/
│   ├── core/                          # Dominio puro, cálculo tarifario, festivos Nager.Date y seguridad QR
│   ├── db/                            # Prisma ORM 7.10.0, schema relacional y migraciones Supabase
│   ├── ui/                            # Biblioteca de componentes atómicos (@sportcomplex/ui)
│   ├── validation/                    # Contratos de validación con esquemas Zod 4
│   └── config/                        # Configuraciones compartidas de ESLint y TypeScript
├── docs/
│   ├── ARCHITECTURE.md                # Arquitectura de referencia del sistema
│   ├── SRS.md                         # Especificación formal de requisitos de software
│   └── DESIGN.md                      # Sistema de diseño unificado, tokens y UI (este documento)
```

---

## 3. Sistema de Diseño, Tokens Visuales & Tailwind CSS v4

La identidad visual está diseñada bajo **Tailwind CSS v4**, con soporte completo para modo claro y modo oscuro, manteniendo un ratio de contraste mínimo WCAG 2.2 AA (4.5:1 para texto regular, 3:1 para elementos de control e iconografía).

### 3.1 Tokens de Color Corporativos

| Token Semántico | Valor Hex Claro | Valor Hex Oscuro | Uso Semántico |
| :--- | :--- | :--- | :--- |
| `--brand-primary` | `#123e30` | `#d9f29f` | Verde esmeralda insignia institucional / primario |
| `--brand-primary-strong` | `#1d6048` | `#b8dc83` | Verde interactivo de énfasis / botones hover |
| `--brand-accent` | `#c9ef75` | `#b9e66b` | Lima cinético de alto impacto (CTAs, acentos, pulso activo) |
| `--brand-accent-hover`| `#d6f694` | `#cbf07c` | Estado hover de botones de acción principal |
| `--brand-hero-surface`| `#123b2d` | `#0f1a14` | Fondo oscuro del hero principal cinematográfico |
| `--color-canvas` | `#f7f8f5` | `#111815` | Superficie base de fondo (canvas) |
| `--color-surface` | `#ffffff` | `#19221e` | Superficie elevada (tarjetas, modales, barras) |
| `--color-surface-muted`| `#f1f3ee` | `#202b26` | Contenedores secundarios y pills |
| `--brand-border` | `#e7eae4` | `#303c35` | Bordes estructurales y líneas de división |
| `--color-content` | `#141d18` | `#f2f5f1` | Texto principal de alto contraste |
| `--color-content-muted`| `#526058` | `#a2aea6` | Texto secundario y leyendas auxiliares |

### 3.2 Categorías de Deporte & Tonalidades Semánticas
- **Canchas (Tenis, Pádel, Fútbol):** Tono Lima (`tone-lime`) · Fondo `#edf5dc` / Contenido `#446b36`
- **Piscinas (Natación semiolímpica, formativa):** Tono Azul (`tone-blue`) · Fondo `#e5f2f5` / Contenido `#397887`
- **Gimnasio (Fuerza, Biomecánica, Funcional):** Tono Naranja (`tone-orange`) · Fondo `#f9eee1` / Contenido `#ac6a35`
- **Zona Húmeda & Wellness (Sauna, Turco, Jacuzzi):** Tono Púrpura (`tone-purple`) · Fondo `#eeeafa` / Contenido `#7865a9`

### 3.3 Tipografía
- **Familia Primaria:** `Plus Jakarta Sans` (Google Fonts), cargada con `next/font/google` con subsets `latin`, pesos 400, 500, 600, 700 y 800.
- **Tipografía Monoespaciada:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas` para códigos de tiquete (`TKT-AKR-XXXX`) y marcas de tiempo.

---

## 4. Sistema de Iconografía Corporativa (`lucide-react`) & Mapeo Semántico

La suite oficial de iconografía se fundamenta exclusivamente en **`lucide-react`**, estandarizada por grosores de trazo ópticos:
- **Microiconos (11px – 13px):** `strokeWidth={2}` en badges de estado (`LiveDot`, `Star`, `BadgeCheck`).
- **Iconos en línea (14px – 17px):** `strokeWidth={1.75}` en botones, enlaces y migas de pan.
- **Iconos destacados / `IconBox` (18px – 24px):** `strokeWidth={1.5}` en cápsulas redondeadas (`icon-box`) con fondo temático.

### 4.1 Mapeo por Dominios de la Aplicación

| Dominio | Icono | Glifo Lucide | Uso en la Plataforma |
| :--- | :---: | :--- | :--- |
| **Instalaciones** | 👟 | `Footprints` | Canchas y deportes de raqueta/campo |
| | 🌊 | `Waves` | Piscinas, carriles de nado y zona acuática |
| | 🏋️ | `Dumbbell` | Gimnasio, pesas libres y biomecánica |
| | ✨ | `Sparkles` | Zona húmeda, sauna, turco y wellness |
| | 🏆 | `Trophy` | Torneos oficiales, ligas y eventos del club |
| **Logística & Agenda** | 📅 | `Calendar` | Selector de fechas en ventana de 15 días |
| | 🕒 | `Clock` | Franjas horarias y slots de 60 minutos |
| | 📍 | `MapPin` | Identificador de sede (*El Poblado* / *Laureles*) |
| | 👥 | `Users` | Aforo y número de asistentes autorizados |
| **Transacciones & Pases** | 💳 | `CreditCard` | Pasarela Stripe y pago digital cashless |
| | 🛡️ | `ShieldCheck` | Transacción segura y póliza deportiva |
| | 📱 | `QrCode` | Renderizado del tiquete QR dinámico |
| | 📷 | `ScanLine` | Escáner de portería y lectura de accesos |
| | 🎟️ | `Ticket` | Billetera digital de pases del socio |
| **Navegación & Sistema** | ➡️ | `ArrowRight` | Llamados a la acción y botones de avance |
| | ☀️ / 🌙 | `Sun` / `Moon` | Conmutador de tema visual (Dark / Light) |
| | ☰ / ✕ | `Menu` / `X` | Control de navegación móvil responsive |

---

## 5. Componentes de Interfaz & Anatomía del Landing Page

La vitrina institucional (`apps/web/src/app/(public)/page.tsx`) se compila como **Static Site Generation puro (`export const dynamic = 'force-static'`)** para alcanzar un LCP < 1.5s, articulando los siguientes módulos:

1. **`SplashScreen`:** Entrada cinematográfica opcional con logo animado y barra de carga sutil, descartable tras la primera visita del usuario.
2. **`HeroSection`:** Encabezado con imagen panorámica de alta definición, tipografía revelada por palabras (`word-blur-item`), prueba social dinámica (+2.400 personas, 4.9/5 estrellas) e indicador meteorológico en vivo de Medellín (23°C).
3. **`AthleticMarquee`:** Cinta cinética continua de anuncios en tiempo real y disponibilidad del día.
4. **`FacilityShowcase`:** Selector de pestañas interactivas para Pádel Panorámico, Tenis de Polvo de Ladrillo, Fútbol Sintético FIFA, Piscina Semiolímpica, Gimnasio Pro y Zona Húmeda, con desglose de especificaciones de superficie, iluminación y amenidades.
5. **`CategoryGrid` & `HowSection`:** Cuadrícula de acceso directo por categoría deportiva y guía de 3 pasos ("Elige, Reserva, Paga").
6. **`MembershipsSection`:** Selector de planes (*Pase Diario*, *Active Club*, *Black / Pro*) con toggle mensual/anual y cálculo de ahorro del 20%.
7. **`ClubEvents`:** Tarjetas informativas de torneos relámpago, masterclasses de tenis y sesiones de recuperación al atardecer.
8. **`LifestyleAndDigitalPass`:** Muestra dual del "Tercer Tiempo" (Healthy Lounge & Coworking) y simulación interactiva del Pase Digital QR en smartphone.
9. **`TestimonialsSection`:** Reseñas auditadas de socios con calificación de 5 estrellas.
10. **`InstitutionalFooter`:** Tarjetas de sedes físicas con dirección y horarios, enlaces de navegación estructurada, contacto directo por WhatsApp y sellos de seguridad SSL/Cashless.

---

## 6. Seguridad, Roles (RBAC) y Matriz de Acceso

Conforme a `ARCHITECTURE.md` §6.2 y `SRS.md`, el sistema implementa una matriz estricta de 4 roles de usuario:

| Ruta / Superficie | Anónimo / Público | `Cliente` | `Empleado_Vendedor` | `Empleado_Lector` | `Administrador` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Landing Page (`/`) | Lectura (SSG) | Lectura | Lectura | Lectura | Lectura |
| Reglamentos (`/legal`) | Lectura (SSG) | Lectura | Lectura | Lectura | Lectura |
| Portal Cliente (`/portal/*`) | Redirección 307 a `/login` | Acceso Total | Denegado (403) | Denegado (403) | Modo Auditor |
| Taquilla POS (`/pos`) | Redirección 307 a `/login` | Denegado (403) | Operar Turnos | Denegado (403) | Operar Turnos |
| Escáner Móvil (`/scanner`) | Redirección 307 a `/login` | Denegado (403) | Denegado (403) | Validar QR | Validar QR |
| Consola Admin (`/admin/*`) | Redirección 307 a `/login` | Denegado (403) | Denegado (403) | Denegado (403) | Control Total |

*El control perimetral se evalúa en `apps/web/src/middleware.ts` en el Edge. Los usuarios autenticados que acceden a `/` son redirigidos de inmediato a su portal correspondiente.*

---

## 7. Modelo de Datos y Concurrencia de Reservas (Prisma + PostgreSQL)

### 7.1 Reglas Clave de Negocio (RN)
- **RN-01 / RN-07:** Bloqueo provisional de turno con TTL de 30 minutos en estado `BLOQUEADA_TTL`. Si la pasarela Stripe no confirma la sesión dentro de los 30 minutos, el turno se libera automáticamente. *(Revisado en TSK-BE-09: 30 min = mínimo de plataforma de Stripe Checkout Sessions.)*
- **RN-02:** Los lunes no festivos las piscinas entran en mantenimiento obligatorio. Si el lunes es festivo nacional (consultado mediante cliente Nager.Date Colombia), el mantenimiento se traslada al martes siguiente.
- **RN-08:** Todo socio con suscripción activa en tabla `Membership` con estado `VIGENTE` recibe un 30% de descuento automático en checkout y taquilla.
- **RN-13:** Modelo 100% Cashless. Cero recepción de efectivo. Todos los cobros se tramitan vía Stripe (tarjetas, débito digital) y se concilian mediante Webhooks idempotentes.
- **RN-14:** Todo tiquete emitido genera un código QR criptográfico firmado con clave secreta (HMAC-SHA256 / Ed25519) que contiene el ID de reserva, identificador de usuario, sede, fecha y franja horaria.

---

## 8. Checklist de Producción & Criterios de Aceptación (DoD)

- [x] Identidad corporativa unificada: paleta esmeralda/lima/mist, tipografía Plus Jakarta Sans y logotipo oficial AKROS.
- [x] Landing Page institucional renderizada con modo estático puro (`force-static`) y LCP < 1.5s.
- [x] Responsive design verificado en móviles (375px), tablets (768px) y pantallas de escritorio (1280px+).
- [x] Componentes atómicos base en `@sportcomplex/ui` compatibles con Tailwind CSS v4.
- [x] Soporte nativo para modo oscuro y claro con preservación de contraste accesible.
- [x] Documentación de diseño alineada con `ARCHITECTURE.md` y `SRS.md`.
