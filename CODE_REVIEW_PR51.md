# Reporte de Revisión de Código — Pull Request #51

## Metadatos de la Revisión

| Parámetro | Detalle |
| :--- | :--- |
| **Pull Request** | PR #51 |
| **Título** | `feat(pos): (TSK-FE-18) interfaz de punto de venta 100% cashless` |
| **Rama Origen** | `feature/tsk-fe-18-interfaz-de-punto-de-venta` |
| **Rama Base** | `origin/develop` |
| **Commit Evaluado** | `fac203c0727c52c84d405a0b8fc529eb21bb35f9` (HEAD) |
| **Commits en el PR** | `2241cce`, `8594d77`, `fac203c` |
| **Fecha de Revisión** | 2026-10-12 |
| **Rol del Revisor** | Senior Staff Software Engineer & Security Reviewer |
| **Estado de Pruebas** | Suite ejecutada: 127 tests OK (`pnpm test`), Typecheck OK (`tsc --noEmit`), Lint OK (`eslint .`) |

---

## Resumen Ejecutivo y Dictamen

### Dictamen: 🛑 **RECHAZADO (CAMBIOS REQUERIDOS CRÍTICOS / BLOCKER)**

El PR #51 implementa la interfaz de Taquilla POS presencial y su soporte backend con el objetivo de dar cumplimiento a la tarea **TSK-FE-18** (asociada a los requisitos RF-17, RN-13 y RNF-05). La interfaz visual y la experiencia de usuario mostrador son estéticamente atractivas y bien integradas en Tailwind con la paleta AKROS; sin embargo, **el código contiene fallas de seguridad de severidad CRÍTICA, violaciones de estándares PCI-DSS, riesgo de fraude financiero por cobros simulados, condiciones de carrera sin transaccionalidad con sobreventa ilimitada, y una ruptura estructural con la arquitectura de backend preexistente (TSK-BE-18)**.

A pesar de que la suite automatizada reporta 127 pruebas en verde, esto es producto de pruebas que evalúan mocks convenientes y esquemas Zod en aislamiento, ocultando que **el flujo real de pago con tarjeta en la taquilla no interactúa con Stripe, no recauda fondos y emite tiquetes y reservas 100% gratuitos y confirmados**.

Bajo ningún concepto este Pull Request debe ser fusionado a `develop` ni desplegado en un entorno productivo o pre-productivo sin antes corregir los bloqueadores detallados a continuación.

---

## Matriz de Hallazgos por Severidad

