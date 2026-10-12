# Documentación Técnica: Sistema de Contingencia y Reintentos de Webhooks (TSK-AU-08)

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