'use client'

import { useApp } from '@/components/layout/app-provider'
import {
  PosHeader,
  PosSaleWizard,
  usePosSession,
} from '@sportcomplex/features-pos'

export default function PosPage() {
  const { session, notify } = useApp()
  const pos = usePosSession({ notify })

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] pb-16">
      <PosHeader sellerName={session?.name} />

      <div className="max-w-7xl mx-auto px-4">
        <PosSaleWizard sellerName={session?.name} pos={pos} />
      </div>
    </main>
  )
}