| Código | Severidad | Categoría | Archivo(s) Afectado(s) | Resumen del Hallazgo |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | 🔴 **CRÍTICA** | Seguridad / PCI-DSS | `apps/web/src/app/(staff)/pos/page.tsx` | Captura insegura de PAN/CVC en texto plano en React state; violación de PCI-DSS. |
| **SEC-02** | 🔴 **CRÍTICA** | Seguridad / Finanzas | `apps/web/src/app/api/pos/checkout/route.ts` | Cobro simulado ("Zero-Fund Booking"): se aprueban pagos y emiten reservas sin llamar a Stripe. |
| **ARCH-01** | 🔴 **CRÍTICA** | Arquitectura | `apps/web/src/app/api/pos/checkout/route.ts` | Bypass de la arquitectura empresarial TSK-BE-18 (`/api/payments/intent` + Webhooks). |
| **SEC-03** | 🟠 **ALTA** | Seguridad / Negocio | `apps/web/src/app/api/pos/checkout/route.ts` | Descuento de socio (30%) no validado en servidor; vulnerable a manipulación de cliente (RN-08). |
| **SEC-04** | 🟠 **ALTA** | Seguridad / Auth | `apps/web/src/lib/api-auth.ts` | Eliminación del guard `NODE_ENV === "test"` para sesión y BD en `globalThis`. |
| **ARCH-02** | 🟠 **ALTA** | Arquitectura / Fiabilidad | `apps/web/src/app/(staff)/pos/page.tsx` | Generación silenciosa de reservas falsas y QR con firma inválida ante fallo de API. |
| **ARCH-03** | 🟠 **ALTA** | Arquitectura / Integración | `apps/web/src/app/(staff)/pos/page.tsx` | Enlace alternativo (Riesgo 2 SRS §11.1) roto e incompatible con `/checkout`. |
| **PERF-01** | 🟠 **ALTA** | Base de Datos / Concurrencia | `apps/web/src/app/api/pos/checkout/route.ts` | Ausencia de `$transaction` y condición de carrera: sobreventa (overbooking) descontrolada. |
| **PERF-02** | 🟠 **ALTA** | Lógica de Negocio | `apps/web/src/app/api/pos/checkout/route.ts` | Incompatibilidad de franjas horarias: se asigna siempre la primera franja del día sin importar `slotTime`. |
| **TEST-01** | 🟡 **MEDIA** | Testing / Cobertura | `apps/web/src/app/(staff)/pos/__tests__/pos-ui.test.ts` | 0% de pruebas sobre el componente React `PosPage` (falsa sensación de cobertura). |
| **CODE-01** | 🟡 **MEDIA** | Mantenibilidad | `apps/web/src/app/(staff)/pos/page.tsx` | Componente monolítico de 908 líneas; violación de responsabilidad única (SRP). |
| **CODE-02** | 🟢 **BAJA** | Accesibilidad / Estándares | `apps/web/src/app/(staff)/pos/page.tsx` | Inputs de formulario sin etiquetas vinculadas por `id`/`htmlFor` (violación WCAG 1.3.1 y 4.1.2). |
| **DOC-01** | 🟢 **BAJA** | Documentación | Monorepo / Raíz | Inconsistencia entre la documentación declarada ("100% cashless Stripe") y la ejecución real. |

---

## Análisis Exhaustivo por Áreas

### 1. Arquitectura y Patrones de Diseño

#### 1.1 Duplicación y Bypass de la Arquitectura Existente (TSK-BE-18) — [ARCH-01]
En el sprint anterior, la arquitectura para cobros POS fue definida y probada en `TSK-BE-18` a través de los siguientes componentes:
1. `POST /api/bookings`: Genera un hold de reserva con canal `TAQUILLA`, vendedor asociado `vendedorId`, estado `PENDIENTE_PAGO` y expiración autoritativa en 30 minutos (`RESERVA.expira_en`).
2. `POST /api/payments/intent` (`apps/web/src/app/api/payments/intent/route.ts`): Emite un `PaymentIntent` oficial en Stripe utilizando `createPosPaymentIntent()` de `@sportcomplex/core`, asociando metadatos criptográficos (`bookingId`, `userId`, `vendedorId`, `servicio_id`, `cashless: true`).
3. **Stripe Webhook** (`apps/web/src/app/api/payments/route.ts` y `/api/webhooks/stripe/route.ts`): Al recibir `payment_intent.succeeded`, transiciona la reserva a `CONFIRMADA`, crea el registro `PAGO` con el `monto` y `stripePaymentIntentId` real, y emite el `TicketQr` firmado con HMAC-SHA256.

**Lo que hizo este PR:**
En lugar de conectar la interfaz de usuario `PosPage` con este pipeline ya existente y probado, el PR introdujo un nuevo endpoint completamente aislado: `POST /api/pos/checkout/route.ts`. Este nuevo endpoint implementa un script monolítico procedural que:
- No reserva cupo previo mediante hold.
- No utiliza `createPosPaymentIntent()`.
- No invoca al SDK de Stripe.
- No utiliza el Webhook de confirmación.
- Asume transaccionalidad manual inventando IDs de pago.

Esto genera dos fuentes de verdad contradictorias en el backend para la misma funcionalidad de negocio.

