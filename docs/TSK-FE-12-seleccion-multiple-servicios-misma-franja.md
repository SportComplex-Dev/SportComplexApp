# TSK-FE-12: Selección Múltiple de Servicios en la Misma Franja

## 1. Trazabilidad y Requerimientos de Negocio
- **Identificador de Tarea:** `TSK-FE-12` (SCRUM Frontend / Monorepo `apps/web`)
- **Historia de Usuario:** `HU-12` — Reserva concurrente de múltiples servicios e instalaciones.
- **Requerimiento Funcional:** `RF-11` — Carrito y checkout consolidado para servicios concurrentes.
- **Regla de Negocio:** `RN-07` — Multirreserva concurrente:
  > *El titular puede reservar múltiples servicios para la misma fecha y bloque horario `[HoraInicio, HoraFin]` siempre que correspondan a servicios o instalaciones diferentes (ej. Cancha Sintética 1 + Piscina Libre de 17:00 a 18:00). El sistema permite agregar estos ítems al carrito sin generar bloqueos locales ni solapamientos artificiales sobre el mismo usuario para servicios distintos.*

---

## 2. Alcance Técnico Resuelto y Eliminación de Franjas Quemadas
1. **Eliminación de Franjas Quemadas / Estáticas:**
   - Previamente, la interfaz contaba con franjas fijas en código (ej. `["09:00", "10:00", "17:00"]`), limitando la operatividad.
   - Se implementó un generador dinámico reactivo (`generateDynamicTimeSlots` en `cart-utils.ts`) que produce franjas horarias operativas continuas de 60 minutos entre las 06:00 y las 22:00, ajustadas a la zona horaria legal de Colombia (`America/Bogota`).
   - Se respeta estrictamente la regla `RN-11` (prohibición de reservas en horas transcurridas si la fecha elegida es el día actual).
   - El selector de fecha respeta la ventana máxima de 15 días calendario (`RN-01`).

2. **Validación del Carrito Multi-servicio (`RN-07`):**
   - **Permite servicios concurrentes:** Dos servicios distintos (con diferente `serviceId`) pueden agregarse para la misma fecha y franja horaria.
   - **Previene duplicados exactos:** Si el usuario intenta agregar el mismo servicio para la misma fecha y hora, se bloquea la acción con mensaje accesible indicando que ya se encuentra en el carrito (`DUPLICATE_ITEM`).
   - **Consistencia horaria:** Para ser pagados juntos en una única transacción atómica, todos los servicios del carrito deben pertenecer a la misma fecha y franja horaria (`DIFFERENT_SLOT`).

3. **Arquitectura de Componentes Modulares:**
   - `cart-utils.ts`: Lógica pura de validación, generación dinámica de horarios, formateo monetario y construcción de payloads tipados.
   - `ServiceSelector`: Selector accesible de fechas y franjas horarias con filtrado por categoría y catálogo reactivo.
   - `Cart`: Resumen visual de la selección con badges de horario por servicio (`Badge` de `@sportcomplex/ui`), botón de eliminación individual, vaciado total y cálculo del total acumulado.
   - `BookingSummaryModal`: Diálogo modal de revisión (`role="dialog"`, `aria-modal="true"`) que consolida los ítems a bloquear juntos, presenta alertas de error accesibles (`role="alert"`) y dispara el checkout atómico.

---

## 3. Contrato Consumido con el Backend y Flujo de Checkout
1. **Endpoint Atómico (`TSK-BE-12b` / `POST /api/bookings/lock-cart`):**
   - Cuando el carrito contiene 2 o más servicios, el frontend envía la solicitud al endpoint consolidado `POST /api/bookings/lock-cart`.
   - Cuando contiene un único servicio, se deriva a `POST /api/bookings/lock`.
   - **Formato del Payload:** Cumple con el esquema Zod `cartCheckoutSchema` de `@sportcomplex/validation`:
     ```json
     {
       "items": [
         {
           "serviceId": 1,
           "date": "2026-10-15",
           "startTime": "2026-10-15T22:00:00.000Z",
           "endTime": "2026-10-15T23:00:00.000Z",
           "cantidadCupos": 1
         },
         {
           "serviceId": 6,
           "date": "2026-10-15",
           "startTime": "2026-10-15T22:00:00.000Z",
           "endTime": "2026-10-15T23:00:00.000Z",
           "cantidadCupos": 1
         }
       ]
     }
     ```

