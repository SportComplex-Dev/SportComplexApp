# TSK-BE-13 — Historial de reservas con cursor

## Endpoint

`GET /api/bookings/history?status=<estado>&cursor=<cursor>&limit=<n>`

- Requiere sesión de cliente activa y consulta solo reservas cuyo `titularId` coincide con el usuario autenticado.
- `status` es obligatorio y acepta únicamente `CONFIRMADA`, `EXPIRADA` o `CANCELADA_ADMINISTRATIVA`. El estado `CANCELADA` representa exclusivamente cancelaciones administrativas; no se agrega cancelación por autoservicio.
- `limit` es opcional (20 por defecto; rango 1–50).
- La respuesta contiene `items`, `nextCursor` y `hasMore`.

## Orden y estabilidad

Las páginas usan keyset pagination descendente por `(creadoEn, id)`, con `id` como desempate. El cursor codifica esos valores; no se usa offset. Las inserciones posteriores quedan antes del cursor y no desplazan los elementos de páginas ya recorridas.

El modelo `Reserva` declara el índice compuesto `@@index([titularId, estado, creadoEn, id])`, que acompaña el keyset: el prefijo de igualdad `(titularId, estado)` más el orden descendente `(creadoEn, id)` sin necesidad de un sort adicional. Se aplica con la migración `20261011130000_reserva_history_keyset_index` (reemplaza al índice previo `[titularId, estado]`). Las pruebas verifican conjuntos disjuntos por estado, aislamiento por titular y estabilidad al insertar una reserva nueva.
