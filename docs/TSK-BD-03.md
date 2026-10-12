# Dataset Semilla Realista y Control de Calidad

- **Tarea ID:** TSK-BD-03
- **Historia de Usuario:** Transversal (F0)
- **Story Points:** 5 pts
- **Responsable:** Leonardo
- **Microcelda / Componente:** Database & Analytics
- **Depende de:** TSK-BD-06
- **Entorno / Motor:** PostgreSQL (Supabase)
- **Zona Horaria Estándar:** `America/Bogota` (UTC-5)

---

## 1. Alcance y Objetivos

Generar un ecosistema de datos de prueba con volumen y distribución operacional realista para validar el modelo relacional (DER), soportar pruebas de concurrencia y analítica (RF-21), y garantizar que las invariantes de negocio se cumplan mediante una suite automatizada de control de calidad (Sanity Checks).

---

## 2. Composición y Distribución del Dataset

El conjunto de datos inyectado abarca todas las entidades requeridas en el DER de SportComplex:

* **Usuarios y Roles:**
  * Personal administrativo y operativo: Roles `ADMIN`, `VENDEDOR` y `LECTOR` con credenciales de prueba y avatares por URL.
  * Usuarios clientes: 50+ perfiles de clientes activos con avatares dinámicos asignados por URL.
* **Catálogo y Disponibilidad:**
  * Franjas horarias distribuidas de lunes a domingo en bloques continuos (07:00 a 22:00) por servicio deportivo.
  * Generación de slots en `disponibilidad` en una ventana temporal de 15 días (últimos 7 días hasta próximos 7 días).
* **Membresías:**
  * Planes de membresía activa (`Plan Gold Mensual`, `Plan VIP Anual`) vinculados a identificadores recurrentes de Stripe.
  * Clientes suscritos en estado `VIGENTE` habilitados para la regla de descuento del 30% (RN-08).
* **Ciclo de Vida de Reservas y Pagos:**
  * **70% Reservas CONFIRMADAS:** Con pagos en estado `APROBADO`, monto asignado y generación de tickets únicos.
  * **20% Reservas EXPIRADAS:** Simulación de abandono de checkout para alimentar métricas de embudo de compra (`TSK-BD-04`).
  * **10% Reservas PENDIENTE_PAGO:** En ventana de TTL activo (30 minutos) para pruebas de bloqueo pesimista y reservas concurrentes.
* **Control de Acceso y Afluencia:**
  * Segmentación entre tickets en estado `EMITIDO` (pendientes de redención) y `USADO`.
  * Tickets consumidos vinculados a marcas temporales en `ticket_qr.usado_en` y auditoría en `lectura_acceso` con resultado `CONCEDIDO`.

---

## 3. Matriz de Resultados del Control de Calidad (Sanity Checks)

Se ejecutó la suite de validación sobre el total de registros en la base de datos arrojando **cero discrepancias**:

| # | Regla de Control de Integridad / Invariante | Condición de Fallo Evaluada | Fallos Detectados | Estado |
| :-: | :--- | :--- | :-: | :-: |
| **1** | Aforo e invariante de aforo (RNF-01) | `cupos_ocupados < 0` o `cupos_ocupados > cupos_totales` | **0** | **PASS** |
| **2** | Consistencia de reservas activas | `cupos_ocupados <> SUM(reserva.cantidad_cupos)` | **0** | **PASS** |
| **3** | Integridad de tickets consumidos | `estado = 'USADO'` y `usado_en IS NULL` | **0** | **PASS** |
| **4** | Integridad de tickets emitidos | `estado = 'EMITIDO'` y `usado_en IS NOT NULL` | **0** | **PASS** |
| **5** | Coherencia transaccional de pagos | `reserva = 'CONFIRMADA'` sin pago asociado `APROBADO` | **0** | **PASS** |
| **6** | Integridad referencial de accesos | Registros en `lectura_acceso` sin ticket o sin empleado | **0** | **PASS** |
| **7** | Completitud de perfiles | Filas en `usuario` con campo `avatar` nulo | **0** | **PASS** |

---

## 4. Query de Verificación y Auditoría Reproducible

```sql
SELECT 
    '1. Cupos ocupados fuera de rango (< 0 o > cupos_totales)' AS regla_control,
    COUNT(*) AS fallos
FROM disponibilidad
WHERE cupos_ocupados < 0 OR cupos_ocupados > cupos_totales

UNION ALL

SELECT 
    '2. Inconsistencia entre cupos_ocupados y suma de reservas activas',
    COUNT(*)
FROM (
    SELECT 
        d.id, 
        d.cupos_ocupados, 
        COALESCE(SUM(r.cantidad_cupos), 0) AS suma_calculada
    FROM disponibilidad d
    LEFT JOIN reserva r ON d.id = r.disponibilidad_id AND r.estado IN ('CONFIRMADA'::"EstadoReserva", 'PENDIENTE_PAGO'::"EstadoReserva")
    GROUP BY d.id, d.cupos_ocupados
    HAVING d.cupos_ocupados <> COALESCE(SUM(r.cantidad_cupos), 0)
) diff

UNION ALL

SELECT 
    '3. Tickets en USADO sin fecha de uso (usado_en IS NULL)',
    COUNT(*)
FROM ticket_qr
WHERE estado = 'USADO'::"EstadoTicket" AND usado_en IS NULL

UNION ALL

SELECT 
    '4. Tickets en EMITIDO con fecha de uso indebida (usado_en IS NOT NULL)',
    COUNT(*)
FROM ticket_qr
WHERE estado = 'EMITIDO'::"EstadoTicket" AND usado_en IS NOT NULL

UNION ALL

SELECT 
    '5. Reservas CONFIRMADAS sin pago aprobado o sin pago vinculado',
    COUNT(*)
FROM reserva r
LEFT JOIN pago p ON r.pago_id = p.id
WHERE r.estado = 'CONFIRMADA'::"EstadoReserva" AND (p.id IS NULL OR p.estado <> 'APROBADO'::"EstadoPago")

UNION ALL

SELECT 
    '6. Lecturas de acceso huérfanas (sin ticket o sin empleado)',
    COUNT(*)
FROM lectura_acceso l
LEFT JOIN ticket_qr t ON l.ticket_id = t.id
LEFT JOIN usuario u ON l.empleado_id = u.id
WHERE t.id IS NULL OR u.id IS NULL

UNION ALL

SELECT 
    '7. Usuarios con avatar nulo',
    COUNT(*)
FROM usuario
WHERE avatar IS NULL;