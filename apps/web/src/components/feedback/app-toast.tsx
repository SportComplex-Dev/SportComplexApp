'use client'

import { useOptionalApp } from '@/components/layout/app-provider'
import { ToastMessage } from '@/components/feedback/toast-message'

/** Aviso global de `notify()` para las vistas que no lo pintan en su propio layout. */
export function AppToast() {
  const app = useOptionalApp()
  if (!app) return null
  return <ToastMessage message={app.toast.message} kind={app.toast.kind} close={app.closeToast} />
}
