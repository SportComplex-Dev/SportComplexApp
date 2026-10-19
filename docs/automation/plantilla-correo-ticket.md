# Plantilla de Correo y Pase QR Transaccional

> Estado: vigente 2026-10-16  
> Tarea: `TSK-FE-37` | Historia de Usuario: `HU-39` (`RNF-05`) | Paquete: `@sportcomplex/automation`

Documentación técnica y especificación de arquitectura para la plantilla HTML responsiva de correo electrónico transaccional (`TicketEmailTemplate`), diseñada para la confirmación de reservas y emisión del pase deportivo con código QR de acceso integrado bajo la identidad visual de **AKROS Active Lifestyle Club** (SportComplex).

---

## 1. Contexto y Objetivos

El sistema requiere despachar de forma inmediata un comprobante transaccional tras la confirmación de una reserva o compra de turno deportivo. Cumpliendo con **HU-39** y **RNF-05**, el usuario recibe un correo electrónico que certifica su compra y le provee un pase digital con un código QR legible para la validación física en torniquetes y portería.

### Restricciones Arquitectónicas
- **Aislamiento de paquete:** El componente vive exclusivamente dentro de `@sportcomplex/automation` (en `packages/automation/src/templates/TicketEmailTemplate.tsx`).
- **Desacoplamiento:** No depende de controladores HTTP de pagos ni esquemas directos de Prisma; se alimenta de props estrictamente tipadas.
- **Bloqueo de Merge / Dependencia Técnica:**
  > [!IMPORTANT]
  > **Dependencia de Backend (TSK-BE-34):** La integración en producción y el cierre del flujo end-to-end quedan supeditados a la implementación del webhook de confirmación de Stripe en backend (`TSK-BE-34`), el cual conectará con el pipeline de n8n/Resend para despachar esta plantilla.

---

## 2. Arquitectura HTML y Compatibilidad con Clientes de Correo

El renderizado de correos electrónicos requiere técnicas de maquetación altamente conservadoras para garantizar consistencia visual a través de múltiples motores de renderizado heterogéneos.

### Decisiones de Diseño Técnico

1. **Estructura Tabular Pura (`<table>` anidados):**
   - Todo el layout visual se construye utilizando tablas HTML con atributos explícitos `role="presentation"`, `cellPadding="0"`, `cellSpacing="0"` y `border="0"`.
   - Se evita el uso de Flexbox o CSS Grid, dado que el motor de renderizado de Microsoft Outlook en Windows (basado en Microsoft Word) carece de soporte para layouts modernos.

2. **Estilos Inline Estrictos:**
   - Todos los estilos tipográficos, espaciados, colores y bordes se definen directamente en la propiedad `style={{ ... }}` de cada nodo JSX.
   - Se prescinde de clases externas (ej. Tailwind CSS o CSS-in-JS con hojas de estilo en el `<head>`), ya que clientes como Gmail eliminan etiquetas `<style>` que superen límites de tamaño o contengan selectores complejos.

3. **Compatibilidad Verificada con Clientes Estrictos:**
   - **Gmail (Web, Android, iOS):** Soporte total; mantiene los estilos inline y preserva la alineación centrada.
   - **Microsoft Outlook (Windows Desktop 2016+, Mac, Outlook.com):** Tablas con anchos fijos y `align="center"` para evitar deformación de celdas.
   - **Apple Mail (macOS e iOS):** Soporta escalado fluido y mantiene el contraste bajo modo oscuro nativo.
   - **Yahoo Mail:** Renderizado sin artefactos en cabecera ni scroll horizontal.

---

## 3. Dimensiones y Diseño Responsivo

- **Ancho del Contenedor Principal:** Fijado en un máximo de `600px` (`maxWidth: "600px", width: "100%", margin: "0 auto"`), el estándar de oro de la industria para evitar líneas de texto excesivamente largas en pantallas de escritorio.
- **Comportamiento en Dispositivos Móviles (320px–375px):**
  - La tabla principal se adapta fluidamente al 100% del viewport en pantallas pequeñas.
  - El relleno interno se reduce proporcionalmente (`padding: "24px 12px"` en el contenedor exterior) para prevenir cualquier desplazamiento o scroll horizontal no deseado (*side-scrolling*).
- **Directivas Viewport y Metadatos en `<head>`:**
  ```html
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  ```

---

## 4. Identidad Visual (AKROS Active Lifestyle Club)

La plantilla implementa la paleta cromática y lenguaje corporativo de AKROS Club:

| Token / Elemento | Valor Hex | Uso en Plantilla |
| :--- | :--- | :--- |
| **Lienzo Base** | `#f7f8f5` | Fondo exterior y cajas de detalles |
| **Superficie de Tarjeta** | `#ffffff` | Tarjeta principal y marco de seguridad del QR |
| **Verde Esmeralda** | `#123e30` | Cabecera institucional, títulos H1 y etiquetas destacadas |
| **Lima Cinético** | `#c9ef75` | Badge de confirmación ("Pase Oficial") y subtítulo AKROS |
| **Bordes Sutiles** | `#e2e6df` | Separadores de filas y contornos de tarjetas |
| **Texto Principal** | `#18221c` | Nombres de canchas, valores de reserva |
| **Texto Secundario** | `#5c6f64` / `#46544c` | Descripciones, etiquetas y normas |

