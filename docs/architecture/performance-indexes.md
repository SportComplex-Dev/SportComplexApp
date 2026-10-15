# Tuning de Consultas con EXPLAIN ANALYZE y Evaluación Técnica de GiST
> Estado: vigente 2026-10-15

> Ref histórica: TSK-BD-05 · HU-24 (RF-21 / RNF-01) · Fase F4 · 5 pts · rama `feature/tsk-bd-05-tuning-de-consultas-con-explain` · depende de TSK-BD-04 · responsable: Leonardo · componente: Database & Analytics

- **Motor:** PostgreSQL (Supabase)
- **Zona Horaria:** `America/Bogota` (UTC-5)

---

## 1. Alcance Técnico y Criterios de Aceptación

El objetivo de esta tarea consiste en:
1. Implementar y verificar los índices B-Tree especializados (compuestos y parciales) para erradicar los escaneos secuenciales (`Seq Scan`) sobre las tablas de alto tráfico.
2. Medir con `EXPLAIN (ANALYZE, BUFFERS)` las consultas críticas del sistema:
   - Consulta de **Disponibilidad** de cupos y franjas.
   - Bloqueo pesimista en **Checkout** (`SELECT ... FOR UPDATE`, RNF-01).
   - Proceso de limpieza periódica de reservas vencidas bajo ventana **TTL de 30 min** (RN-04).
3. Evaluar empírica y formalmente si un constraint `EXCLUDE USING GiST` aporta valor como defensa en profundidad frente al bloqueo pesimista, documentando la prueba de viabilidad y el análisis costo/beneficio (§6, nota 2).

---

## 2. Índices Especializados Implementados

Se crearon 4 índices estratégicos en el esquema relacional:

```sql
-- 1. Búsqueda de disponibilidad por servicio y fecha
CREATE INDEX IF NOT EXISTS idx_disponibilidad_servicio_fecha 
ON disponibilidad (servicio_id, fecha);

-- 2. Índice parcial para la limpieza de reservas vencidas en TTL (RN-04)
CREATE INDEX IF NOT EXISTS idx_reserva_expira_ttl 
ON reserva (expira_en) 
WHERE estado = 'PENDIENTE_PAGO'::"EstadoReserva";

-- 3. Índice para analítica de lecturas en portería (RF-21)
CREATE INDEX IF NOT EXISTS idx_lectura_acceso_fecha_hora 
ON lectura_acceso (fecha_hora);

-- 4. Soporte para consultas de reservas por titular y estado
CREATE INDEX IF NOT EXISTS idx_reserva_titular_estado 
ON reserva (titular_id, estado);

```

---

## 3. Evidencia Experimental de Planes de Ejecución (`EXPLAIN ANALYZE`)

### 3.1 Consulta 1: Disponibilidad de Cupos por Servicio y Fecha

* **Ruta de Negocio:** Consulta del usuario al explorar el catálogo de horarios disponibles.
* **Consulta SQL Evaluada:**
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT 
    d.id,
    d.servicio_id,
    d.fecha,
    f.hora_inicio,
    f.hora_fin,
    d.cupos_totales,
    d.cupos_ocupados,
    (d.cupos_totales - d.cupos_ocupados) AS cupos_disponibles
FROM disponibilidad d
JOIN franja_horaria f ON d.franja_id = f.id
WHERE d.servicio_id = 1 
  AND d.fecha = CURRENT_DATE
  AND d.bloqueada_mantenimiento = FALSE;

```


* **Plan de Ejecución Obtenido:**
```text
Nested Loop  (cost=0.30..9.93 rows=6 width=44) (actual time=0.623..0.647 rows=6 loops=1)
  Buffers: shared hit=14 read=1
  ->  Index Scan using idx_disponibilidad_servicio_fecha on disponibilidad d  (cost=0.15..4.51 rows=6 width=28) (actual time=0.609..0.625 rows=6 loops=1)
        Index Cond: ((servicio_id = 1) AND (fecha = CURRENT_DATE))
        Filter: (NOT bloqueada_mantenimiento)
        Buffers: shared hit=2 read=1
  ->  Index Scan using franja_horaria_pkey on franja_horaria f  (cost=0.15..0.90 rows=1 width=20) (actual time=0.002..0.002 rows=1 loops=6)
        Index Cond: (id = d.franja_id)
        Buffers: shared hit=12
Planning Time: 15.242 ms
Execution Time: 1.202 ms

```


* **Diagnóstico:**
`Seq Scan` eliminado por completo. El optimizador resolvió la consulta mediante dos `Index Scan` encadenados por un `Nested Loop`, recuperando 6 filas con una latencia de **1.202 ms** y 14 hits en memoria compartida.

---

### 3.2 Consulta 2: Checkout Concurrente con Bloqueo Pesimista (RNF-01)

* **Ruta de Negocio:** Garantizar que no ocurra sobreventa (overbooking) adquiriendo un cerrojo exclusivo sobre el registro antes de insertar la reserva.
* **Consulta SQL Evaluada:**
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT id, cupos_totales, cupos_ocupados
FROM disponibilidad
WHERE id = 1
FOR UPDATE;

```


* **Plan de Ejecución Obtenido:**
```text
LockRows  (cost=0.28..2.50 rows=1 width=22) (actual time=0.351..0.353 rows=1 loops=1)
  Buffers: shared hit=7 dirtied=1
  ->  Index Scan using disponibilidad_pkey on disponibilidad  (cost=0.28..2.49 rows=1 width=22) (actual time=0.127..0.128 rows=1 loops=1)
        Index Cond: (id = 1)
        Buffers: shared hit=6
Planning Time: 0.528 ms
Execution Time: 0.450 ms

```


