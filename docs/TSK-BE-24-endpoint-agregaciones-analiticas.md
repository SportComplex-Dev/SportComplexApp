# TSK-BE-24 — Endpoint de agregaciones analíticas

> Historia de Usuario: `HU-24` (RF-21) · Fase: F4 · Microcelda / Componente: Backend  
> Jira: `SCRUM-149` · Depende de: `TSK-BD-02`, `TSK-BD-05`, `TSK-BD-03`  
> Responsable: Jose Romero · Rama: `feature/tsk-be-24-endpoint-de-agregaciones-analíticas`

---

## 1. Alcance Técnico Implementado

Se implementó el endpoint administrativo de agregaciones analíticas gerenciales:

```http
GET /api/admin/analytics
```

### 1.1. Seguridad y RBAC Perimetral
- Protegido a nivel perimetral en `apps/web/src/middleware.ts` para rutas `/api/admin/*`.
- Exige sesión activa y rol canónico `Administrador`. Peticiones no autenticadas devuelven `HTTP 401 (UNAUTHORIZED)` y peticiones de otros roles devuelven `HTTP 403 (FORBIDDEN)`.

### 1.2. Parámetros de Consulta Soportados
Consultas parametrizadas por fecha y normalizadas bajo la zona horaria legal de Colombia `America/Bogota` (UTC-5, RNF-02):

| Parámetro | Tipo | Descripción | Por defecto |
| --- | --- | --- | --- |
| `startDate` / `from` / `fechaInicio` | `string` (YYYY-MM-DD) | Límite inferior de fecha inclusivo en horario Bogotá | `undefined` (todo el histórico) |
| `endDate` / `to` / `fechaFin` | `string` (YYYY-MM-DD) | Límite superior de fecha inclusivo en horario Bogotá | `undefined` (todo el histórico) |
| `period` / `periodo` | `"daily"` \| `"weekly"` \| `"diario"` \| `"semanal"` | Nivel de agrupación del desglose temporal (`items`) | `"daily"` |

### 1.3. Validación Contractual (Zod)
- Validado mediante `analyticsQuerySchema` en `@sportcomplex/validation`.
- Rechaza formatos de fecha no estándar (`YYYY-MM-DD`) con `HTTP 400 (VALIDATION_ERROR)`.
- Valida que `startDate <= endDate`. Si `startDate > endDate`, rechaza con `HTTP 400` y el mensaje descriptivo:
  > *"La fecha inicial (startDate) no puede ser posterior a la fecha final (endDate)"*

---

## 2. Soporte en el Modelo Analítico de Base de Datos (PostgreSQL)

El repositorio `@sportcomplex/db` (`getAnalytics`) se apoya directamente en las vistas analíticas creadas en la base de datos (TSK-BD-02 / TSK-BD-05):

1. **`vw_kpi_daily_attendance`**:
   - Conteo de tiquetes en estado `USADO` (`total_afluencia_tickets`) y usuarios únicos ingresados (`usuarios_unicos_ingresados`) por fecha en `America/Bogota`.
2. **`vw_kpi_daily_revenue`**:
   - Ingresos brutos recaudados (`ingresos_totales`) y transacciones aprobadas (`total_transacciones`) por fecha en `America/Bogota` y por tipo de pago (`RESERVA` o `MEMBRESIA`).
3. **`vw_kpi_category_performance`**:
   - Total de reservas confirmadas, cupos deportivos vendidos e ingresos monetarios por categoría de servicio (`CANCHA`, `PISCINA`, `GIMNASIO`, `ZONA_HUMEDA`).
4. **`vw_kpi_services_sold_vs_used`**:
   - Comparativa de los servicios más demandados (`total_vendidos`), más utilizados en puerta (`total_usados`) y más recaudados (`total_recaudado`).

Cuando se aplican filtros de fecha, las consultas se ejecutan con parámetros tipados `$1` y `$2` con ordenamiento cronológico y empuje de predicados (`WHERE ... BETWEEN ...`).

---

## 3. Criterio de Aceptación Clave

> **Criterio contractual:** El endpoint responde en `< 2 s` sobre el dataset de `TSK-BD-03` y sus cifras cuadran contra un `COUNT` directo sobre la tabla transaccional.

### 3.1. Rendimiento (< 2 s)
- Ejecutado de forma concurrente con `Promise.all` sobre el pool de conexiones de Supabase/PostgreSQL.
- **Tiempo medido en frío:** ~1.3 s a 1.4 s.
- **Tiempo medido en caliente:** ~700 ms.
- Cumple holgadamente el criterio de `< 2.0 s` exigido en SCRUM-149.

