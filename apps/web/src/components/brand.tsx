'use client'

import Image from 'next/image'
import { cn } from '@sportcomplex/ui'

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 select-none', light ? 'text-white' : 'text-app')}>
      <div className="relative flex items-center">
        <Image
          src={light ? '/images/Akros-logo.png' : '/images/Akros-logo-bosque.png'}
          alt="AKROS Active Lifestyle Club"
          width={40}
          height={32}
          className={cn('object-contain', !light && 'dark:hidden')}
          style={{ width: 'auto', height: 'auto' }}
          priority
        />
        {!light && (
          <Image
            src="/images/Akros-logo.png"
            alt="AKROS Active Lifestyle Club"
            width={40}
            height={32}
            className="hidden dark:block object-contain"
            style={{ width: 'auto', height: 'auto' }}
            priority
          />
        )}
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[19px] font-black tracking-[0.08em] transition-colors">AKROS</span>
        <span className="text-[9px] font-extrabold tracking-[0.18em] uppercase opacity-80">CLUB</span>
      </div>
    </div>
  )
}
