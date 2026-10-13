# TSK-FE-24 — Resiliencia Offline del Escáner QR

**Proyecto:** SportComplex (AKROS Club)  
**Componente:** `apps/web`  
**Dependencias:** TSK-FE-14 (Canje en modo turno) y TSK-FE-15 (Modo consulta informativo)  
**Rama:** `feature/tsk-fe-24-resiliencia-offline-del-escaner`  

---

## 1. Resumen Ejecutivo y Objetivos

La tarea **TSK-FE-24** dota a la vista `/scanner` del escáner de control de acceso de **SportComplex (AKROS Club)** de capacidades de resiliencia frente a pérdidas de conectividad y microcortes de red, garantizando **cero riesgo de fraude transaccional** y manteniendo al mismo tiempo la continuidad operativa del personal de portería (`Empleado_Lector`).

### Invariantes Críticos de Seguridad
1. **Canje transaccional bloqueado en offline:** Cuando el dispositivo pierde conectividad (`navigator.onLine === false` o `!isOnline`), el botón «Dar Acceso» se deshabilita visualmente y el handler bloquea la ejecución de forma preventiva. Jamás se emite una solicitud `POST /api/access/redeem` en estado desconectado.
2. **Cero autorización por caché:** La memoria caché local se restringe exclusivamente al modo consulta informativo. **Nunca** se autoriza un canje ni se concede acceso a partir de datos cacheados.
3. **No mutación local de estado:** Jamás se marca un boleto como `USADO` localmente ante una falla de red. El estado transaccional depende de forma estricta de la confirmación emitida por el backend.
4. **Tratamiento de resultado incierto:** Si ocurre un error de comunicación durante el canje, se notifica al operador de que el resultado es incierto sin afirmar éxito ni fallo definitivo, y **no se reintenta automáticamente el POST** para evitar canjes duplicados.

---

## 2. Arquitectura de la Solución

```
+-------------------------------------------------------------------------+
|                              /scanner                                   |
|                (apps/web/src/app/(staff)/scanner/page.tsx)              |
+------------------------------------+------------------------------------+
                                     |
                                     v
                  +--------------------------------------+
                  |        useNetworkResilience          |
                  | (hooks/use-network-resilience.ts)    |
                  +------------------+-------------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+-------------------------------+               +-------------------------------+
|       executeWithRetry        |               |    scanner_ticket_cache_v1    |
| - Intento inicial inmediato   |               | - localStorage seguro         |
| - Backoff: 1s -> 2s -> 4s     |               | - Sanitización estricta       |
| - Solo fallos transitorios    |               | - Solo datos informativos     |
| - Interrupción en 4xx         |               | - Cero firmas ni secretos     |
+-------------------------------+               +-------------------------------+
         |                                                       |
         v                                                       v
+-------------------------------+               +-------------------------------+
|  GET /api/tickets/verify/:id  |               |    ConsultationResultCard     |
|     (Modo Consulta)           |               |   [Datos locales en caché -   |
|                               |               |         Sin conexión]         |
+-------------------------------+               +-------------------------------+
```

### Componentes y Módulos Clave

1. **`apps/web/src/hooks/use-network-resilience.ts`**:
   Hook central desacoplado que encapsula:
   - Estado reactivo `isOnline` con inicialización segura compatible con SSR (`typeof window === 'undefined' ? true : navigator.onLine`).
   - Listeners de eventos de ventana `online` y `offline` con limpieza en el ciclo de desmontaje.
   - Algoritmo de reintento `executeWithRetry` con backoff exponencial exacto (1000 ms, 2000 ms, 4000 ms).
   - Clasificador de errores transitorios `isTransientNetworkError` que discrimina entre caídas de red y errores HTTP de negocio (4xx).
   - Acceso seguro y resiliente a la caché en `localStorage` bajo la clave `scanner_ticket_cache_v1`.

2. **`apps/web/src/app/(staff)/scanner/page.tsx`**:
   Página unificada del escáner (`Staff Portería`). Integra:
   - Indicador visual de estado accesible (`role="status"`, «En línea» / «Sin conexión»).
   - Banner corporativo accesible (`role="alert"`): «Sin conexión a internet. El canje de tickets está suspendido por seguridad».
   - Protección en `handleRedeem` y propagación de `isOnline` a `TicketValidationModal`.
   - Consulta con reintentos y recuperación desde caché cuando la red no está disponible.

3. **`apps/web/src/components/scanner/ticket-validation-modal.tsx`**:
   Modal de confirmación de canje con prop `isOnline`:
   - Botón «Dar Acceso» deshabilitado con etiqueta «Canje suspendido (Sin conexión)».
   - Alerta visible explicativa sobre la suspensión temporal del servicio por seguridad.

4. **`apps/web/src/components/scanner/consultation-result-card.tsx`**:
   Tarjeta informativa del boleto con soporte para `isCached`:
   - Distintivo obligatorio: `[Datos locales en caché - Sin conexión]`.
   - Banner de advertencia que explicita que la información puede estar desactualizada y no autoriza el acceso ni altera el estado del boleto.

---

## 3. Estrategia de Reintentos y Resiliencia de Red

