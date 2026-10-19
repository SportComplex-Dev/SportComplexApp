'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  construirTicketComprobante,
  escposImagen,
  prepararEnvio,
  type TicketComprobanteInput,
} from '@sportcomplex/printing'
import {
  enviarPorBluetooth,
  impresoraBluetoothAutorizada,
  PrinterError,
  soportaWebBluetooth,
  solicitarImpresoraBluetooth,
  type BleDeviceLike,
} from '@sportcomplex/printing/bluetooth'
import {
  enviarAImpresora,
  impresoraAutorizada,
  soportaWebUsb,
  solicitarImpresora,
  type UsbDeviceLike,
} from '@sportcomplex/printing/webusb'

export type ThermalPrinterStatus = 'cargando' | 'no-soportado' | 'sin-emparejar' | 'lista' | 'imprimiendo'
export type ThermalPrinterTransport = 'bluetooth' | 'usb'

type Conexion =
  | { transport: 'bluetooth'; device: BleDeviceLike }
  | { transport: 'usb'; device: UsbDeviceLike }

export interface ThermalPrinter {
  status: ThermalPrinterStatus
  /** Medio de la impresora emparejada. */
  transport: ThermalPrinterTransport | null
  /** Medios que soporta este navegador (WebUSB / Web Bluetooth). */
  available: readonly ThermalPrinterTransport[]
  /** Nombre del dispositivo emparejado. */
  deviceName: string | null
  /** Último error legible para el operador. */
  error: string | null
  /** Abre el selector del navegador para ese medio (debe llamarse desde un clic). */
  pair: (transport: ThermalPrinterTransport) => Promise<void>
  /** Dibuja el ticket y lo envía a la impresora. Devuelve `true` si salió a la impresora. */
  print: (comprobante: TicketComprobanteInput) => Promise<boolean>
}

function mensaje(e: unknown): string {
  return e instanceof PrinterError ? e.message : 'No se pudo imprimir el ticket.'
}

function nombre(c: Conexion | null): string | null {
  if (!c) return null
  return (c.transport === 'usb' ? c.device.productName : c.device.name) ?? null
}

/**
 * Impresora térmica de la caja (DIG-ISH58, 58 mm) por Web Bluetooth (BLE) o
 * WebUSB, la que el operador empareje. Solo se usa en el POS: imprimir
 * tickets es exclusivo del operador; el cliente solo descarga el PDF.
 */
export function useThermalPrinter(): ThermalPrinter {
  const [conexion, setConexion] = useState<Conexion | null>(null)
  const [available, setAvailable] = useState<ThermalPrinterTransport[]>([])
  const [status, setStatus] = useState<ThermalPrinterStatus>('cargando')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const medios: ThermalPrinterTransport[] = [
      ...(soportaWebBluetooth() ? (['bluetooth'] as const) : []),
      ...(soportaWebUsb() ? (['usb'] as const) : []),
    ]
    setAvailable(medios)
    if (medios.length === 0) {
      setStatus('no-soportado')
      return
    }
    let active = true
    // Recupera la impresora ya autorizada (USB primero: no necesita reconectar por radio).
    const recuperar = async (): Promise<Conexion | null> => {
      const usb = medios.includes('usb') ? await impresoraAutorizada().catch(() => null) : null
      if (usb) return { transport: 'usb', device: usb }
      const ble = medios.includes('bluetooth') ? await impresoraBluetoothAutorizada().catch(() => null) : null
      return ble ? { transport: 'bluetooth', device: ble } : null
    }
    void recuperar().then((c) => {
      if (!active) return
      setConexion(c)
      setStatus(c ? 'lista' : 'sin-emparejar')
    })
    return () => {
      active = false
    }
  }, [])

  const pair = useCallback(async (transport: ThermalPrinterTransport) => {
    setError(null)
    try {
      setConexion(
        transport === 'usb'
          ? { transport, device: await solicitarImpresora() }
          : { transport, device: await solicitarImpresoraBluetooth() },
      )
      setStatus('lista')
    } catch (e) {
      setError(mensaje(e))
    }
  }, [])

  const print = useCallback(
    async (comprobante: TicketComprobanteInput) => {
      if (!conexion) {
        setError(new PrinterError('PRINTER_NOT_PAIRED').message)
        return false
      }
      setError(null)
      setStatus('imprimiendo')
      try {
        const bytes = prepararEnvio(escposImagen(construirTicketComprobante(comprobante)))
        if (conexion.transport === 'usb') await enviarAImpresora(conexion.device, bytes)
        else await enviarPorBluetooth(conexion.device, bytes)
        return true
      } catch (e) {
        setError(mensaje(e))
        return false
      } finally {
        setStatus('lista')
      }
    },
    [conexion],
  )

  return {
    status,
    transport: conexion?.transport ?? null,
    available,
    deviceName: nombre(conexion),
    error,
    pair,
    print,
  }
}
