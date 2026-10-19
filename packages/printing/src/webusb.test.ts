import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enviarAImpresora,
  impresoraAutorizada,
  PrinterError,
  salidaDeImpresion,
  solicitarImpresora,
  type UsbDeviceLike,
  type UsbInterfaceLike,
} from "./webusb";

const IFACE_HID: UsbInterfaceLike = {
  interfaceNumber: 0,
  alternate: { interfaceClass: 3, endpoints: [{ endpointNumber: 1, direction: "out", type: "bulk" }] },
};
const IFACE_PRINTER: UsbInterfaceLike = {
  interfaceNumber: 1,
  alternate: {
    interfaceClass: 7,
    endpoints: [
      { endpointNumber: 2, direction: "in", type: "bulk" },
      { endpointNumber: 3, direction: "out", type: "bulk" },
    ],
  },
};

function fakeDevice(over: Partial<UsbDeviceLike> = {}) {
  const calls: string[] = [];
  const chunks: number[] = [];
  const device: UsbDeviceLike = {
    opened: false,
    configuration: { interfaces: [IFACE_HID, IFACE_PRINTER] },
    open: async () => void calls.push("open"),
    close: async () => void calls.push("close"),
    selectConfiguration: async () => void calls.push("select"),
    claimInterface: async (n) => void calls.push(`claim:${n}`),
    releaseInterface: async (n) => void calls.push(`release:${n}`),
    transferOut: async (ep, data) => {
      calls.push(`out:${ep}`);
      chunks.push((data as Uint8Array).length);
      return { status: "ok" };
    },
    ...over,
  };
  return { device, calls, chunks };
}

describe("WebUSB", () => {
  it("prefiere el endpoint bulk OUT de la interfaz de clase impresora", () => {
    assert.deepEqual(salidaDeImpresion(fakeDevice().device), { interfaceNumber: 1, endpointNumber: 3 });
  });

  it("envía en trozos de 4 KiB y libera la interfaz y el dispositivo", async () => {
    const { device, calls, chunks } = fakeDevice();
    await enviarAImpresora(device, new Uint8Array(10_000));
    assert.deepEqual(chunks, [4096, 4096, 1808]);
    assert.deepEqual(calls, ["open", "claim:1", "out:3", "out:3", "out:3", "release:1", "close"]);
  });

  it("informa PRINTER_BUSY cuando el sistema tiene tomada la interfaz", async () => {
    const { device, calls } = fakeDevice({
      claimInterface: async () => {
        throw new Error("Unable to claim interface.");
      },
    });
    await assert.rejects(enviarAImpresora(device, new Uint8Array(1)), (e: unknown) => {
      assert.ok(e instanceof PrinterError);
      assert.equal(e.code, "PRINTER_BUSY");
      return true;
    });
    assert.equal(calls.at(-1), "close");
  });

  it("informa PRINTER_TRANSFER_FAILED si la impresora rechaza un trozo", async () => {
    const { device } = fakeDevice({ transferOut: async () => ({ status: "stall" }) });
    await assert.rejects(enviarAImpresora(device, new Uint8Array(1)), { code: "PRINTER_TRANSFER_FAILED" });
  });

  it("sin WebUSB falla con PRINTER_NOT_SUPPORTED", async () => {
    await assert.rejects(impresoraAutorizada(null), { code: "PRINTER_NOT_SUPPORTED" });
    await assert.rejects(solicitarImpresora(null), { code: "PRINTER_NOT_SUPPORTED" });
  });

  it("si el operador cierra el selector, queda como no emparejada", async () => {
    const usb = {
      getDevices: async () => [],
      requestDevice: async () => {
        throw new DOMException("No device selected.", "NotFoundError");
      },
    };
    await assert.rejects(solicitarImpresora(usb), { code: "PRINTER_NOT_PAIRED" });
    assert.equal(await impresoraAutorizada(usb), null);
  });
});
