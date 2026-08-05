import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Indica se as variáveis de ambiente do Supabase estão presentes.
 * A UI usa isso para exibir um aviso claro em vez de quebrar em runtime.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

if (!isSupabaseConfigured) {
  console.error(
    'ConcerFinder: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env (veja .env.example).',
  )
}

/**
 * Cliente único do Supabase para o frontend.
 * Usa apenas a chave publishable/anon, a secret key nunca chega ao navegador
 * (SKILL.md: escrita sensível roda com service_role dentro de Edge Functions).
 */
export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseKey ?? 'missing-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export const SUPABASE_URL = supabaseUrl
