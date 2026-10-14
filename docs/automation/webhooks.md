# Documentación de Integración: Webhook de Pagos Fallidos con n8n y Resend

## 1. Resumen Ejecutivo
Se implementó y validó exitosamente una arquitectura de automatización de flujos de trabajo utilizando **n8n Cloud** para procesar notificaciones de eventos de cobro fallido (`invoice.payment_failed`) de Stripe. El flujo valida la estructura de la petición entrante, da formato a las variables de notificación, envía un correo transaccional estilizado en HTML mediante la API de **Resend** y responde con los códigos de estado HTTP pertinentes (`200 OK` para envíos exitosos o `400 Bad Request` para payloads inválidos).

---

## 2. Diagrama del Flujo de Trabajo (Workflow)

```
 [Webhook: Payment Failed]
            │
            ▼
[Validar Payload & Correo] ──(False)──► [Respuesta 400 Bad Request]
            │
         (True)
            │
            ▼
[Formatear Datos de Notificación]
            │
            ▼
   [Send a new email] (Resend)
            │
            ▼
  [Respuesta 200 OK]
```

---

## 3. Descripción Detallada de los Nodos

### A. Webhook: Payment Failed
* **Método HTTP:** `POST`
* **Path:** `/billing/failed`
* **Función:** Recibe las peticiones entrantes enviadas por el backend o pasarela de pagos.
* **Estructura del Payload Esperado:**
  ```json
  {
    "body": {
      "customerEmail": "cliente@ejemplo.com",
      "customerName": "Nombre del Cliente",
      "billingPortalUrl": "https://billing.stripe.com/p/session/...",
      "event": "invoice.payment_failed"
    }
  }
  ```

### B. Validar Payload & Correo (Nodo If)
* **Función:** Actúa como filtro de seguridad y consistencia de datos antes de intentar el procesamiento del correo.
* **Reglas de Validación:**
  1. Que la variable de correo exista y no sea nula/vacía:  
     `{{ $('Webhook: Payment Failed').item.json.body.customerEmail }}` $\rightarrow$ *is not empty*.
  2. Que el evento corresponda al fallo de pago:  
     `{{ $('Webhook: Payment Failed').item.json.body.event }}` $\rightarrow$ *is equal to* `invoice.payment_failed`.
* **Rutas de Salida:**
  * **`True`:** Pasa al nodo de formateo si el payload contiene todos los datos requeridos.
  * **`False`:** Redirige inmediatamente al nodo `Respuesta 400 Bad Request`.

### C. Respuesta 400 Bad Request (Nodo Webhook Response)
* **Código de Estado HTTP:** `400`
* **Función:** Detiene el flujo de forma segura si la petición entrante está incompleta o mal formateada, evitando excepciones en nodos posteriores y notificando al remitente del fallo de sintaxis.

### D. Formatear Datos de Notificación (Nodo Set / Edit Fields)
* **Función:** Mapea las variables extraídas de la petición (`customerEmail`, `customerName`, `billingPortalUrl`) y prepara los textos para ser incrustados en la plantilla HTML.

### E. Send a new email (Nodo Resend)
* **Proveedor:** Resend API
* **Parámetros de Configuración:**
  * **From:** `no-reply@akros.lat` *(o `onboarding@resend.dev` durante la fase de pruebas previo a la propagación DNS)*.
  * **To:** `{{ $json.body.customerEmail }}` *(dinámico)* o `tjafet93@gmail.com` *(fijo para entorno de pruebas)*.
  * **Subject:** `Problema al procesar el pago de tu membresía`
  * **Email Format:** `HTML`
* **Estructura de la Plantilla HTML:**
  ```html
  <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background-color: #0b0f0d; color: #f1f5f9; (dark AKROS)">
    <h2 style="color: #d32f2f;">Atención con la renovación de tu membresía</h2>
    <p>Hola {{ $json.customerName }},</p>
    <p>Hemos intentado procesar el pago de tu membresía pero la transacción fue rechazada.</p>
    <p>Para evitar la interrupción de tu servicio, actualiza tu método de pago haciendo clic en el siguiente enlace:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{ $json.billingPortalUrl }}" style="background: #c9ef75; color: #111815; padding: 12px 28px; border-radius: 9999px; (acento DS)">Actualizar Métodos de Pago</a>
    </p>
  </div>
  ```

