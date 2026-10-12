# TSK-FE-18: Interfaz de Punto de Venta (Taquilla POS) 100% Cashless

- **Historia de Usuario:** HU-18 (RF-17)
- **Reglas de Negocio:** RN-08 (Descuento del 30% a socios), RN-13 (Cero efectivo), RNF-05 (Impresión de comprobante térmico)
- **Riesgo Mitigado:** SRS §11.1 Riesgo 2 (Contingencia para tarjetas con 3DS o falla de terminal físico)
- **Componente:** Frontend / Backend Taquilla POS
- **Integraciones:** Stripe (Cobros Cashless), `@sportcomplex/core`, `@sportcomplex/db`

---

## 1. Descripción General

La interfaz de Punto de Venta (Taquilla POS) permite al personal de mostrador (`Empleado_Vendedor` y `Administrador`) gestionar la venta presencial de turnos y servicios deportivos para clientes walk-in o registrados.

Bajo la regla **RN-13**, la taquilla opera bajo un modelo **100% Cashless** (cero efectivo en caja):
- Todos los cobros se realizan mediante tarjetas débito/crédito a través de **Stripe**.
- En caso de tarjetas con autenticación 3DS móvil o contingencias físicas, el sistema genera dinámicamente un enlace y código QR para que el cliente complete el pago seguro en su dispositivo móvil mediante `/checkout`.

---

## 2. Flujo Operativo y Arquitectura de Pagos

El flujo de pago respeta la arquitectura empresarial definida en **TSK-BE-18** y **TSK-BE-19**:

```
+----------------+      1. POST /api/pos/checkout       +-------------------+
|                | -----------------------------------> |                   |
|  PosPage (UI)  |                                      | Backend POS Route |
|                | <----------------------------------- |                   |
+----------------+       Holds + client_secret          +-------------------+
        |
        | 2. Confirmación Segura (Stripe Elements / Terminal)
        v
+----------------+      3. payment_intent.succeeded     +-------------------+
|  Stripe Cloud  | -----------------------------------> |  Webhook Stripe   |
+----------------+                                      | (/api/payments)   |
                                                        +-------------------+
                                                                  |
                                                                  | 4. Confirma reserva,
                                                                  |    asocia PAGO y
                                                                  |    emite TicketQr (HMAC)
                                                                  v
+----------------+      5. GET /api/pdf/receipt         +-------------------+
|  PosPage (UI)  | <----------------------------------- | Comprobante & QR  |
|  (Impresión)   |          Comprobante térmico         |    (Servidor)     |
+----------------+                                      +-------------------+
```

### Pasos detallados:
1. **Creación de Hold:** El operador selecciona servicio, fecha y horario. La API crea atómicamente la reserva en estado `PENDIENTE_PAGO` con `canal: "TAQUILLA"` y `vendedorId`, reservando cupo temporal (30 minutos).
2. **Validación de Membresía (RN-08):** El backend consulta la tabla `membresia` para verificar si el cliente posee membresía `VIGENTE`. Solo si está activa se aplica el 30% de descuento. El booleano del cliente no es aceptado a ciegas (prevención de fraude).
3. **Cobro con Tarjeta (PCI-DSS):** La aplicación cliente no captura ni manipula números de tarjeta (PAN) ni códigos CVC en texto plano dentro del estado de React. Se utiliza la pasarela oficial de Stripe.
4. **Confirmación Asíncrona:** El webhook oficial de Stripe (`/api/payments`) procesa el evento `payment_intent.succeeded`, transicionando la reserva a `CONFIRMADA`, creando el registro de pago y emitiendo el `TicketQr` firmado criptográficamente.
5. **Comprobante y Pase:** La taquilla consulta `GET /api/pdf/receipt?reservaId=...&destinatario=POS` para obtener los datos de membrete y el código QR rasterizado con firma HMAC para acceso en torniquetes.

---

## 3. Mitigación de Riesgos y Contingencia (SRS §11.1)

Si la tarjeta del cliente requiere validación bancaria externa (3D-Secure en smartphone) o hay fallas en el datáfono virtual de mostrador:
1. El vendedor presiona **"Enlace Alternativo / QR Móvil"**.
2. El sistema genera dinámicamente una sesión oficial de Stripe Checkout (`createStripeCheckoutSession`) con URL cifrada de pago directo (`https://checkout.stripe.com/...`) o enlace compatible de contingencia.
3. El cliente escanea el código QR desde su celular, completando el pago de forma segura sin manipulación de números de tarjeta en texto plano (cumplimiento estricto de PCI-DSS SAQ A).

---

## 4. Especificaciones de Impresión de Comprobante Térmico (RNF-05)

- **Dispositivos soportados:** Impresoras térmicas de tickets ESC/POS estándar de **58 mm** y **80 mm**, así como impresoras láser/inyección para exportación en formato carta o PDF.
- **Acción:** `window.print()` estilizado con medios `@media print` para ajustar márgenes, tipografía monoespaciada compacta y contraste de código QR de 260px.
- **Contenido del Comprobante:**
  - Membrete: Razón social, NIT, dirección y canal TAQUILLA.
  - Código alfanumérico de reserva (ej. `AKR-POS-XXXX-XXXX`).
  - Datos de titular y vendedor responsable.
  - Desglose contable: Tarifa base, descuento socio (30%), IVA (19%) y total pagado.
  - Código QR de torniquete óptico firmado con secreto HMAC del servidor (`QR_HMAC_SECRET`).

---

## 5. Limitación Operativa del Datáfono Virtual (ARCH-REG-02)

- El cobro presencial en `pos/page.tsx` confirma el `PaymentIntent` con el método sintético `pm_card_visa`, válido **únicamente con claves de prueba de Stripe (`pk_test_...`)**.
- Con claves de producción (`pk_live_...`) la aplicación **rechaza el cargo mock** y mantiene la reserva en `PENDIENTE_PAGO`; el operador debe completar el cobro mediante el enlace de Stripe Checkout de contingencia.
- La captura de tarjetas físicas reales en producción requiere integrar Stripe Terminal SDK o Stripe Elements (fuera del alcance de TSK-FE-18).
