# Especificación del Modelo Analítico y KPIs (RF-21)
> Estado: vigente 2026-10-15

> Ref histórica: TSK-BD-02 · HU-24 (RF-21) · Fase F4 · depende de TSK-BD-06 · responsable: Leonardo
- **Zona Horaria Estándar:** `America/Bogota` (UTC-5)
- **Motor de Base de Datos:** PostgreSQL (Supabase)

---

## 1. Alcance y Objetivos

Este documento formaliza la semántica, trazabilidad de datos, fórmulas matemáticas y vistas SQL analíticas para dar soporte al Dashboard administrativo de **RF-21**. Resuelve de manera estricta la diferenciación técnica y contable entre transacciones comerciales ("vendido") y flujo operativo de acceso ("usado").

---

## 2. Diferenciación Semántica: "Vendido" vs. "Usado"

Para garantizar la integridad métrica y evitar inconsistencias entre ventas y aforo:

### 2.1 Ítem Vendido (Flujo Transaccional / Financiero)
* **Definición:** Ocurre en el momento de la confirmación comercial del servicio mediante pago aprobado o reserva garantizada. Representa la demanda comercial y el ingreso devengado.
* **Entidades de Origen:** `reserva` vinculada a `pago`.
* **Criterio de Inclusión:**
  * `reserva.estado = 'CONFIRMADA'`
  * `pago.estado = 'APROBADO'` (para transacciones monetarias)
* **Marca Temporal de Imputación:** `reserva.creado_en` o `pago.creado_en`.
* **Unidad de Medida:** Cupos vendidos (`reserva.cantidad_cupos`) y Monto facturado (`pago.monto` / `reserva.total`).

### 2.2 Ítem Usado (Flujo Operacional / Afluencia)
* **Definición:** Ocurre en el instante físico de redención del ticket de acceso en los torniquetes o puntos de control mediante lectura de código QR. Representa la capacidad consumida en el recinto.
* **Entidades de Origen:** `ticket_qr` (auditable contra `lectura_acceso`).
* **Criterio de Inclusión:**
  * `ticket_qr.estado = 'USADO'`
  * `ticket_qr.usado_en IS NOT NULL`
* **Marca Temporal de Imputación:** `ticket_qr.usado_en` (marca irreversible según RN-05).
* **Unidad de Medida:** Conteo de accesos consumidos (`COUNT(ticket_qr.id)`).

> **Regla de Negocio:** La fecha y hora de venta **no necesariamente coinciden** con la fecha y hora de uso. Una reserva comprada con días de anticipación imputa ingresos el día de la transacción y afluencia el día de la validación física en puerta.

---

## 3. Manejo y Política de Zona Horaria

La base de datos almacena todas las marcas temporales en formato UTC (`TIMESTAMP WITH TIME ZONE`). Para evitar solapamientos y desfases en los cortes diarios del complejo:

* **Estándar:** `America/Bogota` (UTC-5).
* **Regla de Agrupación:** Toda métrica diaria debe proyectarse explícitamente usando la función de base de datos:
  $$\text{fecha\_corte} = \text{DATE}(columna\_timestamp \text{ AT TIME ZONE 'America/Bogota'})$$

---

## 4. Matriz de Trazabilidad y Fórmulas de los KPIs

| KPI | Semántica / Descripción | Fórmula Matemática | Columnas y Tablas de Origen | Regla Cronológica |
| :--- | :--- | :--- | :--- | :--- |
| **KPI-01: Ingresos por Día** | Suma total del dinero recaudado por pagos aprobados (reservas y membresías). | $$\sum \text{pago.monto}$$ | • `pago.monto`<br>• `pago.creado_en`<br>• `pago.estado` (`APROBADO`)<br>• `pago.tipo` (`RESERVA`, `MEMBRESIA`) | `DATE(pago.creado_en AT TIME ZONE 'America/Bogota')` |
| **KPI-02: Afluencia por Tickets USADO** | Cantidad total de accesos físicos validados exitosamente en las instalaciones y usuarios únicos concurrentes. | • **Afluencia:** $$\text{COUNT}(\text{ticket\_qr.id})$$<br>• **Usuarios Únicos:** $$\text{COUNT}(\text{DISTINCT reserva.titular\_id})$$ | • `ticket_qr.id`<br>• `ticket_qr.estado` (`USADO`)<br>• `ticket_qr.usado_en`<br>• `reserva.titular_id` | `DATE(ticket_qr.usado_en AT TIME ZONE 'America/Bogota')` |
| **KPI-03: Servicios Más Usados vs. Más Vendidos** | Comparación volumétrica entre los cupos reservados/comercializados y la cantidad de tickets redimidos en sitio. | • **Vendidos:** $$\sum \text{reserva.cantidad\_cupos}$$<br>• **Usados:** $$\text{COUNT}(\text{ticket\_qr.id})$$<br>• **Recaudado:** $$\sum \text{reserva.total}$$ | • `reserva.cantidad_cupos`<br>• `ticket_qr.id`<br>• `disponibilidad.servicio_id`<br>• `servicio.id`, `servicio.nombre`, `servicio.modalidad` | Agrupado por `servicio_id`. Imputación cruzada independiente por estados. |
| **KPI-04: Rendimiento por Categoría** | Análisis comercial, volumen de cupos colocados e ingresos generados clasificados por categoría deportiva. | • **Cupos:** $$\sum \text{reserva.cantidad\_cupos}$$<br>• **Ingresos:** $$\sum \text{reserva.total}$$<br>• **Transacciones:** $$\text{COUNT}(\text{DISTINCT reserva.id})$$ | • `categoria_servicio.nombre`, `categoria_servicio.tipo`<br>• `reserva.cantidad_cupos`, `reserva.total`<br>• `reserva.estado` (`CONFIRMADA`) | Imputado al período comercial de la reserva en hora local. |

