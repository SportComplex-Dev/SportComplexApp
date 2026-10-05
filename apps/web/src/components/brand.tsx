'use client'

import { cn } from '@sportcomplex/ui'

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 select-none', light ? 'text-white' : 'text-app')}>
      <img
        src="/images/Akros-logo.png"
        alt="AKROS Active Lifestyle Club"
        width={28}
        height={24}
        className="object-contain"
      />
      <div className="flex flex-col leading-none">
        <span className="text-[16px] font-black tracking-[0.08em]">AKROS</span>
        <span className="text-[8px] font-bold tracking-[0.16em] uppercase opacity-75">Club</span>
      </div>
    </div>
  )
}
