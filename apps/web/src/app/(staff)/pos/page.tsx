'use client'

import { useApp } from '@/components/layout/app-provider'
import {
  PosHeader,
  PosSaleWizard,
  PosReprintPanel,
  usePosSession,
  useThermalPrinter,
} from '@sportcomplex/features-pos'

export default function PosPage() {
  const { session, notify, logout } = useApp()
  const pos = usePosSession({ notify })
  const printer = useThermalPrinter()

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] pb-16">
      <PosHeader
        sellerName={session?.name || 'Andrés Muñoz'}
        sellerRole={session?.role || 'Empleado_Vendedor'}
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4 flex flex-col gap-8">
        <PosSaleWizard sellerName={session?.name} pos={pos} printer={printer} />
        <PosReprintPanel printer={printer} notify={notify} />
      </div>
    </main>
  )
}

