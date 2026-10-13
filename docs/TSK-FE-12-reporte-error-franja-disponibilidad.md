# Reporte Técnico: Diagnóstico de Error en Selección Múltiple y Checkout Conjunto (TSK-FE-12)

**Fecha:** 11 de octubre de 2026  
**Módulos Afectados:** Frontend (`apps/web`), Backend (`packages/db`), Base de Datos (`PostgreSQL/Prisma`)  
**Tareas Asociadas:**
- `TSK-FE-12`: Selección múltiple de servicios en la misma franja (HU-12 / RF-11).
- `TSK-BE-12`: Regla de concurrencia y no-solapamiento de reservas de titular (RN-07).
- `TSK-BE-12b` (SCRUM-163): Endpoint transaccional multi-reserva y sesión Stripe (`POST /api/bookings/lock-cart`).

---

## 1. Descripción del Problema Detectado

Durante las pruebas de usuario en la pantalla de reservas (`/portal/book`):
1. El usuario selecciona una fecha y una franja horaria (ej. `2026-10-12`, de `17:00` a `18:00`).
2. Agrega al carrito dos o más servicios distintos (ej. *Piscina · Nado libre* y *Cancha de tenis · Cancha 1*).
3. Abre el modal de revisión y pulsa el botón **"Pagar reservas juntas"**.
4. La aplicación arroja el siguiente error visual en el modal:
   > **`Ítem 1 (servicio 1): la franja solicitada no existe.`**

---

## 2. Análisis Causa-Raíz (RCA)

El error ocurre por una discrepancia entre la vista del cliente y los datos reales en persistencia:

```
[Frontend: book/page.tsx]
      │ Envía { items: [{ serviceId: 1, startTime: "...", endTime: "..." }] }
      ▼
[API: POST /api/bookings/lock-cart]
      │ Inicia transacción atómica createBookingHoldCart()
      ▼
[Database Query: tx.disponibilidad.findMany(...)]
      │ Busca coincidencia de servicioId + fecha + franja horaria
      ▼
[Resultado: 0 registros encontrados]
      │ Lanza BookingError("SLOT_NOT_FOUND", 404)
      ▼
Respuesta HTTP 404: "Ítem 1 (servicio 1): la franja solicitada no existe."
```

### Hallazgos Específicos:
1. **La base de datos relacional no tiene sembradas las franjas ni los servicios:**
   - El archivo de seed actual (`packages/db/prisma/seed.ts`) únicamente crea los 4 Roles (`ADMIN`, `VENDEDOR`, `LECTOR`, `CLIENTE`) y los 3 Planes de Membresía.
   - Las tablas `categoria_servicio`, `servicio`, `franja_horaria` y `disponibilidad` se encuentran vacías en el entorno local.
2. **El Frontend tiene horarios preconfigurados estáticos:**
   - En `apps/web/src/app/(customer)/portal/book/page.tsx`, la lista `timeSlots` contiene valores quemados en código (`09:00 - 10:00`, `10:00 - 11:00`, `17:00 - 18:00`), sin verificar previamente si el backend cuenta con registros para esas franjas en la fecha elegida.

---

## 3. Matriz de Responsabilidades

| Componente | Capa | Responsabilidad | Diagnóstico Actual |
|---|---|---|---|
| **Base de Datos / Backend** | `packages/db` | **60%** (Provisión de Datos) | **Incompleto:** Falta un script de seed que pueble las tablas de servicios, franjas horarias y disponibilidades de los 15 días reglamentarios. El código de validación transaccional (`createBookingHoldCart`) funciona según lo especificado. |
| **Integración Frontend** | `apps/web` | **40%** (Consumo Dinámico) | **Parcialmente Desconectado:** La vista envía correctamente el payload hacia `POST /api/bookings/lock-cart`, pero los botones de horas (`timeSlots`) están fijos y no consultan la disponibilidad real (`GET /api/bookings?serviceId=...&date=...`). |

---

## 4. Estado de la Conexión Frontend-Backend

La arquitectura de conexión entre `TSK-FE-12` y `TSK-BE-12b` **es correcta y cumple los contratos de la plataforma**:

- **Contrato de esquema Zod:** Cumple con `cartCheckoutSchema` en `packages/validation/src/booking.schema.ts` (fechas ISO UTC válidas, cantidad mínima de 2 ítems, tipos numéricos correctos).
- **Enrutamiento:** Conmuta automáticamente entre `POST /api/bookings/lock` (reserva única) y `POST /api/bookings/lock-cart` (carrito multi-servicio).
- **Manejo de Stripe:** Espera y captura `data.checkout.url` para redirigir a la pasarela de pagos.
- **Manejo de Errores:** Extrae e imprime strings legibles de error evitando fallas de renderizado en React.

---

## 5. Plan de Acción y Solución

Para solucionar el problema de raíz y dejar la funcionalidad operativa de extremo a extremo:

### Paso 1: Backend / Persistencia (Sembrado de Datos)
1. Extender `packages/db/prisma/seed.ts` para crear:
   - Categorías (`CANCHA`, `PISCINA`, `GIMNASIO`, `ZONA_HUMEDA`).
   - Instancias de servicios del catálogo (`Cancha de tenis 1`, `Cancha de tenis 2`, `Piscina libre`, etc.).
   - Franjas horarias diarias (`franja_horaria`) en intervalos de 1 hora entre `06:00` y `22:00`.
   - Generación de disponibilidades (`disponibilidad`) para los próximos 15 días (ventana máxima RN-01).
2. Ejecutar `pnpm --filter @sportcomplex/db db:seed`.

### Paso 2: Frontend (Consumo Dinámico de Franjas)
1. En `/portal/book/page.tsx`, reemplazar la lista fija `timeSlots` por una consulta reactiva a la disponibilidad real o a las franjas configuradas en `@sportcomplex/core`.
2. Habilitar la selección en el carrito únicamente para aquellas combinaciones que tengan cupo disponible en la fecha seleccionada.

---
*Reporte generado como artefacto de auditoría para el equipo de desarrollo SportComplex.*
