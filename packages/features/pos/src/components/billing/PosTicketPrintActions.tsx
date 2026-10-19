'use client'

import { Button } from '@sportcomplex/ui'
import { Bluetooth, Download, Loader2, Printer, Usb } from 'lucide-react'
import type { TicketComprobanteInput } from '@sportcomplex/printing'
import type { ThermalPrinter, ThermalPrinterTransport } from '../../hooks/useThermalPrinter'

export interface PosTicketPrintActionsProps {
  comprobante: TicketComprobanteInput
  printer: ThermalPrinter
  onPrinted?: () => void
}

const MEDIOS: Record<ThermalPrinterTransport, { label: string; Icon: typeof Usb }> = {
  bluetooth: { label: 'Bluetooth', Icon: Bluetooth },
  usb: { label: 'USB', Icon: Usb },
}

/** Botones de impresión del operador: térmica por Bluetooth o USB, y PDF de respaldo. */
export function PosTicketPrintActions({ comprobante, printer, onPrinted }: PosTicketPrintActionsProps) {
  const pdfUrl = `/api/pdf/receipt/file?reservaId=${encodeURIComponent(comprobante.reserva.id)}&destinatario=POS`
  const busy = printer.status === 'imprimiendo'
  const emparejada = printer.status === 'lista' || busy

  return (
    <div className="flex flex-col gap-2">
      {emparejada && (
        <Button
          id="btn-print-ticket"
          variant="brand"
          size="default"
          type="button"
          disabled={busy}
          className="w-full text-xs font-semibold gap-2"
          onClick={async () => {
            if (await printer.print(comprobante)) onPrinted?.()
          }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
          {busy ? 'Imprimiendo…' : 'Imprimir ticket'}
        </Button>
      )}

      {printer.status === 'sin-emparejar' && (
        <div className="flex gap-2">
          {printer.available.map((t) => {
            const { label, Icon } = MEDIOS[t]
            return (
              <Button
                key={t}
                id={`btn-pair-printer-${t}`}
                variant="brand"
                size="default"
                type="button"
                className="flex-1 text-xs font-semibold gap-2"
                onClick={() => void printer.pair(t)}
              >
                <Icon size={15} /> Emparejar por {label}
              </Button>
            )
          })}
        </div>
      )}

      {printer.status === 'no-soportado' && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 text-center">
          Este navegador no puede usar la impresora térmica. Abra el POS en Chrome o Edge.
        </p>
      )}

      <a
        id="btn-download-ticket-pdf"
        href={pdfUrl}
        download
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-soft)]"
      >
        <Download size={15} /> Descargar PDF (58 mm)
      </a>

      {emparejada && printer.transport && (
        <p className="text-[10px] text-[var(--subtle)] text-center">
          Impresora: {printer.deviceName ?? 'sin nombre'} ({MEDIOS[printer.transport].label})
          {printer.available.map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy}
              className="ml-2 underline hover:text-[var(--ink)]"
              onClick={() => void printer.pair(t)}
            >
              {t === printer.transport ? 'Cambiar' : `Usar ${MEDIOS[t].label}`}
            </button>
          ))}
        </p>
      )}
      {printer.error && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 text-center">
          {printer.error}
        </p>
      )}
    </div>
  )
}
