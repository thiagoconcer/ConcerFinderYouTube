import { useContext } from 'react'
import { ThemeContext } from '@/contexts/theme-context'
import type { ThemeContextValue } from '@/contexts/theme-context'

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme precisa estar dentro de <ThemeProvider>.')
  }
  return context
}