### Algoritmo de Backoff Exponencial
Para operaciones de lectura informativa (`GET /api/tickets/verify/[code]`):
1. **Intento 0:** Inmediato (sin delay).
2. **Reintento 1:** Tras **1000 ms** (1 s) de espera si ocurre un fallo transitorio.
3. **Reintento 2:** Tras **2000 ms** (2 s) de espera.
4. **Reintento 3:** Tras **4000 ms** (4 s) de espera.
5. **Agotamiento:** Si el tercer reintento falla, se propaga la excepción para activar la recuperación de la caché local o reportar la indisponibilidad.

### Clasificación de Errores Transitorios vs. No Transitorios
- **Reintentables (transitorios):**
  - `TypeError: Failed to fetch` / `NetworkError` / errores de socket/DNS (`ECONNREFUSED`, `ETIMEDOUT`).
  - Códigos HTTP de servidor / pasarela: `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`.
- **No reintentables (aborto inmediato):**
  - Errores HTTP de cliente / negocio: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Entity`.
  - Fallos de validación de firma HMAC o formato de QR malformado.

---

## 4. Política y Limitaciones de la Caché Local

- **Clave de persistencia:** `scanner_ticket_cache_v1` en `localStorage`.
- **Campos estrictamente permitidos:**
  ```typescript
  export interface TicketConsultationData {
    ticketId: string;
    titularNombre: string;
    servicioNombre: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    cachedAt?: string;
  }
  ```
- **Campos expresamente prohibidos en la caché:**
  - Firmas HMAC (`signature`).
  - Secretos criptográficos (`qrSecret`, `secret`).
  - Identificadores de sesión o tokens de autenticación.
  - Resultados transaccionales (`access: "GRANTED"`).
- **Manejo de contingencias en almacenamiento:**
  - `JSON.parse` envuelto en bloques seguros: ante datos corruptos o ilegibles se restablece la colección sin arrojar excepciones no controladas.
  - Almacenamiento deshabilitado o cuotas excedidas (`QuotaExceededError`): se captura silenciosamente sin interrumpir el funcionamiento de la interfaz.

---

## 5. Matriz de Pruebas Automatizadas

La suite automatizada se ubica en:  
`apps/web/src/app/(staff)/scanner/__tests__/network-resilience.test.ts`

| Requisito / Escenario | Comprobación Verificada |
|:---|:---|
| **1. SSR seguro** | Inicialización segura sin `window` ni `navigator`, retornando valores por defecto seguros. |
| **2. Eventos online/offline** | Disparo de eventos `online` y `offline` en ventana, sincronización de estado y limpieza de listeners. |
| **3. Backoff exacto** | Intento inmediato y delays exactos de 1000 ms, 2000 ms y 4000 ms. |
| **4. Recuperación transitoria** | Fallo en intentos iniciales y resolución exitosa en reintento posterior. |
| **5. Agotamiento de reintentos** | Lanzamiento del error original tras superar `maxRetries = 3`. |
| **6. No reintento en 4xx** | Errores 400, 401, 403 y 404 abortan inmediatamente con 0 delays. |
| **7. Persistencia y sanitización** | Exclusión estricta de firmas HMAC y secretos criptográficos al persistir. |
| **8. Almacenamiento robusto** | Recuperación ante JSON corrupto y captura segura de `QuotaExceededError`. |
| **9. Bloqueo en interfaz** | Botón «Dar Acceso» deshabilitado y banner de alerta en `TicketValidationModal`. |
| **10. Cero solicitudes offline** | Bloqueo en handler impidiendo cualquier llamada `POST /api/access/redeem`. |
| **11. Sin cambios a USADO** | Imposibilidad de mutar localmente el estado del boleto ante fallas de red. |
| **12. Resultado incierto** | Advertencia al operador ante fallas de red en POST sin reintentar automáticamente. |
| **13. Consulta online exitosa** | Guardado de datos informativos sanitizados tras verificación positiva en backend. |
| **14. Consulta offline con caché** | Recuperación de datos cacheados con distintivo obligatorio `[Datos locales en caché - Sin conexión]`. |
| **15. Consulta offline sin caché** | Mensaje claro de indisponibilidad sin inventar información de validación. |
| **16. Errores HTTP sin acceso** | Errores 500 o respuestas inválidas nunca conceden acceso ni autorización. |
| **17. Reconexión en vivo** | Actualización reactiva del indicador a «En línea» sin recargar la página. |
| **Gherkin A** | Bloqueo de canje con `navigator.onLine === false`. |
| **Gherkin B** | Microcorte de red con reintentos y procesamiento satisfactorio. |
| **Gherkin C** | Consulta offline con boleto cacheado y distintivo. |
| **Gherkin D** | Consulta offline sin caché informando indisponibilidad. |
| **Gherkin E** | Resultado transaccional incierto sin reenvío automático. |
| **Gherkin F** | Reconexión en vivo actualizando el indicador visual. |

---

## 6. Verificación de Cumplimiento Técnico

- **Pruebas unitarias y de integración:** 41 pruebas ejecutadas y superadas en el módulo de escáner.
- **Typecheck:** `tsc --noEmit` sin errores en los 5 workspaces del monorepo (`validation`, `ui`, `db`, `core`, `web`).
- **Lint:** ESLint v9 en modo estricto sin advertencias ni errores en ningún paquete del monorepo.