### 3.2. Verificación de Consistencia contra Tablas Transaccionales
Validado matemáticamente en `packages/db/src/repositories/analytics.test.ts`:

| Métrica | Valor Agregado por Endpoint | `COUNT` / `SUM` Directo Transaccional | Estado |
| --- | :---: | :---: | :---: |
| **Afluencia Total (Tickets USADOS)** | `27` | `COUNT(*) FROM ticket_qr WHERE estado = 'USADO' AND usado_en IS NOT NULL` → `27` | Exacto (100%) |
| **Volumen de Transacciones de Ventas** | `51` | `COUNT(*) FROM pago WHERE estado = 'APROBADO'` → `51` | Exacto (100%) |
| **Recaudación Monetaria Bruta** | `$1,160,650.00` | `SUM(monto) FROM pago WHERE estado = 'APROBADO'` → `1160650.00` | Exacto (100%) |
| **Reservas Confirmadas** | `51` | `COUNT(*) FROM reserva WHERE estado = 'CONFIRMADA'` → `51` | Exacto (100%) |
| **Cupos Deportivos Vendidos** | `51` | `SUM(cantidad_cupos) FROM reserva WHERE estado = 'CONFIRMADA'` → `51` | Exacto (100%) |

---

## 4. Estructura de Respuesta del Endpoint

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAttendance": 27,
      "totalTransactions": 51,
      "totalRevenue": 1160650,
      "uniqueAttendees": 27,
      "totalBookings": 51,
      "spotsSold": 51
    },
    "attendance": [
      {
        "date": "2026-10-01",
        "ticketsUsed": 3,
        "uniqueUsers": 3
      }
    ],
    "revenue": [
      {
        "date": "2026-09-29",
        "paymentType": "RESERVA",
        "transactions": 4,
        "totalAmount": 100100
      }
    ],
    "periodBreakdown": {
      "period": "daily",
      "items": [
        {
          "periodKey": "2026-10-01",
          "periodLabel": "2026-10-01",
          "attendance": 3,
          "transactions": 5,
          "revenue": 105050
        }
      ]
    },
    "categoryPerformance": [
      {
        "categoryId": 1,
        "categoryName": "Canchas",
        "categoryType": "CANCHA",
        "totalBookings": 21,
        "totalSpotsSold": 21,
        "totalRevenue": 420650,
        "revenuePercentage": 36.24
      }
    ],
    "servicesComparison": [
      {
        "serviceId": 1,
        "serviceName": "Cancha de Fútbol 5",
        "modality": "EXCLUSIVA",
        "totalSold": 13,
        "totalUsed": 9,
        "totalRevenue": 650
      }
    ],
    "filters": {
      "startDate": null,
      "endDate": null,
      "period": "daily",
      "timezone": "America/Bogota"
    }
  },
  "timestamp": "2026-10-08T21:10:00.000Z"
}
```

---

## 5. Archivos Creados y Modificados

1. **`packages/validation/src/analytics.schema.ts`**: Esquema Zod de validación y normalización de parámetros para analytics.
2. **`packages/validation/src/index.ts`**: Re-export de esquemas analíticos.
3. **`packages/validation/test/analytics.schema.test.ts`**: Pruebas unitarias de esquemas y validaciones de fechas/periodos.
4. **`packages/core/src/domain/analytics.ts`**: Definición agnóstica de tipos e interfaces de dominio para analítica.
5. **`packages/core/src/domain/index.ts`**: Re-export de los tipos de dominio analítico.
6. **`packages/db/src/repositories/analytics.ts`**: Repositorio `getAnalytics` con soporte para consultas PostgreSQL sobre las 4 vistas analíticas y fallback/mocking en memoria para pruebas.
7. **`packages/db/src/index.ts`**: Exportación pública del repositorio analítico en `@sportcomplex/db`.
8. **`packages/db/src/repositories/analytics.test.ts`**: Pruebas unitarias y prueba de integración sobre BD real validando el criterio clave (< 2 s y cuadre contra `COUNT` directo).
9. **`apps/web/src/app/api/admin/analytics/route.ts`**: Ruta API `GET /api/admin/analytics` de Next.js App Router con manejo seguro de errores y respuestas estandarizadas.
10. **`apps/web/src/app/api/admin/analytics/__tests__/route.test.ts`**: Pruebas de integración de la ruta API comprobando validaciones 400 y formato 200.
