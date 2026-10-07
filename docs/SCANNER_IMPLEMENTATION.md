# TSK-FE-14 — Escáner QR con selección de puesto de turno

## 1) Resumen de la tarea y objetivo RNF-04

La tarea TSK-FE-14 aborda la experiencia de control de acceso para empleados del rol `Empleado_Lector` en AKROS Club. El objetivo principal es permitir:

- Seleccionar un puesto de turno activo.
- Inicializar la cámara solo después de confirmar el puesto.
- Escanear QR de reserva o ticket.
- Validar la correspondencia entre el ticket y la cancha/puesto actual.
- Rechazar accesos inválidos, caducados, ya usados o con cancha incorrecta.
- Registrar un canje seguro con feedback visual y auditivo.

El objetivo de rendimiento RNF-04 indica que la decodificación debe estar por debajo de 400 ms en condiciones normales. Se implementó una configuración agresiva de `html5-qrcode` con `fps` y `qrbox` ajustados para reducir latencia, pero el cumplimiento real depende del hardware, iluminción y navegador del dispositivo, por lo que no se declara como garantía empírica garantizada.

## 2) Tecnologías aplicadas

- `html5-qrcode`: lectura de QR desde la cámara del dispositivo.
- `framer-motion`: animaciones suaves para transiciones, modal, overlays y láser de mira.
- Web Audio API nativa: feedback acústico de éxito y error, con toggle de audio.
- `lucide-react`: iconografía consistente con la identidad visual del producto.
- Tailwind CSS: sistema visual y paleta AKROS Club.

## 3) Componentes creados y responsabilidades

### `apps/web/src/app/(staff)/scanner/page.tsx`

Ruta principal del flujo de escáner. Coordina:

- selector de turno
- apertura/cierre de cámara
- estados del ciclo de vida
- feedback auditivo
- validación de ticket
- modal de confirmación
- canje de acceso

### `apps/web/src/components/scanner/shift-selector.tsx`

Selector visual de puestos de turno para elegir la cancha y horario activos antes de abrir la cámara.

### `apps/web/src/components/scanner/scanner-header.tsx`

Cabecera sticky con:

- nombre del turno activo
- estado de la cámara
- toggle de audio
- opción para cambiar de puesto

### `apps/web/src/components/scanner/qr-camera-viewport.tsx`

Contenedor principal del visor QR. Encargado de:

- crear la instancia de `Html5Qrcode`
- iniciar y detener la cámara
- evitar streams duplicados
- evitar múltiples instancias
- configurar `qrbox` y FPS adaptados
- manejar error de acceso a cámara / permisos

### `apps/web/src/components/scanner/ticket-validation-modal.tsx`

Modal accesible para:

- mostrar datos del ticket validado
- revisar titular, cancha, horario y asistentes
- ejecutar “Dar Acceso” con estado de carga
- manejar rechazos con texto + icono + color
- soportar Escape para cerrar y navegación por teclado

### `apps/web/src/components/scanner/use-audio-feedback.ts`

Hook con Web Audio API para sonidos de éxito y error. Respeta el toggle de audio y evita fallos por restricciones de autoplay.

### `apps/web/src/components/scanner/mock-access.ts`

Adaptador temporal para completar el flujo de validación/canje cuando la integración real con TSK-BE-14 no está disponible en frontend.

## 4) Estado de la integración con TSK-BE-14

No existe una integración backend real en este monorepo para la validación de QR de acceso. Por ello, se implementó un mock frontend temporal claramente identificado en:

- `apps/web/src/components/scanner/mock-access.ts`

El payload esperado para el canje real (si el backend lo expone más adelante) debería seguir la forma:

```json
{
  "ticketId": "string",
  "empleadoId": "string",
  "venueId": "string",
  "courtId": "string",
  "scannedAt": "ISO-8601"
}
```

El adaptador mock simula:

- ticket válido
- ticket inválido o malformado
- ticket inexistente
- ticket expirado
- ticket usado
- ticket asociado a otra cancha

La implementación actual usa esos contratos en frontend para completar el flujo UX sin inventar endpoints ni tocar backend compartido.

## 5) Guía de pruebas paso a paso

### Prueba 1 — selección de puesto

1. Abrir `/scanner`.
2. Verificar que la cámara permanece apagada al entrar.
3. Seleccionar un puesto de turno.
4. Confirmar que aparece el visor y que el estado cambia a `starting-camera` / `scanning`.

### Prueba 2 — inicio de cámara

1. Pulsar “Iniciar cámara”.
2. Confirmar que no aparecen múltiples streams.
3. Verificar que la cámara se activa solo después de confirmar el puesto.
4. Mover entre cámaras frontal y trasera y comprobar que no se dupliquen instancias.

### Prueba 3 — QR válido

1. Escanear un código que corresponda a un ticket válido del mismo puesto.
2. Comprobar que la lectura se pausa inmediatamente.
3. Verificar modal con Código de reserva, Titular, Cancha/Instalación, Horario y Asistentes.
4. Pulsar “Dar Acceso”.
5. Confirmar que aparece feedback de éxito y que el estado pasa a `access-granted`.

### Prueba 4 — QR invalido / no reconocido

1. Escanear un QR malformado o inexistente.
2. Confirmar feedback rojo + iconografía + texto explicativo.
3. Verificar que no se cuelga la vista.
4. Pulsar “Escanear siguiente”.

### Prueba 5 — ticket de otra cancha

1. Escanear un ticket asignado a una cancha distinta a la del turno activo.
2. Confirmar que se muestra `ACCESO DENEGADO`.
3. Verificar que no se emite canje exitoso.

### Prueba 6 — ticket usado o expirado

1. Probar ticket expirado y ticket ya usado desde el mock.
2. Confirmar que se muestran mensajes de rechazo y se devuelve a la espera del siguiente QR.

### Prueba 7 — errores de cámara

1. Denegar permisos de cámara en el navegador.
2. Verificar mensaje de error con acción de recuperación.
3. Confirmar que el visor no queda en estado inconsistente.

### Prueba 8 — audio

1. Activar el audio desde el header.
2. Escanear un QR exitoso y uno inválido.
3. Confirmar que el audio reproduce el patrón correcto sin bloquear la UI.

## 6) Estado final del cumplimiento

La implementación frontend de la tarea TSK-FE-14 queda completada en interfaz, flujo UX, estados, estilos visuales y flujo de acceso con mock temporal. La integración efectiva con TSK-BE-14 deberá conectarse cuando el backend exponga el contrato real y se podrá reemplazar el adaptador mock sin alterar la capa UI.
