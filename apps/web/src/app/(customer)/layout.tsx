import { TopBar } from '@/components/top-bar'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="club-app min-h-screen flex flex-col">
      <TopBar />
      <div className="flex-1">{children}</div>
    </div>

  )
}
