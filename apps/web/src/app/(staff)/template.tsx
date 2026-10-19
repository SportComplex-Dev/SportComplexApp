import { AppToast } from '@/components/feedback/app-toast'
import { PageTransition } from '@/components/layout/page-transition'

export default function StaffTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageTransition>{children}</PageTransition>
      {/* /pos y /scanner usan notify(): sin esto los avisos no se veían */}
      <AppToast />
    </>
  )
}
