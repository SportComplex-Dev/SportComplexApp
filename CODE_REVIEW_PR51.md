# Reporte de Revisión de Código — Pull Request #51 (Auditoría Final Independiente HEAD)

## Metadatos de la Revisión

| Parámetro | Detalle |
| :--- | :--- |
| **Pull Request** | PR #51 |
| **Título** | `feat(pos): (TSK-FE-18) interfaz de punto de venta 100% cashless` |
| **Rama Origen** | `feature/tsk-fe-18-interfaz-de-punto-de-venta` |
| **Rama Base** | `origin/develop` |
| **Commit Original Evaluado** | `fac203c0727c52c84d405a0b8fc529eb21bb35f9` (Rechazado inicialmente) |
| **Commit Actual Evaluado (HEAD)** | `8ba2ba8232bb2e0c6c5fc25283773e8df78b6137` (HEAD con correcciones locales) |
| **Fecha de Auditoría Final** | 2026-10-12 |
| **Rol del Auditor** | Senior Staff Software Engineer & Principal Security Reviewer |
| **Estado Empírico de Pruebas** | Suite ejecutada: **134/134 tests OK** en `web`, **26/26 tests OK** en `validation`, **93/94 tests OK** en `db` (1 skip BD real), **71/71 tests OK** en `core`. Typecheck OK en los 6 paquetes (`pnpm typecheck`). |

---

## Resumen Ejecutivo y Dictamen

### Dictamen: ❌ **CAMBIOS SOLICITADOS (CHANGES_REQUESTED)**

Tras una auditoría exhaustiva, independiente y empírica del código fuente real en HEAD (`8ba2ba8`), se determina que **el PR no se encuentra listo para integración a `develop` debido a la presencia de bloqueantes críticos de arquitectura, seguridad de pagos y fiabilidad operativa que fueron pasados por alto en la revisión previa**.

Si bien el commit `8ba2ba8` corrigió aspectos importantes del backend (transaccionalidad con `$transaction`, validación de aforo, chequeo autoritativo de membresías y eliminación de `pago` simulado en base de datos), **el flujo de punto de venta presencial (POS) en el cliente React (`pos/page.tsx`) quedó desconectado del ciclo de vida financiero de Stripe y contiene una regresión crítica**:
1. **Cobro Presencial Fantasma (Ghost Sale / Uncollected Payment):** Al pulsar *"Cobrar con Tarjeta Stripe"*, la UI llama a `POST /api/pos/checkout`, que crea una reserva en estado `PENDIENTE_PAGO` y un `PaymentIntent` en Stripe con estado `requires_payment_method`. Sin embargo, la interfaz de usuario **nunca presenta Stripe Elements, ni terminal, ni invoca `stripe.confirmCardPayment()`**. Ignora el `clientSecret` recibido, asume la venta como exitosa, marca localmente la reserva como `Confirmada` / `Aprobada` y felicita al cajero. **El cliente nunca paga, Stripe nunca cobra y la reserva en la base de datos expirará en 30 minutos.**
2. **Emisión de Código QR Apócrifo e Inválido (Regresión Crítica de ARCH-02):** Como la reserva permanece en `PENDIENTE_PAGO` en la base de datos, el endpoint oficial `GET /api/pdf/receipt` retorna `qr: null` (comportamiento contractual de TSK-BE-19). Ante esto, `pos/page.tsx` (línea 228) ejecuta un fallback en cliente:
   ```typescript
   const fallbackQrPayload = `SC1:${backendBooking.code}:AKROS_POS_VERIFIED`;
   ```
   Este payload **no contiene un UUID de ticket ni una firma criptográfica HMAC-SHA256 de 64 caracteres**. Cuando el cliente intente acceder a las instalaciones, el lector de torniquetes (`/api/access/redeem` / `parseTicketQrPayload`) rechazará el boleto con error 400.
