# Impresora térmica de taquilla (Bluetooth o USB)

> Estado: vigente 2026-10-19

Configuración, una sola vez por caja, para que el POS (`/pos`) imprima tickets en la **DIG-ISH58** (58 mm, ESC/POS) desde el navegador, por **Bluetooth** o por **USB**. La decisión está en el [ADR 009](../architecture/adrs/009-impresion-termica-navegador.md).

## Requisitos

- **Chrome o Edge** (Web Bluetooth y WebUSB no existen en Firefox ni Safari).
- **Contexto seguro**: el dominio HTTPS de producción (Caddy) o `http://localhost` en desarrollo.
- Usuario con rol `Empleado_Vendedor` o `Administrador`.

## Bluetooth (recomendado)

La DIG-ISH58 anuncia dos dispositivos: `Printer_xxxx` (Bluetooth clásico, el que usa CUPS por `/dev/rfcomm0`) y `PrinterLE_xxxx` (BLE, el que usa el navegador). No hay que emparejarla en el sistema operativo ni quitársela a CUPS: los dos caminos conviven.

1. Encender la impresora cerca de la caja.
2. **Solo en Linux:** si el POS dice que el navegador no puede usar la impresora, activar `chrome://flags/#enable-experimental-web-platform-features` y reiniciar Chrome.
3. En `/pos`, pulsar **"Emparejar por Bluetooth"** y elegir `PrinterLE_xxxx`.

Un ticket con QR pesa ~75 KB y tarda unos 40 s en salir (probado el 2026-10-19 con MTU 100). Como `getDevices()` de Web Bluetooth todavía es experimental, puede tocar volver a emparejar al recargar el POS.

## USB

WebUSB necesita la interfaz USB libre; los pasos dependen del sistema operativo.

### Linux

Si el módulo `usblp` (CUPS) la tiene tomada, el POS muestra *"La impresora está tomada por el sistema"* (`PRINTER_BUSY`).

1. Identificar la impresora:

   ```bash
   lsusb   # p. ej. "ID 0416:5011 ..." → idVendor=0416, idProduct=5011
   ```

   La DIG-ISH58 es un clon de la Gprinter GP-58 (CUPS la reporta como `usb://Gprinter/GP-58`); use los ids que muestre `lsusb` en esa caja.

2. Regla udev con permiso para el usuario de la caja y sin `usblp`. En `/etc/udev/rules.d/60-sportcomplex-termica.rules`, usar los ids de `lsusb`:

   ```
   SUBSYSTEM=="usb", ATTR{idVendor}=="0416", ATTR{idProduct}=="5011", MODE="0660", TAG+="uaccess"
   ```

3. Quitar `usblp` (si la caja no usa otras impresoras USB por CUPS):

   ```bash
   echo "blacklist usblp" | sudo tee /etc/modprobe.d/no-usblp.conf
   sudo modprobe -r usblp
   sudo udevadm control --reload-rules && sudo udevadm trigger
   ```

   Si se quiere conservar la cola CUPS `DIG-ISH58`, se puede desvincular solo esta impresora en lugar de usar `blacklist`. Ojo: mientras CUPS la tenga, WebUSB no puede abrirla.

### Windows

Windows instala su propio driver de impresión, y WebUSB no puede abrir el dispositivo con él.

1. Instalar [Zadig](https://zadig.akeo.ie/), elegir la impresora en *Options → List All Devices* y reemplazar el driver por **WinUSB**.
2. Desde ese momento la impresora deja de aparecer como impresora de Windows y solo la usa el navegador.

## Emparejar en el POS

1. Abrir `/pos` y hacer una venta, o buscar una reserva en **"Imprimir ticket de una reserva"**.
2. Pulsar **"Emparejar por Bluetooth"** o **"Emparejar por USB"** y elegir la impresora en el diálogo del navegador.
3. Las siguientes impresiones salen con **"Imprimir ticket"**. Junto al nombre de la impresora están los enlaces para cambiarla o usar el otro medio.

Si algo falla, **"Descargar PDF (58 mm)"** genera el mismo ticket en PDF.

## Prueba sin navegador

El bitmap es el mismo que imprime el prototipo `factura58`. Para probar la impresora por CUPS (cola raw; por Bluetooth clásico la cola apunta a `serial:/dev/rfcomm0`):

```bash
lp -d DIG-ISH58 -o raw ticket.bin
```