#### 1.2 Anti-patrón de "Fallback Silencioso con Datos Falsos" — [ARCH-02]
En `apps/web/src/app/(staff)/pos/page.tsx` (líneas 212-254):
```typescript
let apiResponse: PosApiResponse | null = null;
try {
  const res = await fetch('/api/pos/checkout', { ... });
  if (res.ok) {
    const json = await res.json();
    if (json.success) apiResponse = json.data as PosApiResponse;
  }
} catch {
  // Fallback local robusto
}

// Emite como CONFIRMADA aunque res.ok haya sido false o haya ocurrido error de red:
const randomCode = `AKR-POS-...`;
const newBooking: Booking = {
  id: apiResponse?.booking?.id || `book-pos-${Date.now()}`,
  code: apiResponse?.booking?.code || randomCode,
  ...
  status: 'Confirmada',
};
const qrData: string = apiResponse?.ticket?.qrPayload || `SC1:${newBooking.code}:pos_voucher_signature`;
```
**Impacto Arquitectónico:**
Si el backend responde `403 Forbidden`, `400 Bad Request`, `500 Internal Server Error`, o si la red se cae:
- El componente **ignora el error**.
- Genera en memoria un objeto `Booking` con ID inventado `book-pos-...`.
- Genera un código QR con una firma apócrifa (`pos_voucher_signature`).
- Muestra el modal verde de "¡Venta Exitosa en Mostrador!".
- Imprime el comprobante al cliente.

Cuando el cliente se acerque al torniquete óptico o al personal con lector móvil (`apps/web/src/app/api/access/route.ts`), el sistema validará la firma con `verifyTicketSignature()` y buscará el ticket en la base de datos: el ticket **será rechazado inmediatamente como fraudulento o inexistente**. Esto es inaceptable en una aplicación de misión crítica.

#### 1.3 Incompatibilidad del Enlace Alternativo (Riesgo 2 SRS §11.1) — [ARCH-03]
El requerimiento de contingencia para tarjetas con 3DS o fallas de datáfono físico/virtual estipula que el vendedor puede generar un enlace para que el cliente pague en su propio celular.
El PR construye el siguiente enlace (`pos/page.tsx`, línea 274):
```typescript
const link = `${origin}/checkout?session_id=${tempBookingId}&service=${encodeURIComponent(currentService.name)}&amount=${totalFinal}`;
```
Sin embargo, al auditar `apps/web/src/app/(customer)/checkout/page.tsx` (líneas 66-80):
```typescript
const [draft, setDraft] = useDraft();
if (!draft || !item || !category) {
  return (
    <main className="section-shell payment-page">
      <div className="dashboard-empty">
        <b>No tienes una reserva en curso</b>
        <p>Elige un espacio y un horario para continuar.</p>
      </div>
    </main>
  );
}
```
La pantalla `/checkout` **no lee ni procesa los parámetros de URL `session_id`, `service` ni `amount`**, sino que depende exclusivamente del estado `useDraft()` persistido en el `localStorage` del navegador. Cuando el cliente escanea el código QR desde su teléfono móvil personal, su navegador móvil no tiene ningún `draft` en almacenamiento local, resultando invariablemente en una pantalla en blanco con el mensaje *"No tienes una reserva en curso"*.

---

### 2. Calidad del Código y Mejores Prácticas

#### 2.1 Monolito UI y Falta de Modularización — [CODE-01]
`apps/web/src/app/(staff)/pos/page.tsx` cuenta con **908 líneas de código** en un único archivo `'use client'`.
Este componente asume demasiadas responsabilidades que violan el principio de responsabilidad única (SRP):
1. Gestión de estado de filtros y catálogo (categorías y servicios).
2. Lógica de selección de fecha y turnos.
3. Formulario y validación de cliente / walk-in rápido.
4. Formateo y captura de datos de tarjeta de crédito (máscaras y restricciones).
5. Desglose contable financiero (cálculo de subtotal e IVA).
6. Comunicación HTTP con API y fallbacks locales.
7. Generación gráfica de códigos QR con `QRCode.toDataURL`.
8. Renderizado del comprobante térmico imprimible.
9. Modales de enlace alternativo y confirmación.