3. **Contingencia Móvil Inoperativa y Vulnerable a PCI-DSS (ARCH-03 Incompleto):** El enlace alternativo (`stripe_link`) envía al usuario a `/checkout`, el cual es un componente mock en memoria que simula pagos con `setTimeout`, solicita números de tarjeta (PAN) y CVC en texto plano dentro del estado de React (no cumple PCI-DSS SAQ A) y nunca confirma la reserva real en la base de datos.

---

## Matriz de Verificación de Hallazgos Previos

| Código | Severidad | Categoría | Archivo(s) | Estado Previo | **Estado Real Auditado** | Veredicto y Evidencia Empírica |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **SEC-01** | 🔴 CRÍTICA | Seguridad / PCI-DSS | `pos/page.tsx`, `pos-payment-stripe.tsx` | RESUELTO | **PARCIAL** | En el POS UI se eliminaron los inputs de PAN/CVC. Sin embargo, no se implementó la interfaz tokenizada real (Stripe Elements / Terminal SDK), y el flujo alternativo `/checkout` continúa capturando PAN/CVC en texto plano. |
| **SEC-02** | 🔴 CRÍTICA | Seguridad / Finanzas | `api/pos/checkout/route.ts`, `pos/page.tsx` | RESUELTO | **PARCIAL** | El backend ya no inserta pagos aprobados falsos. Pero la UI simula una confirmación local ("Zero-Fund Booking" en cliente), emitiendo comprobantes de venta "aprobada" sin haber cobrado fondos. |
| **ARCH-01** | 🔴 CRÍTICA | Arquitectura / Pagos | `api/pos/checkout/route.ts`, `pos/page.tsx` | RESUELTO | **PARCIAL** | El backend genera `PaymentIntent` oficial de Stripe, pero el frontend no está cableado para confirmarlo ni para esperar la resolución del webhook de Stripe antes de emitir el voucher. |
| **SEC-03** | 🟠 ALTA | Seguridad / Negocio | `api/pos/checkout/route.ts` | RESUELTO | **RESUELTO** | Verificado empíricamente: consulta autoritativa a `db.membresia.findFirst({ where: { usuarioId, estado: "VIGENTE" } })`. Ignora el flag manipulado del cliente (`esSocio`). |
| **SEC-04** | 🟠 ALTA | Seguridad / Auth | `apps/web/src/lib/api-auth.ts` | RESUELTO | **RESUELTO** | Verificado: guard estricto `process.env.NODE_ENV === "test"` restablecido para `__scAuthSession` y `__scPrisma`. |
| **ARCH-02** | 🟠 ALTA | Fiabilidad / Integridad | `pos/page.tsx` | RESUELTO | **PENDIENTE (REGRESIÓN)** | Si la API de comprobantes no devuelve QR (porque la reserva está pendiente de pago), el cliente genera un QR sintético sin firma HMAC (`SC1:${backendBooking.code}:AKROS_POS_VERIFIED`), el cual es inválido para torniquetes. |
| **ARCH-03** | 🟠 ALTA | Arquitectura / Integración | `checkout/page.tsx`, `pos/page.tsx` | RESUELTO | **PENDIENTE (INCOMPLETO)** | `/checkout` lee parámetros de URL envuelto en `<Suspense>`, pero es un mock desconectado del backend. Al pagar en `/checkout`, no se confirma la reserva de taquilla y el hold expira en 30 minutos. |
| **PERF-01** | 🟠 ALTA | BD / Concurrencia | `api/pos/checkout/route.ts` | RESUELTO | **RESUELTO** | Mutación atómica en `db.$transaction`, verificación estricta de cupos (`cuposOcupados + cantidad <= cuposTotales`) y rechazo de mantenimiento (409 `SLOT_BLOCKED`). |
| **PERF-02** | 🟠 ALTA | Lógica de Negocio | `api/pos/checkout/route.ts` | RESUELTO | **RESUELTO** | Resolución correcta de franja horaria mediante `disponibilidadId` o matching por hora de `slotTime`. |
| **TEST-01** | 🟡 MEDIA | Cobertura de Tests | `pos-ui.test.ts`, `pos.test.ts` | RESUELTO | **PARCIAL** | 7 tests de API sólidos. Los 6 tests de UI solo validan renderizado estático de cadenas (`renderToString`); no prueban el ciclo de vida de pago en el cliente ni la validez del QR emitido contra el lector de acceso. |
| **CODE-01** | 🟡 MEDIA | Mantenibilidad | `pos/page.tsx`, `pos/components/*` | RESUELTO | **RESUELTO** | Código modularizado en 5 submódulos (`pos-catalog-selector`, `pos-client-form`, `pos-payment-stripe`, `pos-voucher-modal`, `pos-alt-link-modal`). |
| **CODE-02** | 🟢 BAJA | Accesibilidad / WCAG | `pos/components/*` | RESUELTO | **RESUELTO** | Inputs con `htmlFor`/`id`, selectores con `role="group"`, `aria-labelledby`, botones con `aria-pressed`. |
| **DOC-01** | 🟢 BAJA | Documentación | `docs/TSK-FE-18-interfaz-pos-cashless.md` | RESUELTO | **RESUELTO** | Documentación técnica completa creada, aunque describe un flujo de confirmación de Stripe que el frontend actual no implementa. |

