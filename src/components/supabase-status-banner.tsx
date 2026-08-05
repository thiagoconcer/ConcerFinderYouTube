import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { isSupabaseConfigured, supabase, SUPABASE_URL } from '@/lib/supabase'

type Status =
  | { kind: 'checking' }
  | { kind: 'ok' }
  | { kind: 'missing-env' }
  | { kind: 'missing-schema' }
  | { kind: 'error'; message: string }

/**
 * Diagnóstico de conexão com o Supabase, visível apenas em desenvolvimento.
 * Serve para confirmar, no preview, se o projeto está conectado e se
 * db/schemas.sql já foi aplicado.
 */
export function SupabaseStatusBanner() {
  const [status, setStatus] = useState<Status>({ kind: 'checking' })

  useEffect(() => {
    if (!import.meta.env.DEV) return

    if (!isSupabaseConfigured) {
      setStatus({ kind: 'missing-env' })
      return
    }

    let active = true

    // Consulta leve só para validar credencial e existência do schema.
    // (sem head:true, em 404 o corpo vazio impede a leitura do erro)
    supabase
      .from('videos')
      .select('id')
      .limit(1)
      .then(({ error }) => {
        if (!active) return
        if (!error) {
          setStatus({ kind: 'ok' })
          return
        }
        // PGRST205 = tabela ausente no schema cache; 42P01 = relation does not exist
        if (
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message.includes('does not exist') ||
          error.message.includes('schema cache')
        ) {
          setStatus({ kind: 'missing-schema' })
          return
        }
        setStatus({ kind: 'error', message: error.message })
      })

    return () => {
      active = false
    }
  }, [])

  if (!import.meta.env.DEV || status.kind === 'checking') return null

  const host = SUPABASE_URL?.replace('https://', '') ?? 'não configurado'

  if (status.kind === 'ok') {
    return (
      <div className="border-b bg-muted/40">
        <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-500" />
          Supabase conectado: <code className="font-mono">{host}</code>
        </p>
      </div>
    )
  }

  const messages: Record<Exclude<Status['kind'], 'ok' | 'checking'>, string> = {
    'missing-env':
      'Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env (veja .env.example).',
    'missing-schema':
      'Conectado, mas as tabelas ainda não existem. Rode db/schemas.sql no SQL Editor do Supabase.',
    error: status.kind === 'error' ? `Falha ao consultar o Supabase: ${status.message}` : '',
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-300 sm:px-6">
        <AlertTriangle className="size-3.5 shrink-0" />
        {messages[status.kind]}
      </p>
    </div>
  )
}
