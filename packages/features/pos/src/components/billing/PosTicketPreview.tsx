'use client'

import { useEffect, useMemo, useRef } from 'react'
import { construirTicketComprobante, ticketRgba, type TicketComprobanteInput } from '@sportcomplex/printing'

export interface PosTicketPreviewProps {
  comprobante: TicketComprobanteInput
}

/**
 * Vista previa 1:1 del ticket térmico: el mismo bitmap de 384 puntos que se
 * envía a la impresora, pintado un píxel por punto y escalado por CSS al
 * tamaño físico (0,125 mm por punto sobre un papel de 58 mm).
 */
export function PosTicketPreview({ comprobante }: PosTicketPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ticket = useMemo(() => construirTicketComprobante(comprobante), [comprobante])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { width, height, data } = ticketRgba(ticket)
    canvas.width = width
    canvas.height = height
    ctx.putImageData(new ImageData(data, width, height), 0, 0)
  }, [ticket])

  return (
    <figure className="mx-auto w-[58mm] max-w-full bg-white pt-[4mm] shadow-md" aria-label="Vista previa del ticket">
      <canvas
        ref={canvasRef}
        className="mx-auto block w-[48mm] max-w-full [image-rendering:pixelated]"
        role="img"
        aria-label={`Ticket de la reserva ${comprobante.reserva.id.slice(0, 8).toUpperCase()}`}
      />
      <figcaption className="mt-[3mm] border-t border-dashed border-neutral-400 py-0.5 text-center text-[10px] text-neutral-500">
        ✂ corte · tamaño real 58 mm
      </figcaption>
    </figure>
  )
}