---

## 5. Especificación Técnica del Código QR (RNF-05)

El código QR constituye el elemento operativo crítico del correo:
- **Dimensiones:** `220x220px` fijos en el elemento `<img>` con atributos explícitos `width={220}` y `height={220}`.
- **Zona Segura (*Quiet Zone*):** Se encapsula en un contenedor blanco (`#ffffff`) con `padding: 16px` y borde suave `#e2e6df`, garantizando el contraste perimetral necesario para escáneres ópticos de torniquetes.
- **Soporte Dual de Origen de Imagen (`qrCodeSrc`):**
  1. **Data URI (Base64):** Formato `data:image/png;base64,...` para inserción directa en el HTML sin peticiones externas adicionales.
  2. **Content-ID (CID inline):** Formato `cid:ticket-qr` para envío con adjuntos MIME en clientes empresariales que bloquean imágenes remotas o URLs base64 extensas.
- **Instrucción de Operación:** Leyenda visible que instruye al socio a presentar el código directamente ante los torniquetes o el personal de acceso.

---

## 6. Contratos de Tipado y Helpers

### Interfaz `TicketEmailTemplateProps`

```typescript
export interface TicketEmailTemplateProps {
  /** Nombre completo del socio o deportista titular */
  customerName: string;
  /** Identificador formateado del tiquete (ej. "TKT-AKR-9821") */
  ticketCode: string;
  /** Nombre del escenario o cancha asignada (ej. "Pádel Panorámico 1") */
  facilityName: string;
  /** Sede física del complejo (ej. "Sede El Poblado" / "Sede Laureles") */
  venueName: string;
  /** Fecha formateada de la reserva (ej. "24 de Octubre de 2026") */
  bookingDate: string;
  /** Franja horaria del turno (ej. "18:00 - 19:30") */
  timeSlot: string;
  /** Data URI o CID del código QR de acceso (RNF-05) */
  qrCodeSrc: string;
  /** Monto total pagado formateado (ej. "$ 120.000 COP") */
  totalPaid: string;
  /** Estado del pago (por defecto: "PAGADO (Stripe Cashless)") */
  paymentStatus?: string;
}
```

### Compilación a HTML: `renderTicketEmail`

```typescript
import { renderTicketEmail } from "@sportcomplex/automation";

const htmlOutput = renderTicketEmail({
  customerName: "Carlos Mendoza",
  ticketCode: "TKT-AKR-9821",
  facilityName: "Pádel Panorámico 1",
  venueName: "Sede El Poblado",
  bookingDate: "24 de Octubre de 2026",
  timeSlot: "18:00 - 19:30",
  qrCodeSrc: "cid:ticket-qr",
  totalPaid: "$ 120.000 COP",
  paymentStatus: "PAGADO (Stripe Cashless)",
});
```

---

## 7. Normas Rápidas y Pie Institucional

La plantilla incluye un bloque de directrices de convivencia deportiva alineado con `/rules`:
1. **10 minutos de tiempo de gracia:** Recomendación de llegada anticipada para alistamiento.
2. **Calzado deportivo reglamentario:** Obligatoriedad de calzado específico según superficie.
3. **Acceso personal e intransferible:** Carácter único del pase QR.

El pie de página provee el soporte institucional:
- Ubicaciones de sedes físicas en Medellín (Sede El Poblado y Sede Laureles).
- Enlace directo al canal oficial de **WhatsApp Concierge Deportivo** (`https://wa.me/573000000000`).
- Correo de asistencia: `soporte@sportcomplex.club`.

---

## 8. Verificación y Suite de Pruebas Unitarias

La suite de pruebas se localiza en `packages/automation/src/templates/__tests__/TicketEmailTemplate.test.tsx` y valida:
- **Test 1:** Renderizado íntegro de datos del cliente, escenario, tiquete, fecha, horario y marcas AKROS.
- **Test 2:** Presencia de la imagen del QR con atributos de dimensiones (`220x220px`), texto `alt` y compatibilidad con Data URI y CID.
- **Test 3:** Cumplimiento de estándares de email (ausencia de clases externas `class=`, inclusión de `role="presentation"` y estilos inline para contenedor de 600px).
- **Test 4:** Inclusión de las normas de acceso y canales de atención de concierge.

### Comandos de Ejecución

```bash
# Ejecutar suite de pruebas unitarias
pnpm --filter @sportcomplex/automation test

# Verificación de tipado estricto
pnpm --filter @sportcomplex/automation typecheck

# Linting del paquete
pnpm --filter @sportcomplex/automation lint
```

---

## 9. Referencias y Enlaces Relacionados

- [SRS de Producto (HU-39 / RNF-05)](../product/srs.md)
- [Arquitectura de Automatización n8n](./overview.md)
- [Workflows de Despacho n8n](./workflows.md)
- [Reglamentos y Normativa del Complejo](../features/reglamentos.md)
- [Control de Acceso y Validación QR](../features/control-acceso.md)
