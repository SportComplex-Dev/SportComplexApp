'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useOptionalApp } from '@/components/app-provider'

export function useThemeToggle() {
  const app = useOptionalApp()
  const [localDark, setLocalDark] = useState(false)

  useEffect(() => {
    if (app) return
    const root = document.documentElement
    const isDark = root.classList.contains('dark') || localStorage.getItem('akros_theme') === 'dark'
    setLocalDark(isDark)
    root.classList.toggle('dark', isDark)
    document.querySelector('.club-app')?.classList.toggle('dark', isDark)
  }, [app])

  if (app) {
    return {
      dark: app.dark,
      toggleTheme: () => app.setDark(!app.dark),
    }
  }

  const toggleTheme = () => {
    const next = !localDark
    setLocalDark(next)
    document.documentElement.classList.toggle('dark', next)
    document.querySelector('.club-app')?.classList.toggle('dark', next)
    localStorage.setItem('akros_theme', next ? 'dark' : 'light')
  }

  return { dark: localDark, toggleTheme }
}

export function ThemeToggle({
  dark,
  onToggle,
  floating = false,
}: {
  dark: boolean
  onToggle: () => void
  floating?: boolean
}) {
  return (
    <button
      type="button"
      className={`theme-toggle${floating ? ' auth-theme-toggle' : ''}`}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={onToggle}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
