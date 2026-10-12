import type { LucideIcon } from 'lucide-react'

export function IconBox({
  icon: Icon,
  tone = 'lime',
  className = '',
}: {
  icon: LucideIcon
  tone?: string
  className?: string
}) {
  return (
    <span className={`icon-box tone-${tone} ${className}`}>
      <Icon size={20} strokeWidth={1.8} />
    </span>
  )
}