---

## Hallazgos Críticos y Bloqueantes Nuevos / No Resueltos

### 🔴 BLOQUEANTE 1: Venta Fantasma en UI — Pago no cobrado y reserva expirada (SEC-02 / ARCH-01)

- **Ubicación:** `apps/web/src/app/(staff)/pos/page.tsx` (Líneas 165–264) y `pos-payment-stripe.tsx` (Líneas 99–116).
- **Descripción:** 
  Al pulsar el botón *"Cobrar con Tarjeta Stripe"*, la función `handleProcessStripePayment` envía la petición a `POST /api/pos/checkout`. La API responde con:
  ```json
  {
    "success": true,
    "booking": { "id": "...", "status": "PENDIENTE_PAGO" },
    "paymentIntent": { "id": "pi_...", "clientSecret": "pi_..._secret_..." }
  }
  ```
  La función en el cliente **ignora por completo el `clientSecret` y el `paymentIntent`**. No interactúa con Stripe SDK, ni abre Stripe Elements, ni solicita datos de cobro a un datáfono. En su lugar, ejecuta inmediatamente:
  ```typescript
  const newBooking: Booking = {
    ...
    status: 'Confirmada',
    paymentMethod: 'card',
    paymentStatus: 'Aprobada',
  };
  setBookings([newBooking, ...bookings]);
  setConfirmedBooking(newBooking);
  notify('¡Venta completada! Reserva confirmada y pase emitido.', 'success');
  ```
- **Impacto:**
  1. **Impacto Financiero:** No se debita dinero de ninguna tarjeta. El negocio pierde el 100% de los ingresos de las ventas en taquilla.
  2. **Inconsistencia de Datos:** La UI reporta la reserva como "Confirmada", pero en la base de datos PostgreSQL permanece como `PENDIENTE_PAGO`.
  3. **Cancelación Automática:** A los 30 minutos, el job cron de limpieza (`TSK-BD-08`) marca la reserva como `EXPIRADA` y libera los cupos, anulando la reserva del cliente.

---

### 🔴 BLOQUEANTE 2: Emisión de Códigos QR Falsos e Inválidos para Torniquetes (Regresión ARCH-02)

- **Ubicación:** `apps/web/src/app/(staff)/pos/page.tsx` (Líneas 228–233).
- **Código Vulnerable:**
  ```typescript
  if (!qrDataUrl) {
    const fallbackQrPayload = `SC1:${backendBooking.code}:AKROS_POS_VERIFIED`;
    qrDataUrl = await QRCode.toDataURL(fallbackQrPayload, { width: 260, margin: 2 });
  }
  ```
- **Descripción:**
  Dado que la reserva sigue en `PENDIENTE_PAGO`, la consulta a `GET /api/pdf/receipt` devuelve `qr: null` y `ticket: null` (según las reglas de negocio de TSK-BE-19, los boletos solo se emiten una vez aprobado el pago). Ante la ausencia de QR, el cliente genera un QR sintético inventado.
