# TSK-BE-16 — Denegación explícita por discrepancia de zona

## Objetivo

Al escanear un tiquete desde un puesto asociado a otro servicio, denegar el acceso de forma explícita e indicar los nombres de ambos servicios. Por ejemplo:

> Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas

La validación compara el servicio de la reserva del tiquete con `postServiceId`, que identifica el servicio del puesto actual.

## Comportamiento implementado

- La discrepancia devuelve HTTP `403` con `error.code = SERVICE_MISMATCH` y el mensaje con los nombres del servicio del tiquete y del puesto.
- Este `403` usa el formato estándar de error (`success: false`, `error.message`); las denegaciones por horario o tiquete usado conservan el formato anterior HTTP `200` con `data.access = DENIED`. El frontend de TSK-FE-16 debe manejar ambos contratos.
- La regla aplica tanto a `POST /api/access/redeem` como a `POST /api/access`, que comparten el procesamiento de escaneo.
- El intento denegado conserva la auditoría existente (`DENEGADO_SERVICIO`) y no modifica el estado, el empleado ni la fecha de uso del tiquete.
- Si el identificador del puesto no corresponde a un servicio existente, la petición devuelve `404 SERVICE_NOT_FOUND`; no registra una lectura ni modifica el tiquete.
- Un servicio de puesto existente pero inhabilitado sigue participando en la comparación de zona: si el servicio no coincide con el del tiquete, aplica el mismo `403 SERVICE_MISMATCH`. La habilitación operativa del puesto no forma parte de esta task.
- Los demás resultados de acceso conservan sus respuestas actuales.

## Persistencia

No se modifica el esquema de Prisma ni se agrega una migración. Para construir el mensaje se consulta el nombre del servicio asociado al puesto; la auditoría de acceso ya existente registra la denegación.

## Cobertura automatizada

- `apps/web/src/app/api/access/redeem/__tests__/route.test.ts`: comprueba el HTTP `403`, el mensaje de aceptación, la auditoría de denegación y que el tiquete permanece `EMITIDO`.
- `apps/web/src/app/api/access/redeem/__tests__/route.test.ts` y `apps/web/src/app/api/access/__tests__/access.test.ts`: cubren ambos contratos HTTP `403`, el servicio inhabilitado y el servicio de puesto inexistente.
- Las pruebas existentes siguen cubriendo firma HMAC inválida antes de consultar la base de datos, autenticación, autorización, canje exitoso, doble escaneo y denegaciones por estado o franja horaria.