---

## 5. Implementación de Vistas Analíticas (DDL SQL)

Las siguientes vistas representan la capa de consumo analítico estandarizada para el Dashboard:

```sql
-- =============================================================================
-- VISTA 1: Ingresos Diarios Consolidados
-- =============================================================================
CREATE OR REPLACE VIEW vw_kpi_daily_revenue AS
SELECT 
    DATE(p.creado_en AT TIME ZONE 'America/Bogota') AS fecha_pago,
    p.tipo AS tipo_pago,
    COUNT(p.id) AS total_transacciones,
    SUM(p.monto) AS ingresos_totales
FROM pago p
WHERE p.estado = 'APROBADO'
GROUP BY 1, 2
ORDER BY fecha_pago DESC;

-- =============================================================================
-- VISTA 2: Afluencia Diaria por Tickets Validados (USADO)
-- =============================================================================
CREATE OR REPLACE VIEW vw_kpi_daily_attendance AS
SELECT 
    DATE(t.usado_en AT TIME ZONE 'America/Bogota') AS fecha_uso,
    COUNT(t.id) AS total_afluencia_tickets,
    COUNT(DISTINCT r.titular_id) AS usuarios_unicos_ingresados
FROM ticket_qr t
JOIN reserva r ON t.reserva_id = r.id
WHERE t.estado = 'USADO'
  AND t.usado_en IS NOT NULL
GROUP BY 1
ORDER BY fecha_uso DESC;

-- =============================================================================
-- VISTA 3: Servicios Más Usados vs. Más Vendidos
-- =============================================================================
CREATE OR REPLACE VIEW vw_kpi_services_sold_vs_used AS
WITH ventas AS (
    SELECT 
        d.servicio_id,
        SUM(r.cantidad_cupos) AS cupos_vendidos,
        SUM(r.total) AS total_recaudado
    FROM reserva r
    JOIN disponibilidad d ON r.disponibilidad_id = d.id
    WHERE r.estado = 'CONFIRMADA'
    GROUP BY d.servicio_id
),
usos AS (
    SELECT 
        d.servicio_id,
        COUNT(t.id) AS cupos_usados
    FROM ticket_qr t
    JOIN reserva r ON t.reserva_id = r.id
    JOIN disponibilidad d ON r.disponibilidad_id = d.id
    WHERE t.estado = 'USADO'
    GROUP BY d.servicio_id
)
SELECT 
    s.id AS servicio_id,
    s.nombre AS servicio_nombre,
    s.modalidad,
    COALESCE(v.cupos_vendidos, 0) AS total_vendidos,
    COALESCE(u.cupos_usados, 0) AS total_usados,
    COALESCE(v.total_recaudado, 0.00) AS total_recaudado
FROM servicio s
LEFT JOIN ventas v ON s.id = v.servicio_id
LEFT JOIN usos u ON s.id = u.servicio_id
ORDER BY total_vendidos DESC;

-- =============================================================================
-- VISTA 4: Rendimiento Comercial por Categoría
-- =============================================================================
CREATE OR REPLACE VIEW vw_kpi_category_performance AS
SELECT 
    cs.id AS categoria_id,
    cs.nombre AS categoria_nombre,
    cs.tipo AS categoria_tipo,
    COUNT(DISTINCT r.id) AS total_reservas,
    COALESCE(SUM(r.cantidad_cupos), 0) AS total_cupos_vendidos,
    COALESCE(SUM(r.total), 0.00) AS total_ingresos
FROM categoria_servicio cs
JOIN servicio s ON cs.id = s.categoria_id
JOIN disponibilidad d ON s.id = d.servicio_id
JOIN reserva r ON d.id = r.disponibilidad_id AND r.estado = 'CONFIRMADA'
GROUP BY cs.id, cs.nombre, cs.tipo
ORDER BY total_ingresos DESC;