- **Impacto de Seguridad y Operativo:**
  El estándar de control de acceso óptico (`packages/core/src/security/qr.ts`) define:
  ```typescript
  export function parseTicketQrPayload(text: string): { ticketId: string; signature: string } | null {
    // Exige: prefijo "SC1", ticketId UUID v4 válido, firma HMAC-SHA256 de 64 hex
  }
  ```
  El string `SC1:AKR-POS-XXXX:AKROS_POS_VERIFIED` falla ambas validaciones (`AKR-POS-XXXX` no es un UUID y `AKROS_POS_VERIFIED` no es una firma hexadecimal de 64 caracteres). `parseTicketQrPayload` retorna `null`.
  **Resultado:** El comprobante impreso en la taquilla muestra un código QR inútil. Cuando el usuario lo presente en el torniquete de acceso, el lector responderá `400 Bad Request` y no abrirá la puerta.

---

### 🟠 BLOQUEANTE 3: Contingencia Móvil `/checkout` es un Mock Inseguro (ARCH-03 / SEC-01)

- **Ubicación:** `apps/web/src/app/(customer)/checkout/page.tsx` (Líneas 80–84 y 199–224).
- **Descripción:**
  La solución propuesta para el Riesgo 2 de SRS §11.1 (contingencia para tarjetas 3DS) genera un enlace hacia `/checkout?session_id=pos_alt_...&reservaId=...`. Sin embargo:
  1. `checkout/page.tsx` maneja un formulario que captura número de tarjeta, fecha de vencimiento y código CVC en texto plano dentro del estado de React (`cardNumber`, `cardCvc`), violando los estándares PCI-DSS SAQ A.
  2. Al pulsar pagar, ejecuta un `setTimeout` simulado:
     ```typescript
     setTimeout(() => {
       const booking = { id: `b${Date.now()}`, ... };
       setBookings([booking, ...bookings]);
       router.push('/confirmation');
     }, 2100);
     ```
     No realiza ninguna petición HTTP hacia el backend ni hacia Stripe. La reserva creada en taquilla (`reservaId`) queda abandonada y expira tras 30 minutos.

---

## Análisis Exhaustivo por las 6 Áreas

### 1. Arquitectura y Patrones de Diseño
- **Backend POS (`api/pos/checkout/route.ts`):** Excelente diseño en la capa transaccional. La orquestación con `$transaction`, validación de aforo, creación de usuario walk-in y generación de `PaymentIntent` con idempotencia cumple rigurosamente con los patrones empresariales de TSK-BE-18.
- **Frontend POS (`pos/page.tsx`):** Desconexión arquitectónica. No respeta el diagrama de secuencia documentado en `docs/TSK-FE-18-interfaz-pos-cashless.md`. Se salta el paso de confirmación de Stripe y asume que crear un `PaymentIntent` equivale a completar el pago.
- **Integración Webhook:** El webhook en `/api/payments` está preparado para recibir `payment_intent.succeeded` con metadatos POS y emitir el `TicketQr` firmado. La falla radica en que el cliente nunca gatilla dicho evento en Stripe.

### 2. Calidad de Código y Mantenibilidad
- **Modularización (CODE-01):** Notable mejora respecto al commit original (`fac203c`). Los submódulos bajo `pos/components/` son legibles, desacoplados y respetan el paso de propiedades tipadas.
- **Accesibilidad WCAG (CODE-02):** Se cumple WCAG 1.3.1 y 4.1.2 mediante atributos semánticos `htmlFor`/`id`, `role="group"`, `aria-labelledby` y `aria-pressed`.
- **Anti-patrón de degradación:** El bloque `try/catch` alrededor de `/api/pdf/receipt` que degenera en un QR inventado oculta fallos de negocio y rompe el principio de fallo explícito.

