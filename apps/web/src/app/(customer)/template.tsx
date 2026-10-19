import { PageTransition } from '@/components/layout/page-transition'

export default function CustomerTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}

