import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CommercialRole, Profile } from '@/types/database'

export interface SignUpPayload {
  fullName: string
  email: string
  whatsapp: string
  commercialRole: CommercialRole
  password: string
}

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** true enquanto a sessão inicial ainda está sendo restaurada */
  loading: boolean
  isAuthenticated: boolean
  /** content_admin ou audience_manager, espelha is_concer_staff() no banco */
  isStaff: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (payload: SignUpPayload) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // Antes de db/schemas.sql rodar, a tabela ainda não existe: não quebre a UI.
      console.warn('ConcerFinder: não foi possível carregar o profile.', error.message)
      setProfile(null)
      return
    }

    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      void loadProfile(data.session?.user.id).finally(() => {
        if (active) setLoading(false)
      })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfile(nextSession?.user.id)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/busca`,
        shouldCreateUser: false,
      },
    })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (payload: SignUpPayload) => {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        emailRedirectTo: `${window.location.origin}/busca`,
        // Lido pelo trigger handle_new_user() para popular public.profiles.
        data: {
          full_name: payload.fullName.trim(),
          whatsapp: payload.whatsapp.trim(),
          commercial_role: payload.commercialRole,
        },
      },
    })
    if (error) throw error

    return { needsEmailConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id)
  }, [loadProfile, session?.user.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAuthenticated: Boolean(session),
      isStaff: profile?.role === 'content_admin' || profile?.role === 'audience_manager',
      signInWithPassword,
      signInWithMagicLink,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      signInWithPassword,
      signInWithMagicLink,
      signUp,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