**Recomendación de Refactorización:**
Desacoplar en submódulos especializados dentro de `apps/web/src/app/(staff)/pos/components/`:
- `pos-catalog-selector.tsx`
- `pos-client-form.tsx`
- `pos-payment-stripe.tsx`
- `pos-voucher-modal.tsx`
- `pos-alt-link-modal.tsx`
- Hook de estado: `use-pos-checkout.ts`

#### 2.2 Variables Hardcodeadas y Datos Descartados
- **Horarios estáticos:** `defaultTimeSlots` (líneas 36-50 de `pos/page.tsx`) define horarios quemados (`'06:00 a. m. - 07:00 a. m.'` hasta `'08:00 p. m. - 09:00 p. m.'`), ignorando las franjas horarias reales configuradas en la base de datos (`franjaHoraria`) por servicio.
- **Datos de tarjeta ficticios:** En `pos/page.tsx`, el usuario ingresa número de tarjeta, fecha de expiración, titular, CVC y número de cuotas. Luego de validar su formato, los campos `cardExp`, `cardCvc`, `cardHolder` e `installments` son **descartados**; únicamente se envía `cardLast4` a la API.
- **Contraseña insegura por defecto:** En `route.ts` (línea 78), al registrar un cliente presencial nuevo se asigna:
  `passwordHash: "$2b$10$pos_dummy_hash_for_cashless_walk_in"`. No se provee mecanismo de activación o invitación para que el usuario reclame su cuenta posteriormente.

---

### 3. Seguridad y Validación de Entrada

#### 3.1 Violación Crítica de PCI-DSS en Formulario de Tarjeta — [SEC-01]
En `apps/web/src/app/(staff)/pos/page.tsx` (líneas 78-83 y 656-684):
```typescript
const [cardNumber, setCardNumber] = useState<string>('')
const [cardHolder, setCardHolder] = useState<string>('')
const [cardExp, setCardExp] = useState<string>('')
const [cardCvc, setCardCvc] = useState<string>('')
...
<Input placeholder="4000 1234 5678 9010" value={cardNumber} ... />
<Input placeholder="CVC" type="password" value={cardCvc} ... />
```
**Análisis de Vulnerabilidad:**
La captura de datos de tarjeta de crédito (PAN) y código de validación (CVV/CVC) directamente en campos `<input>` no encapsulados en un iframe seguro certificado (como **Stripe Elements** o el SDK de **Stripe Terminal**) coloca a la aplicación web entera bajo el alcance de auditoría **PCI-DSS SAQ D** (el nivel más exigente y de mayor riesgo legal).
Si un script malicioso (XSS, dependencia npm vulnerada o extensión de navegador del empleado) se ejecuta en la máquina de taquilla, puede capturar en texto plano los números de tarjeta y CVV de los clientes de mostrador.
Además, dado que el sistema no llama a Stripe, estos datos son recolectados inútilmente en memoria.

#### 3.2 Cobro Simulado / Creación de Reservas Gratuitas ("Zero-Fund Booking") — [SEC-02]
En `apps/web/src/app/api/pos/checkout/route.ts` (líneas 145-160):
```typescript
// 6. Si es cobro directo con tarjeta Stripe en POS
const stripePaymentIntentId = `pi_pos_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
const pago = await db.pago.create({
  data: {
    usuarioId: cliente.id,
    tipo: "RESERVA",
    stripePaymentIntentId,
    monto: totalFinal,
    estado: "APROBADO",
  },
});

await db.reserva.update({
  where: { id: reserva.id },
  data: { pagoId: pago.id },
});

