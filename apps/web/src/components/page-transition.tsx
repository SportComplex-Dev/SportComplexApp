'use client'

import React, { type ReactNode } from 'react'

export interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * PageTransition component (SCRUM-173)
 * Provides smooth, flicker-free view transitions between routes.
 * Driven by standard CSS tokens and keyframes (--motion-duration-normal and --motion-ease-out).
 * Automatically respects prefers-reduced-motion: reduce without layout shifts.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`page-transition ${className}`.trim()}>
      {children}
    </div>
  )
}
