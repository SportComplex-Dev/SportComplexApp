# Análisis de Ocupación, Demanda y Recomendaciones Tarifarias

- **Tarea ID:** TSK-BD-04
- **Historias de Usuario:** HU-05, HU-24 (RF-04, RF-21)
- **Fase:** F4
- **Story Points:** 5 pts
- **Responsable:** Leonardo
- **Microcelda / Componente:** Database & Analytics
- **Depende de:** TSK-BD-03
- **Destino:** Parámetros de configuración para `TSK-BE-05`
- **Zona Horaria:** `America/Bogota` (UTC-5)

---

## 1. Resumen Ejecutivo y Métricas Cuantitativas

El presente análisis se fundamenta en los datos del entorno analítico de SportComplex para evaluar la demanda real, cuellos de botella en aforo, comportamiento del checkout y penetración del programa de suscripciones.

### 1.1 Tasa de Ocupación por Servicio y Modalidad

| Servicio ID | Servicio | Modalidad | Tarifa Actual | Cupos Ofertados | Cupos Ocupados | Tasa de Ocupación (%) |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | Cancha de Fútbol 5 | EXCLUSIVA | $50.00 | 114 | 17 | **14.91%** |
| 2 | Cancha Sintética de Fútbol 5 | EXCLUSIVA | $60,000.00 | 90 | 5 | **5.56%** |
| 3 | Cancha de Tenis Polvo de Ladrillo | EXCLUSIVA | $45,000.00 | 90 | 4 | **4.44%** |
| 6 | Zona Húmeda Spa & Sauna | AFORO | $30,000.00 | 1,350 | 9 | **0.67%** |
| 4 | Piscina Semiolímpica Climatizada | AFORO | $25,000.00 | 2,260 | 10 | **0.44%** |
| 5 | Gimnasio y Musculación Libre | AFORO | $20,000.00 | 3,150 | 12 | **0.38%** |

### 1.2 Identificación de Horas Pico vs. Horas Valle

| Franja Horaria | Cupos Ofertados | Cupos Reservados | Ocupación Promedio (%) | Clasificación de Demanda |
| :---: | :---: | :---: | :---: | :---: |
| 07:00:00 - 08:30:00 | 1,095 | 8 | 0.73% | HORA VALLE |
| 08:00:00 - 09:00:00 | 472 | 4 | 0.85% | HORA VALLE |
| 08:30:00 - 10:00:00 | 1,095 | 8 | 0.73% | HORA VALLE |
| 16:00:00 - 17:30:00 | 1,095 | 3 | 0.27% | HORA VALLE |
| 17:30:00 - 19:00:00 | 1,095 | 10 | 0.91% | HORA VALLE |
| 19:00:00 - 20:00:00 | 12 | 5 | **41.67%** | **DEMANDA MEDIA-ALTA** |
| 19:00:00 - 20:30:00 | 1,095 | 8 | 0.73% | HORA VALLE |
| 20:30:00 - 22:00:00 | 1,095 | 11 | 1.00% | HORA VALLE (Alta afluencia canchas) |

### 1.3 Embudo de Conversión y Abandono de Checkout (TTL)

* **Total intenciones de reserva:** 77
* **Reservas Confirmadas (Pagadas):** 51 (66.23%)
* **Reservas Expiradas (Abandono):** 20 (**25.97%**)
* **Reservas en Proceso TTL (30 min):** 6 (7.79%)

### 1.4 Desempeño y Penetración del Programa de Membresías

* **Plan Mensual Estándar ($180.00):** 14 suscriptores activos, **22.95% de penetración**, generando $2,520.00 de MRR.
* **VIP Mensual ($100.00):** 1 suscriptor (1.64%).
* **Planes Anuales:** 0% de penetración. Evidencia resistencia al pago diferido anual o costo elevado de entrada.

---

## 2. Recomendaciones de Negocio y Parametrización para TSK-BE-05

Con base en la evidencia matemática reproducida del dataset, se establecen las siguientes decisiones de parametrización para el backend:

### 2.1 Estrategia de Tarifas Dinámicas (Peak / Off-Peak Pricing)
* **Recargo en Horas Pico (18:00 - 22:00):** Aplicar un incremento del **15% al 20%** sobre la tarifa base de canchas sintéticas y tenis en días laborables, mitigando la saturación nocturna y maximizando el ticket promedio.
* **Descuento de Franja Valle (07:00 - 16:00):** Reducción promocional del **25%** en reservas diurnas de canchas para incentivar la ocupación matutina y redistribuir la curva de demanda.
* **Normalización de Tarifa Base:** Corregir en la base de datos la tarifa de la Cancha de Fútbol 5 (actualmente en $50.00) para unificarla con el valor real de mercado ($60,000.00 COP).

