# FE-14 — Lector de accesos y canje de tickets

Documentación específica de la rama `escaner-QR` para el portal de operador en
SportComplex.

## Acceso al lector

La pantalla del lector está disponible en `/scanner` para cuentas activas con
rol `Administrador` o `Empleado_Lector`. Antes de iniciar la cámara o canjear un
ticket, el operador debe seleccionar un servicio deportivo activo.

La lista se carga desde `GET /api/access/services`, endpoint protegido para
esos mismos roles. El ID seleccionado se envía como `postServiceId`, convertido
y validado como entero positivo.

## Lectura y canje

Los códigos QR deben seguir el formato firmado:

```text
SC1:<ticket UUID>:<firma HMAC-SHA256 hexadecimal>
```

Al confirmar **Dar Acceso**, el lector envía `ticketId`, `signature` y
`postServiceId` a `POST /api/access/redeem`. El servidor valida la firma, el
servicio, la franja horaria y el estado del boleto, y realiza el canje. La
interfaz solo muestra el acceso como concedido cuando la respuesta informa
`access: "GRANTED"`.

La pantalla presenta los siguientes estados:

| Resultado | Presentación |
| --- | --- |
| `GRANTED` | Acceso concedido y detalles disponibles de titular, reserva, servicio y horario |
| `ALREADY_USED` | Boleto ya utilizado anteriormente |
| `SERVICE_MISMATCH` | El ticket pertenece a otro escenario deportivo |
| `WINDOW_EXPIRED` | Franja horaria vencida o no disponible |

## Validación del frontend

Desde la raíz del monorepo:

```bash
pnpm --dir apps/web run typecheck
pnpm --dir apps/web run lint
```
