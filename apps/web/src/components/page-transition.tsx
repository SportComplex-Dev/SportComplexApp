'use client'

import React, { type ReactNode } from 'react'

export interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * PageTransition Component (SCRUM-173)
 * Semantic view wrapper used across route group templates.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`page-transition w-full ${className}`.trim()}>
      {children}
    </div>
  )
}