### 3. Seguridad y Validación de Entrada
- **PCI-DSS:** En `PosPaymentStripe` no hay captura de PAN/CVC, lo cual es positivo. Sin embargo, no hay formulario seguro de Stripe Elements montado para procesar la tarjeta real. En `checkout/page.tsx`, existe captura insegura de CVC/PAN en texto plano.
- **Bypass de Autorización:** El guard de `authorizeApiRequest` en `api/pos/checkout/route.ts` restringe exitosamente el endpoint a roles `Empleado_Vendedor` y `Administrador`.
- **Aislamiento de Perímetro (SEC-04):** `api-auth.ts` y `route.ts` ahora protegen el acceso a `globalThis.__scAuthSession` y `globalThis.__scPrisma` bajo `process.env.NODE_ENV === "test"`. En producción no existe vector de inyección de sesiones simuladas mediante cabeceras no sanitizadas.
- **Validación Autoritativa de Membresías (SEC-03):** La regla RN-08 se aplica de forma segura consultando la base de datos. Manipular `esSocio: true` en el payload JSON no otorga descuento indebido.

### 4. Tests y Cobertura
- **Resultados de Ejecución:**
  - `pnpm test`: **324 pruebas totales exitosas** en todo el monorepo (134 en `web`, 26 en `validation`, 93 en `db`, 71 en `core`).
  - `pnpm typecheck`: **0 errores de TypeScript** en los 6 paquetes.
- **Gaps Críticos en Pruebas:**
  - `pos-ui.test.ts` utiliza `renderToString` para probar fragmentos HTML estáticos. No contiene pruebas de interacción (`fireEvent` / render interactivo) que simulen el flujo de `handleProcessStripePayment`.
  - No existe prueba de integración que verifique que el QR emitido tras el cobro sea verificable por `parseTicketQrPayload()` y `verifyTicketSignature()`.

### 5. Performance y Concurrencia
- **Control de Aforo y Sobreventa (PERF-01):** Resuelto satisfactoriamente. La verificación `cuposOcupados + cantidad <= cuposTotales` dentro de `tx` previene condiciones de carrera en ventas simultáneas.
- **Mapeo de Franjas (PERF-02):** Resuelto. Soporta `disponibilidadId` explícito o correlación horaria contra `slotTime`.

### 6. Documentación
- `docs/TSK-FE-18-interfaz-pos-cashless.md` está bien estructurada y detalla la arquitectura de hardware de impresión térmica (58 mm y 80 mm). Sin embargo, describe un flujo de pasarela que actualmente no está implementado en la UI.

---

## Plan de Remediación Obligatorio (Para Aprobación)

1. **Integrar Stripe Elements o Confirmación de Terminal en `PosPaymentStripe`:**
   - Montar `@stripe/react-stripe-js` (`PaymentElement` o captura segura tokenizada) o integrar la confirmación del `clientSecret` mediante `stripe.confirmCardPayment(clientSecret)`.
   - No considerar la venta como finalizada ni marcar `status: 'Confirmada'` hasta que Stripe devuelva confirmación exitosa o el webhook procese el pago.
2. **Eliminar el Fallback Apócrifo del Código QR:**
   - Eliminar `fallbackQrPayload = SC1:...:AKROS_POS_VERIFIED`.
   - Si la reserva no posee `ticketQr` emitido por el servidor, la taquilla debe mostrar un indicador de *"Esperando confirmación de pago y emisión de pase..."* o consultar el comprobante una vez que el estado de la reserva sea `CONFIRMADA`.
3. **Conectar la Contingencia Móvil con Stripe Checkout Real:**
   - Si `paymentMode === "stripe_link"`, generar una sesión real de Stripe Checkout (ej. `createStripeCheckoutSession()`) para que el cliente pague de forma segura en su móvil sin capturar tarjetas en texto plano en `/checkout`.

---

**Conclusión:** Se rechaza temporalmente la integración del PR #51 hasta que se solventen los 3 bloqueantes críticos señalados.

VERDICT: CHANGES_REQUESTED
