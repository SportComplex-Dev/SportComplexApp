import { CheckCircle2, CircleX } from 'lucide-react'

/**
 * Mensaje que ve el cliente en su celular al volver de Stripe Checkout tras
 * pagar (o cancelar) un cobro con QR de la taquilla. Sin sesión ni datos: el
 * ticket lo imprime el operador y el pase llega al correo.
 */
export function PagoTaquillaMensaje({ cancelado }: { cancelado: boolean }) {
  const Icon = cancelado ? CircleX : CheckCircle2
  return (
    <section className="section-shell app-page flex flex-col items-center py-16 text-center">
      <Icon
        size={56}
        aria-hidden="true"
        className={cancelado ? 'text-amber-600' : 'text-[#5e8b48] dark:text-[#c9ef75]'}
      />
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        {cancelado ? 'Pago cancelado' : 'Pago recibido'}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--subtle)]">
        {cancelado
          ? 'No se realizó ningún cobro. Vuelve a la taquilla si quieres intentarlo de nuevo.'
          : 'Acércate a la taquilla: tu ticket se está imprimiendo. También te enviaremos el pase a tu correo.'}
      </p>
    </section>
  )
}
