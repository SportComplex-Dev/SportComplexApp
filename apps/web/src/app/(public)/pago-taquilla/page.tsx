import { PagoTaquillaMensaje } from '@/app/(public)/pago-taquilla/mensaje'

// Destino de `success_url`/`cancel_url` del cobro con QR del POS (público).
export default async function PagoTaquillaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const { estado } = await searchParams
  return <PagoTaquillaMensaje cancelado={estado === 'cancelado'} />
}
