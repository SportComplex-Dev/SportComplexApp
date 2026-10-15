import { PageTransition } from '@/components/layout/page-transition'

export default function StaffTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}