// 7. Emitir Ticket QR firmado
const ticketId = newTicketId();
const qrSecret = process.env.QR_HMAC_SECRET || "akros-qr-hmac-secret-dev";
const signature = signTicket(ticketId, qrSecret);
```
**Impacto:**
El backend **falsifica** el cobro de Stripe generando una cadena arbitraria `pi_pos_...` e inserta inmediatamente en la tabla `pago` un registro con `estado: "APROBADO"`.
Cualquier usuario con rol `Empleado_Vendedor` o `Administrador` (o cualquier persona que envíe un HTTP POST a `/api/pos/checkout`) puede reservar cualquier cancha, piscina o servicio del complejo deportivo **sin pagar un solo centavo**, obteniendo boletos QR con firma criptográfica legítima que permitirán el paso en torniquetes. Esto representa un agujero financiero y de auditoría crítico.

#### 3.3 Fraude en Descuento de Membresía (RN-08) — [SEC-03]
El esquema de validación en `packages/validation/src/booking.schema.ts` contiene:
```typescript
esSocio: z.boolean().default(false),
```
Y en `apps/web/src/app/api/pos/checkout/route.ts` (líneas 58-60):
```typescript
const totalCents = applyMembershipDiscount(subtotalBruto * 100, input.esSocio);
const totalFinal = Math.round(totalCents / 100);
const descuentoPct = input.esSocio ? 30 : 0;
```
El servidor confía ciegamente en el booleano `input.esSocio` enviado en el cuerpo de la petición. No existe ninguna consulta en la base de datos a la tabla `membresia` para constatar si `cliente.id` o `input.clienteDocumento` posee un registro con `estado: "VIGENTE"`. Cualquier cliente u operador puede forzar el descuento del 30% simplemente marcando el checkbox en UI o enviando `{"esSocio": true}` en el JSON.

#### 3.4 Eliminación del Guard de Entorno de Pruebas en `api-auth.ts` — [SEC-04]
En `apps/web/src/lib/api-auth.ts`:
```diff
- const injectedSession =
-   process.env.NODE_ENV === "test"
-     ? (globalThis as typeof globalThis & {
-         __scAuthSession?: SessionLike | null;
-       }).__scAuthSession
-     : undefined;
+ const injectedSession = (globalThis as typeof globalThis & {
+   __scAuthSession?: SessionLike | null;
+ }).__scAuthSession;
```
Y para la base de datos:
```typescript
const db: AuthorizationDatabase =
  dependencies.db ??
  (globalThis as unknown as { __scPrisma?: AuthorizationDatabase }).__scPrisma ??
  prisma;
