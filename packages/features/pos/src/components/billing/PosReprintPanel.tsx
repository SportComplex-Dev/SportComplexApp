'use client'

import { useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@sportcomplex/ui'
import { Loader2, ScanLine } from 'lucide-react'
import type { TicketComprobanteInput } from '@sportcomplex/printing'
import type { ThermalPrinter } from '../../hooks/useThermalPrinter'
import { buscarComprobanteParaReimpresion } from '../../services/ticketReprint'
import { PosTicketPreview } from './PosTicketPreview'
import { PosTicketPrintActions } from './PosTicketPrintActions'

export interface PosReprintPanelProps {
  printer: ThermalPrinter
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void
}

/**
 * Ticket en papel de una reserva ya hecha (p. ej. online desde el portal): el
 * operador lee el QR del pase del cliente con el lector o escribe su código.
 */
export function PosReprintPanel({ printer, notify }: PosReprintPanelProps) {
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [comprobante, setComprobante] = useState<TicketComprobanteInput | null>(null)

  const buscar = async () => {
    if (!codigo.trim()) return
    setBuscando(true)
    setComprobante(null)
    try {
      setComprobante(await buscarComprobanteParaReimpresion(codigo))
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se encontró la reserva.', 'error')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)]">
      <CardHeader className="pb-3 border-b border-[var(--line)]">
        <CardTitle className="text-base flex items-center gap-2">
          <ScanLine size={16} /> Imprimir ticket de una reserva
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void buscar()
          }}
        >
          <label htmlFor="pos-reprint-code" className="sr-only">
            Código del pase
          </label>
          <Input
            id="pos-reprint-code"
            placeholder="Escanee el QR del pase o pegue el código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="off"
          />
          <Button type="submit" variant="outline" disabled={buscando || !codigo.trim()} className="text-xs">
            {buscando ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
          </Button>
        </form>

        {comprobante && !comprobante.qr && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Esta reserva aún no tiene pase emitido (estado {comprobante.reserva.estado}); no se puede imprimir.
          </p>
        )}
        {comprobante?.qr && (
          <>
            <div className="rounded-xl bg-[var(--surface-soft)] p-3">
              <PosTicketPreview comprobante={comprobante} />
            </div>
            <PosTicketPrintActions
              comprobante={comprobante}
              printer={printer}
              onPrinted={() => notify('Ticket enviado a la impresora.', 'success')}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
