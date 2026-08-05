import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Tema claro/escuro do ConcerFinder.
 *
 * Três estados: 'light', 'dark' e 'system'. O padrão é 'system', que segue a
 * preferência do sistema operacional e reage quando ela muda ao vivo.
 * A escolha fica no localStorage.
 */

export type Theme = 'light' | 'dark' | 'system'

export interface ThemeContextValue {
  theme: Theme
  /** O tema realmente aplicado agora ('system' já resolvido). */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'concerfinder-theme'

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function lerTemaSalvo(): Theme {
  if (typeof localStorage === 'undefined') return 'system'
  const salvo = localStorage.getItem(STORAGE_KEY)
  return salvo === 'light' || salvo === 'dark' || salvo === 'system' ? salvo : 'system'
}

function preferenciaDoSistema(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(lerTemaSalvo)
  const [sistema, setSistema] = useState<'light' | 'dark'>(preferenciaDoSistema)

  // acompanha a mudança de tema do sistema operacional ao vivo
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = (e: MediaQueryListEvent) => setSistema(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [])

  const resolvedTheme = theme === 'system' ? sistema : theme

  // aplica a classe que o Tailwind usa e sincroniza o color-scheme nativo
  // (controla a aparência de scrollbar, inputs e do próprio player embutido)
  useEffect(() => {
    const raiz = document.documentElement
    raiz.classList.toggle('dark', resolvedTheme === 'dark')
    raiz.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((novo: Theme) => {
    setThemeState(novo)
    try {
      localStorage.setItem(STORAGE_KEY, novo)
    } catch {
      // navegação privada pode bloquear o storage; o tema segue na sessão
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