### F. Respuesta 200 OK (Nodo Webhook Response)
* **Código de Estado HTTP:** `200`
* **Función:** Devuelve una respuesta de éxito confirmando que el ciclo completo de procesamiento y notificación se completó sin errores.

---

## 4. Configuración del Dominio y Registros DNS en Resend

Para permitir el envío de correos desde la dirección de dominio personalizado (`no-reply@akros.lat`) sin incurrir en errores de autenticación HTTP `403`, se deben añadir los siguientes registros en el proveedor de DNS para el dominio `akros.lat`:

| Registro | Tipo | Nombre | Valor / Content | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **DKIM** | `TXT` | `resend._domainkey` | `p=MIGfMA...` *(Llave pública provista por Resend)* | Auto |
| **SPF** | `CNAME` | `rsend` | `rsend-sa...mta.net` | Auto |
| **Tracking** | `CNAME` | `send` | `send.for...mta.net` | Auto |

---

## 5. Guía de Pruebas (curl)

Para realizar una prueba completa de extremo a extremo que ejecute la rama **`True`** hasta el nodo **200 OK**, se debe ejecutar el siguiente comando en la terminal con el flujo puesto en modo escucha (`Execute workflow`):

```bash
curl -X POST "https://jafet123.app.n8n.cloud/webhook-test/billing/failed" \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "customerEmail": "tjafet93@gmail.com",
      "customerName": "Usuario de Prueba",
      "billingPortalUrl": "https://billing.stripe.com/p/session/test_123",
      "event": "invoice.payment_failed"
    }
  }'
```

---

## 6. Siguientes Pasos para Producción
1. Confirmar el estado **Verified** del dominio `akros.lat` en la consola de Resend.
2. Cambiar la URL del Webhook en Stripe/Backend de la ruta `/webhook-test/` a la ruta de producción `/webhook/`.
3. Activar el interruptor **Active** en la parte superior derecha de n8n para mantener el flujo escuchando permanentemente en segundo plano.# Documentación Técnica: Sistema de Contingencia y Reintentos de Webhooks (TSK-AU-08)

## 1. Objetivo General
Garantizar la recepción, procesamiento y tolerancia a fallos de webhooks provenientes del backend, implementando un mecanismo de reintentos con backoff exponencial y un sistema de almacenamiento para mensajes fallidos (**Dead-Letter Queue - DLQ**) que asegure la integridad del payload original ante caídas de servicio.

---

## 2. Arquitectura y Componentes del Flujo en n8n

* **Recepción y Normalización de Estado (Webhook y Edit Fields Inicial)**
  * Captura las peticiones HTTP POST de forma síncrona.
  * Inicializa las variables de control de contingencia:
    * `attempt`: Contador de intentos inicializado en `0`.
    * `maxAttempts`: Límite máximo configurado en `5`.
    * `eventId`: Identificador único generado por cada transacción.
    * `payload`: Contenedor seguro que resguarda el JSON original recibido (datos del servicio, motivo y afectaciones).

* **Evaluación de Ciclo de Vida (`¿Superó Intentos?` - Nodo If)**
  * Evalúa la condición numérica comparando si el número actual de intentos es mayor o igual al límite (`attempt >= maxAttempts`).
  * Divide el flujo en dos rutas principales: **False** (para reintentar) y **True** (para desvío a DLQ).

* **Bucle de Reintentos Progresivos (Ruta False)**
  * **Nodo Wait:** Calcula un tiempo de espera exponencial dinámico en segundos mediante la fórmula matemática `5 * Math.pow(2, $json.attempt)` (generando intervalos de 5s, 10s, 20s, 40s y 80s).
  * **Nodo Edit Fields (Incrementador):** Suma `1` al contador `attempt` (`{{ $json.attempt + 1 }}`) preservando los campos restantes y cerrando el ciclo mediante un enlace de retorno hacia la entrada del nodo de evaluación.

* **Dead-Letter Queue - DLQ (Ruta True)**
  * Se activa de manera automática cuando el evento agota los 5 reintentos configurados.
  * Estructura un registro final de auditoría compuesto por:
    * `eventId`: Identificador único del evento original.
    * `payload`: Cuerpo intacto de los datos del webhook.
    * `attempts`: Total de intentos ejecutados.
    * `lastError`: Mensaje descriptivo del motivo del fallo.
    * `failedAt`: Estampa temporal del momento en que falló definitivamente.
    * `status`: Definido como `"PENDING_REVIEW"` para su posterior revisión operativa.