import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enviarPorBluetooth,
  impresoraBluetoothAutorizada,
  PrinterError,
  solicitarImpresoraBluetooth,
  type BleCharacteristicLike,
  type BleDeviceLike,
  type BluetoothLike,
} from "./bluetooth";

function fakeDevice(opts: { servicios?: (number | string)[]; mtu?: number; write?: boolean; connectFails?: boolean } = {}) {
  const { servicios = [0x18f0], mtu = 185, write = true, connectFails = false } = opts;
  const log: string[] = [];
  const chunks: number[] = [];
  const caracteristica: BleCharacteristicLike = {
    properties: { write, writeWithoutResponse: true },
    async writeValueWithResponse(data) {
      const n = (data as Uint8Array).length;
      if (n > mtu - 3) throw new DOMException("GATT operation failed.", "NotSupportedError");
      chunks.push(n);
      log.push("write");
    },
    async writeValueWithoutResponse(data) {
      chunks.push((data as Uint8Array).length);
      log.push("write-no-response");
    },
  };
  const server = {
    connected: false,
    async connect() {
      if (connectFails) throw new DOMException("Connection failed.", "NetworkError");
      log.push("connect");
      return server;
    },
    disconnect() {
      log.push("disconnect");
    },
    async getPrimaryService(uuid: number | string) {
      if (!servicios.includes(uuid)) throw new DOMException("No Services matching UUID found.", "NotFoundError");
      log.push(`service:${uuid}`);
      return { getCharacteristic: async () => caracteristica };
    },
  };
  const device: BleDeviceLike = { id: "printer-1", name: "PrinterLE_55E9", gatt: server };
  return { device, log, chunks };
}

describe("Web Bluetooth", () => {
  it("escribe con respuesta en trozos de 180 bytes por 0x18F0/0x2AF1 y desconecta", async () => {
    const { device, log, chunks } = fakeDevice();
    await enviarPorBluetooth(device, new Uint8Array(500));
    assert.deepEqual(chunks, [180, 180, 140]);
    assert.deepEqual(log, ["connect", `service:${0x18f0}`, "write", "write", "write", "disconnect"]);
  });

  it("si el MTU es el mínimo, baja a trozos de 20 bytes", async () => {
    const { device, chunks } = fakeDevice({ mtu: 23 });
    await enviarPorBluetooth(device, new Uint8Array(50));
    assert.deepEqual(chunks, [20, 20, 10]);
  });

  it("usa el UART ISSC cuando el modelo no trae 0x18F0", async () => {
    const issc = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
    const { device, log } = fakeDevice({ servicios: [issc] });
    await enviarPorBluetooth(device, new Uint8Array(10));
    assert.ok(log.includes(`service:${issc}`));
  });

  it("escribe sin respuesta si la característica no admite escritura con respuesta", async () => {
    const { device, log } = fakeDevice({ write: false });
    await enviarPorBluetooth(device, new Uint8Array(10));
    assert.ok(log.includes("write-no-response"));
  });

  it("sin servicio de impresión falla con PRINTER_NO_ENDPOINT y desconecta", async () => {
    const { device, log } = fakeDevice({ servicios: [] });
    await assert.rejects(enviarPorBluetooth(device, new Uint8Array(10)), { code: "PRINTER_NO_ENDPOINT" });
    assert.equal(log.at(-1), "disconnect");
  });

  it("si no conecta (apagada o lejos) falla con PRINTER_UNREACHABLE", async () => {
    const { device } = fakeDevice({ connectFails: true });
    await assert.rejects(enviarPorBluetooth(device, new Uint8Array(10)), (e: unknown) => {
      assert.ok(e instanceof PrinterError);
      assert.equal(e.code, "PRINTER_UNREACHABLE");
      return true;
    });
  });

  it("pide la impresora filtrando por sus servicios y el prefijo de nombre", async () => {
    let opciones: Parameters<BluetoothLike["requestDevice"]>[0] | undefined;
    const bt: BluetoothLike = {
      requestDevice: async (o) => {
        opciones = o;
        return fakeDevice().device;
      },
    };
    await solicitarImpresoraBluetooth(bt);
    assert.deepEqual(opciones?.filters.at(-1), { namePrefix: "Printer" });
    assert.equal(opciones?.optionalServices.length, 3);
  });

  it("sin Web Bluetooth falla con PRINTER_NOT_SUPPORTED; sin getDevices no recuerda la impresora", async () => {
    await assert.rejects(solicitarImpresoraBluetooth(null), { code: "PRINTER_NOT_SUPPORTED" });
    assert.equal(await impresoraBluetoothAutorizada({ requestDevice: async () => fakeDevice().device }), null);
  });

  it("si el operador cierra el selector, queda como no emparejada", async () => {
    const bt: BluetoothLike = {
      requestDevice: async () => {
        throw new DOMException("User cancelled the requestDevice() chooser.", "NotFoundError");
      },
    };
    await assert.rejects(solicitarImpresoraBluetooth(bt), { code: "PRINTER_NOT_PAIRED" });
  });
});
