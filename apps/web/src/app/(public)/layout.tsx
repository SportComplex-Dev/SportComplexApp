import { TopBar } from '@/components/top-bar'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="club-app min-h-screen flex flex-col justify-between">
      <TopBar />
      <main className="flex-1">{children}</main>
    </div>
  )
}
