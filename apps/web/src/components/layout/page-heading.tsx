import type { ReactNode } from 'react'

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="demo-page-heading">
      <div className="min-w-0 flex-1">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="break-words">{title}</h1>
        <p className="break-words">{description}</p>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
    </div>
  )
}