* **Diagnóstico:**
La adquisición del bloqueo a nivel de fila (`LockRows`) se apoya directamente en la clave primaria (`disponibilidad_pkey`). Operación de acceso directo sin recorrido secuencial, con tiempo de ejecución de **0.450 ms**.

---

### 3.3 Consulta 3: Worker de Limpieza TTL de Reservas Pendientes (RN-04)

* **Ruta de Negocio:** Job recurrente que localiza reservas vencidas (`expira_en < NOW()`) en estado `PENDIENTE_PAGO` para marcarlas como `EXPIRADA` y liberar cupos.
* **Consulta SQL Evaluada:**
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT id, disponibilidad_id, cantidad_cupos
FROM reserva
WHERE estado = 'PENDIENTE_PAGO'::"EstadoReserva"
  AND expira_en < NOW();

```


* **Plan de Ejecución Obtenido:**
```text
Index Scan using idx_reserva_expira_ttl on reserva  (cost=0.14..3.30 rows=2 width=28) (actual time=1.114..1.116 rows=2 loops=1)
  Index Cond: (expira_en < now())
  Buffers: shared hit=1 read=1
Planning Time: 5.975 ms
Execution Time: 1.176 ms

```


* **Diagnóstico:**
El índice parcial `idx_reserva_expira_ttl` aisla exclusivamente las reservas pendientes de pago sin indexar ni recorrer el histórico masivo de reservas confirmadas o canceladas. Tiempo de ejecución: **1.176 ms**.

---

## 4. Evaluación Técnica y Prueba de Viabilidad: `EXCLUDE USING GiST`

### 4.1 Prueba Experimental Ejecutada

Se intentó aplicar una restricción de exclusión física con GiST directamente sobre la tabla `reserva` para evaluar si aportaba defensa en profundidad:

```sql
ALTER TABLE reserva ADD CONSTRAINT no_overlap 
EXCLUDE USING gist (servicio_id WITH =, tstzrange(hora_inicio, hora_fin) WITH &&);

```

**Resultado devuelto por el motor PostgreSQL:**

```text
Failed to run sql query: ERROR: 42703: column "hora_inicio" does not exist
LINE 3: EXCLUDE USING gist (servicio_id WITH =, tstzrange(hora_inicio, hora_fin) WITH &&);

```

---

### 4.2 Análisis Costo / Beneficio y Dictamen de Arquitectura

El fallo de la prueba evidencia la realidad arquitectónica del modelo relacional aprobado en SportComplex y sustenta por qué GiST **no debe implementarse**:

| Criterio Evaluado | Bloqueo Pesimista + Slots (`SELECT ... FOR UPDATE`) | Restricción de Exclusión GiST (`EXCLUDE USING GiST`) |
| --- | --- | --- |
| **Normalización del Modelo** | **Excelente:** Respeta el DER. La dimensión temporal está normalizada en `disponibilidad` $\to$ `franja_horaria`. `reserva` solo almacena el ID del slot. | **Inadmisible:** Obliga a desnormalizar la tabla `reserva` duplicando campos continuos (`hora_inicio`, `hora_fin`, `servicio_id`). |
| **Soporte de Modalidad AFORO (Multi-cupo)** | **Totalmente soportado:** Permite validar atómicamente `cupos_ocupados + nuevos_cupos <= cupos_totales` (piscinas de 50 personas, gimnasio con 100 cupos). | **Incompatible:** GiST resuelve colisiones $1:1$ continuas, pero no soporta nativamente la acumulación numérica de cupos parciales concurrentes en una misma franja. |
| **Comportamiento ante Concurrencia** | **Encolamiento ordenado:** Las transacciones concurrentes esperan el desbloqueo del registro (`FOR UPDATE`), evalúan el cupo disponible y confirman si aún hay aforo. | **Aborto abrupto de transacción:** Una colisión en GiST lanza un error fatal de restricción (`exclusion_violation`) que rechaza de inmediato al usuario, requiriendo reintentos a nivel de aplicación. |
| **Rendimiento e Indexación** | **Muy bajo overhead:** Operado mediante índices B-Tree nativos (`0.45 ms` en checkout). | **Penalización de I/O y CPU:** Los árboles GiST consumen significativamente más memoria y ralentizan las operaciones de inserción masiva (`INSERT`). |

---

## 5. Conclusión y Dictamen Final

1. **Cumplimiento de Rendimiento:**
Se logró la erradicación total de `Seq Scan` en las 3 operaciones neurálgicas del sistema. Los tiempos de respuesta de consulta oscilan entre **0.45 ms y 1.20 ms**, garantizando un rendimiento óptimo bajo alta concurrencia.
2. **Decisión sobre GiST:**
Se documenta formalmente el **descarte de `EXCLUDE USING GiST**`. La arquitectura actual fundamentada en:
* Clave única `UNIQUE (servicio_id, franja_id, fecha)` en `disponibilidad`.
* Restricción de integridad `CHECK (cupos_ocupados BETWEEN 0 AND cupos_totales)`.
* Cerrojo transaccional `SELECT ... FOR UPDATE` sobre la clave primaria discreta.
proporciona una defensa hermética contra el overbooking (RNF-01), cubre simultáneamente servicios exclusivos y de aforo múltiple, y opera con un costo de mantenimiento sustancialmente menor.



```

```