```
Al remover la restricción `process.env.NODE_ENV === "test"`, estas variables globales quedan activas en entornos de staging o producción. Si una librería externa de terceros o código ejecutado en el servidor Next.js manipula `globalThis.__scAuthSession` o `globalThis.__scPrisma`, la autorización perimetral quedará completamente vulnerada.

---

### 4. Tests y Cobertura

#### 4.1 Análisis del Resultado de la Suite Automatizada
Al ejecutar `pnpm test`, la consola reporta:
```
Tasks: 9 successful, 9 total
Tests: 127 pass, 0 fail
```
Y `pnpm typecheck` (`tsc --noEmit`):
```
Tasks: 6 successful, 6 total
```

#### 4.2 Ilusión de Cobertura en `pos-ui.test.ts` — [TEST-01]
A pesar de ubicarse en `apps/web/src/app/(staff)/pos/__tests__/pos-ui.test.ts`, este archivo **no realiza pruebas de interfaz de usuario**:
- No utiliza React Testing Library, `jsdom`, ni ningún entorno de simulación del DOM.
- Solo prueba funciones de cálculo (`applyMembershipDiscount`, `calcularDesgloseComprobante`), generación de Data URL de QR (`QRCode.toDataURL`) y validación de esquemas Zod (`posCheckoutSchema`).
- **Líneas cubiertas del componente `PosPage` (908 líneas): 0%**.
- No se prueba el comportamiento de los botones de cobro, el formateo de tarjetas, la visualización de modales, el manejo de errores de API, ni la impresión del comprobante.

#### 4.3 Pruebas de API Acopladas a Mocks Sesgados
En `apps/web/src/app/api/pos/__tests__/pos.test.ts`:
- Se mockea toda la base de datos mediante mutación forzada de `globalThis.__scPrisma`.
- La prueba `"POS API: venta presencial exitosa 100% cashless con Stripe"` valida que el ID comience por `pi_pos_`, validando el comportamiento simulado en lugar de detectar la ausencia de integración con Stripe.
- No existen casos de prueba para:
  - Capacidad máxima excedida (aforo lleno).
  - Conflictos de concurrencia.
  - Franja horaria bloqueada por mantenimiento.
  - Fallo en pasarela de pagos.
  - Reversión transaccional en fallo de emisión de ticket QR.

---

### 5. Performance y Escalabilidad

#### 5.1 Falta de Transacciones y Condición de Carrera de Sobreventa (Overbooking) — [PERF-01]
En `apps/web/src/app/api/pos/checkout/route.ts`, el proceso de venta ejecuta **10 operaciones secuenciales no atómicas**:
1. `db.servicio.findUnique`
2. `db.usuario.findFirst`
3. `db.usuario.create` (condicional)
4. `db.disponibilidad.findFirst`
5. `db.franjaHoraria.findFirst` / `create` (condicional)
6. `db.disponibilidad.create` o `db.disponibilidad.update`
7. `db.reserva.create`
8. `db.pago.create`
9. `db.reserva.update`
10. `db.ticketQr.create`

**Problemas detectados:**
1. **Ausencia de `$transaction`:** Si falla el paso 8 o 10 (por ejemplo, timeout en la base de datos o colisión de UUID en `ticketQr`), la disponibilidad ya quedó incrementada y la reserva creada en estado huérfano, sin pago ni boletos asociados.
2. **Sobreventa descontrolada:** En el paso 6:
   ```typescript
   await db.disponibilidad.update({
     where: { id: disponibilidad.id },
     data: { cuposOcupados: { increment: input.cantidadCupos } },
   });
   ```
   **No se verifica si `cuposOcupados + input.cantidadCupos <= cuposTotales`**. Incluso si una cancha tiene capacidad para 4 personas y ya tiene 4 ocupantes, el código incrementa a 5, 6 o más sin límite alguno.
3. **Pérdida de comprobación de mantenimiento:** No se valida `disponibilidad.bloqueadaMantenimiento === true`. Se pueden vender turnos en canchas clausuradas por reparaciones.

#### 5.2 Error Crítico en Resolución de Franjas Horarias — [PERF-02]
En las líneas 86-90 de `route.ts`:
```typescript
let disponibilidad = await db.disponibilidad.findFirst({
  where: {
    servicioId: input.serviceId,
    fecha: new Date(`${input.date}T00:00:00.000Z`),
  },
  include: { franja: true },
});
```
En el modelo Prisma (`schema.prisma`), la unicidad es:
`@@unique([servicioId, franjaId, fecha])`.
Un servicio tiene múltiples franjas a lo largo de un día (ej. 8:00 a. m. - 9:00 a. m., 9:00 a. m. - 10:00 a. m., 6:00 p. m. - 7:00 p. m.).
Al hacer `findFirst` filtrando **únicamente por `servicioId` y `fecha`** sin filtrar por `franjaId` o por el horario `input.slotTime`:
- La consulta siempre recuperará la **primera franja horaria** del día.
- Todas las ventas del día para ese servicio (sea a las 8 a. m. o a las 8 p. m.) se registrarán sobre la misma franja de la mañana, incrementando sus cupos erróneamente mientras las demás franjas quedan vacías en el sistema.
- El parámetro `input.disponibilidadId` presente en el schema Zod es completamente ignorado.

---

### 6. Documentación

#### 6.1 Discrepancias Técnicas — [DOC-01]
- El título del PR y sus comentarios afirman: *"interfaz de punto de venta 100% cashless con Stripe"*, pero en el código no existe ninguna dependencia o llamada a las APIs de Stripe para el cobro en mostrador.
- No se documentaron las restricciones operativas del terminal de taquilla en los manuales de despliegue ni en el `README.md`.
- No hay especificación sobre la impresora térmica de 58mm/80mm recomendada para el comprobante emitido (`window.print()`).

---

## Plan de Acción Detallado para Aprobación

Para que este Pull Request pueda ser reconsiderado y aprobado, el autor debe ejecutar las siguientes fases de remediación:

### Fase 1: Arquitectura de Pagos y Seguridad (Bloqueador Inmediato)
1. **Eliminar el endpoint ad-hoc `apps/web/src/app/api/pos/checkout/route.ts`**.
2. **Reconectar `PosPage` al flujo estándar de TSK-BE-18:**
   - Al seleccionar servicio, fecha y horario, solicitar disponibilidad real mediante `GET /api/bookings?serviceId=...&date=...`.
   - Al presionar cobrar, llamar a `POST /api/bookings` para generar la reserva hold en estado `PENDIENTE_PAGO` con `canal: "TAQUILLA"` y `vendedorId: session.user.id`.
   - Llamar a `POST /api/payments/intent` con el `reservaId` para que el backend cree el `PaymentIntent` oficial de Stripe y devuelva el `clientSecret`.
3. **Integrar Stripe de forma segura en el cliente (Cumplimiento PCI-DSS):**
   - Eliminar los campos planos de número de tarjeta, CVV y expiración de React state.
   - Montar el componente seguro `@stripe/react-stripe-js` (`<Elements>` + `<PaymentElement>`) o integrar con lector Stripe Terminal SDK.
   - Procesar la confirmación con `stripe.confirmPayment({ clientSecret, ... })`.
   - Permitir que el Webhook existente de Stripe (`/api/payments/route.ts`) confirme la reserva y emita el `TicketQr` firmado.
4. **Restaurar el guard de entorno en `apps/web/src/lib/api-auth.ts`:**
   - Reincorporar la comprobación estricta de `process.env.NODE_ENV === "test"` antes de consultar `__scAuthSession` y `__scPrisma` en `globalThis`.

### Fase 2: Lógica de Disponibilidad y Concurrencia
1. **Validación real de Membresía (RN-08):**
   - En el backend, comprobar `db.membresia.findFirst({ where: { usuarioId: cliente.id, estado: "VIGENTE" } })` antes de aplicar cualquier descuento de socio del 30%.
2. **Corrección de Disponibilidad y Cupos:**
   - La selección de horario en el POS debe usar el `disponibilidadId` o `franjaId` exacto.
   - Envolver la creación/actualización en `prisma.$transaction()`.
   - Realizar una verificación atómica de cupos: `WHERE cuposOcupados + cantidad <= cuposTotales` para impedir la sobreventa.

### Fase 3: Contingencia de Pago Alternativo (Riesgo 2 SRS §11.1)
1. **Ajustar `/checkout`:**
   - Permitir que la ruta `/checkout` reciba `?reservaId=...` o `?session_id=...` y recupere del backend la reserva pendiente generada en taquilla, para que el cliente que escanee el QR desde su celular pueda pagar directamente la reserva existente sin requerir `useDraft()` en su navegador.

### Fase 4: Calidad de Código y Pruebas
1. **Desacoplar `pos/page.tsx`:**
   - Dividir el archivo de 908 líneas en submódulos especializados en `pos/components/`.
2. **Implementar pruebas reales de UI:**
   - Crear pruebas con `@testing-library/react` para validar el flujo de UI de `PosPage`, cubriendo escenarios de carga, validación de formularios, selección de servicios y manejo de errores.

---

**Conclusión:** El PR queda en estado **RECHAZADO**. Se solicita al desarrollador no realizar mezclas a `develop` hasta que se implementen las correcciones de la Fase 1 y Fase 2.