2. **Flujo de Respuesta Exitosa (`HTTP 201 Created`):**
   - El backend devuelve las reservas creadas en estado `PENDIENTE_PAGO` con TTL común de 30 minutos y los datos de la sesión de Stripe Checkout.
   - El frontend extrae los identificadores de reserva y redirige a la URL de checkout correspondiente:
     * Si `checkout.url` es devuelto por la pasarela, se procesa la redirección.
     * Alternativamente, redirige a `/checkout?bookingIds=id1,id2...&bookingId=id1`.

3. **Manejo Defensivo de Errores:**
   - **`404` / `SLOT_NOT_FOUND`:** Se intercepta la respuesta y se despliega una alerta accesible (`role="alert"`, `aria-live="assertive"`) indicando con precisión que la franja solicitada no existe o agotó cupos en uno de los servicios.
   - **`409` / `CONFLICT` / `OVERLAPPING_BOOKING`:** Se recarga automáticamente la disponibilidad dinámica y se alerta al usuario para que seleccione un nuevo turno.
   - **`401` / No autenticado:** Redirección automática a `/login?redirect=/portal/book`.

---

## 4. Archivos Creados y Modificados
- `apps/web/src/app/(customer)/portal/book/cart-utils.ts`: Lógica pura de carrito, cálculo de totales, generador de slots y constructores de payload.
- `apps/web/src/app/(customer)/portal/book/components/service-selector.tsx`: Componente selector dinámico de franjas y catálogo.
- `apps/web/src/app/(customer)/portal/book/components/cart.tsx`: Componente de carrito reactivo con badges y total acumulado.
- `apps/web/src/app/(customer)/portal/book/components/booking-summary-modal.tsx`: Modal accesible de confirmación multi-servicio.
- `apps/web/src/app/(customer)/portal/book/page.tsx`: Coordinador del portal de reservas con integración completa de endpoints.
- `apps/web/package.json`: Soporte para ejecutar archivos `.test.tsx` en el comando `test`.
- `apps/web/src/app/(customer)/portal/book/__tests__/multi-service-cart.test.tsx`: Suite completa de pruebas automatizadas.
- `docs/TSK-FE-12-seleccion-multiple-servicios-misma-franja.md`: Esta documentación técnica exclusiva.

---

## 5. Pruebas Automatizadas Ejecutadas
La suite en `multi-service-cart.test.tsx` verifica:
1. **Test 1 (`RN-07`):** Permite agregar dos servicios distintos en el mismo rango horario (ej. Cancha 1 y Piscina de 17:00 a 18:00) al carrito, impidiendo duplicados idénticos y franjas dispares.
2. **Test 2:** Muestra el total consolidado exacto de ambos servicios y renderiza los badges visuales de franja horaria y botones accesibles de eliminación en el carrito.
3. **Test 3:** Construye y despacha el payload multi-ítem con fechas ISO a `POST /api/bookings/lock-cart` y procesa la redirección a `/checkout`.
4. **Test 4:** Maneja defensivamente los errores `404 / SLOT_NOT_FOUND` y `409 / CONFLICT` con roles accesibles (`role="alert"`) sin degradar ni romper el renderizado del componente.

---

## 6. Verificación de Calidad
- **Pruebas Unitarias:** 248 tests ejecutados en `apps/web`, 100% exitosos (`pnpm --filter web test`).
- **Verificación de Tipos:** `pnpm run typecheck` completado con cero errores en todo el workspace.
- **Linter:** `pnpm run lint` (`turbo run lint`) completado con 100% de cumplimiento en los paquetes aplicables.

