# TSK-BE-08 — Modalidad de piscina: aforo concurrente o exclusividad

## Implementación

- `PRIVADA` requiere modalidad `EXCLUSIVA` y genera disponibilidades con `cuposTotales = 1`, sin importar que la capacidad física configurada sea mayor.
- `PUBLICA` requiere modalidad `AFORO` y usa `capacidadMaxima` como aforo de cada franja.
- Al actualizar el tipo de piscina se sincroniza la modalidad y el aforo de las disponibilidades existentes dentro de la transacción del servicio.
- El bloqueo de disponibilidad y el descuento de cupos siguen usando la transacción y el bloqueo de fila de `TSK-BE-05`.

## Verificación

Las pruebas cubren piscina pública con aforo 30 y reserva de 2 cupos (quedan 28), piscina privada con capacidad configurada 30 (la franja solo admite una reserva), cambios de tipo y validación de combinaciones incompatibles.

No se modificó el esquema ni se creó/aplicó una migración.
