# TSK-FE-23: Dashboard Gerencial y Analítica de Alta Densidad

## 1. Identificación y Alcance
- **Ticket Jira:** TSK-FE-23 / SCRUM-148 (Requerimientos RNF-04 / RF-18)
- **Módulo:** Panel de Analítica Gerencial (`/admin/dashboard`)
- **Objetivo:** Panel de control para directores y administradores que consolida los 4 Indicadores Clave de Desempeño (KPIs), tendencias de asistencia en puerta (tickets `USADO`), facturación recaudada en Stripe, desglose por categorías deportivas y exportación real a formato CSV.

---

## 2. Arquitectura de Componentes (Modularización ARC-01)
El panel fue descompuesto modularmente en subcomponentes especializados bajo `apps/web/src/components/admin/dashboard/`:

1. **`AdminDashboardPage` (`apps/web/src/app/(admin)/admin/dashboard/page.tsx`):**
   - Controlador de estado del dashboard (filtros de temporalidad diaria/semanal, rangos predefinidos de 7d / 30d / personalizado).
   - Zona horaria de Bogotá (`America/Bogota`) para evitar desfases de fechas `endDate` off-by-one (`COD-02`).
   - Manejo de error de conexión sin fallbacks silenciosos a datos inventados (`SEC-01`).
2. **`DashboardKPIs` (`dashboard-kpis.tsx`):**
   - Los 4 KPIs primarios:
     - **Recaudación Total (Stripe):** Facturación monetaria neta del periodo seleccionado.
     - **Afluencia Perimetral:** Total de tiquetes validados en torniquetes y puestos de control con desglose de usuarios únicos.
     - **Demanda y Ocupación:** Total de cupos deportivos adquiridos y reservas procesadas.
     - **Deporte / Categoría Líder:** Categoría de mayor demanda con su porcentaje de recaudación; fallback neutro `'—'` en caso de ausencia de datos (`NEW-01`).
3. **`DashboardCharts` (`dashboard-charts.tsx`):**
   - Gráficos SVG interactivos:
     - Curva temporal de afluencia de accesos por día o semana.
     - Barras proporcionales de recaudación financiera sin alturas forzadas en cero (`UI-03`), reflejando verazmente días sin actividad.
4. **`DashboardTables` (`dashboard-tables.tsx`):**
   - Rendimiento por categoría deportiva (reservas, cupos, ingresos y porcentaje de participación).
   - Comparativa de servicios más vendidos vs más utilizados en puerta perimetral.
   - **Exportación CSV Real (`UI-01`):** Genera y descarga directamente en el cliente un archivo `informe-gerencial-[fecha].csv` con las cabeceras y métricas detalladas del periodo.

---

## 3. Integración con Backend
- Consume el endpoint analítico `/api/admin/analytics?period=[daily|weekly]&startDate=[Y-m-d]&endDate=[Y-m-d]`.
- Respeta estrictamente los principios de fail-fast y zero mock data en entornos operativos.

---

## 4. Pruebas y Validación
- Pruebas frontend de cálculo de KPIs, formateo de métricas y exportación CSV en `apps/web/src/app/(admin)/admin/dashboard/__tests__/dashboard-ui.test.ts`.
