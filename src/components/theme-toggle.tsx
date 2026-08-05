import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/use-theme'
import type { Theme } from '@/contexts/theme-context'

const OPCOES: Array<{ valor: Theme; rotulo: string; Icone: typeof Sun }> = [
  { valor: 'light', rotulo: 'Claro', Icone: Sun },
  { valor: 'dark', rotulo: 'Escuro', Icone: Moon },
  { valor: 'system', rotulo: 'Sistema', Icone: Monitor },
]

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Tema: ${OPCOES.find((o) => o.valor === theme)?.rotulo}. Trocar.`}
        >
          {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {OPCOES.map(({ valor, rotulo, Icone }) => (
          <DropdownMenuItem
            key={valor}
            onSelect={() => setTheme(valor)}
            className={theme === valor ? 'bg-accent text-accent-foreground' : undefined}
          >
            <Icone />
            {rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