### 2.2 Reestructuración de Franjas y Capacidad Operativa
* **Desacople en Servicios de Aforo Libre (Gimnasio / Piscina):** Reducir la sobreoferta de franjas rígidas. En gimnasio y piscina se sugiere parametrizar acceso por turnos abiertos o membresía sin reserva de slot individual para no generar miles de filas vacías en `disponibilidad`.
* **Redistribución Nocturna:** Abrir franjas modulares de 60 minutos (en lugar de 90 min) entre 19:00 y 22:00 en canchas para incrementar la rotación en hora pico.

### 2.3 Mitigación de Abandono de Checkout (25.97%)
* Reducir la fricción en pasarela de pagos y activar notificaciones automáticas previas al vencimiento de la ventana de 30 minutos del bloqueo TTL (RN-04).

---

## 3. Consultas SQL Reproducibles

```sql
-- 1. Ocupación por servicio y modalidad
SELECT s.id, s.nombre, s.modalidad, s.tarifa,
       SUM(d.cupos_totales) AS total_cupos_ofertados,
       SUM(d.cupos_ocupados) AS total_cupos_ocupados,
       ROUND((SUM(d.cupos_ocupados)::NUMERIC / NULLIF(SUM(d.cupos_totales), 0)) * 100, 2) AS tasa_ocupacion_pct
FROM servicio s
JOIN disponibilidad d ON s.id = d.servicio_id
GROUP BY s.id, s.nombre, s.modalidad, s.tarifa
ORDER BY tasa_ocupacion_pct DESC;

-- 2. Análisis por franja horaria y horas pico
SELECT f.hora_inicio, f.hora_fin,
       SUM(d.cupos_totales) AS cupos_ofertados,
       SUM(d.cupos_ocupados) AS cupos_reservados,
       ROUND((SUM(d.cupos_ocupados)::NUMERIC / NULLIF(SUM(d.cupos_totales), 0)) * 100, 2) AS ocupacion_promedio_pct,
       CASE 
           WHEN ROUND((SUM(d.cupos_ocupados)::NUMERIC / NULLIF(SUM(d.cupos_totales), 0)) * 100, 2) >= 60 THEN 'HORA PICO'
           WHEN ROUND((SUM(d.cupos_ocupados)::NUMERIC / NULLIF(SUM(d.cupos_totales), 0)) * 100, 2) >= 30 THEN 'MEDIA'
           ELSE 'HORA VALLE'
       END AS clasificacion_demanda
FROM franja_horaria f
JOIN disponibilidad d ON f.id = d.franja_id
GROUP BY f.hora_inicio, f.hora_fin
ORDER BY f.hora_inicio ASC;

-- 3. Embudo y tasa de abandono de checkout
SELECT COUNT(*) AS total_intenciones_reserva,
       COUNT(*) FILTER (WHERE r.estado = 'CONFIRMADA'::"EstadoReserva") AS reservas_confirmadas,
       COUNT(*) FILTER (WHERE r.estado = 'EXPIRADA'::"EstadoReserva") AS reservas_expiradas_abandono,
       COUNT(*) FILTER (WHERE r.estado = 'PENDIENTE_PAGO'::"EstadoReserva") AS reservas_en_proceso_ttl,
       ROUND((COUNT(*) FILTER (WHERE r.estado = 'EXPIRADA'::"EstadoReserva")::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2) AS tasa_abandono_checkout_pct
FROM reserva r;

-- 4. Tracción de membresías
SELECT pm.nombre, pm.precio, COUNT(m.id) AS suscriptores_activos,
       COUNT(m.id) * pm.precio AS mrr_membresias,
       ROUND((COUNT(m.id)::NUMERIC / NULLIF((SELECT COUNT(*) FROM usuario WHERE rol_id = (SELECT id FROM rol WHERE nombre = 'CLIENTE')), 0)) * 100, 2) AS penetracion_usuarios_pct
FROM plan_membresia pm
LEFT JOIN membresia m ON pm.id = m.plan_id AND m.estado = 'VIGENTE'::"EstadoMembresia"
GROUP BY pm.id, pm.nombre, pm.precio;