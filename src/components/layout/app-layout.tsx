import { Outlet } from 'react-router-dom'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SupabaseStatusBanner } from '@/components/supabase-status-banner'

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <SupabaseStatusBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
