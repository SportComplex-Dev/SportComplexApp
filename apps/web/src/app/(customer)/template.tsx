import { PageTransition } from '@/components/page-transition'

export default function CustomerTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}

