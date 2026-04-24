'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import AppHeader from '@/components/layout/AppHeader'
import BottomNav from '@/components/layout/BottomNav'
import NotificationModals from '@/components/ui/NotificationModals'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setUser, setMyClubs, setCurrentClub, currentClubId } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (profile) setUser(profile)

      const { data: memberships } = await supabase
        .from('club_memberships')
        .select('club_id, role, clubs(id, name, name_en, logo_url)')
        .eq('user_id', user.id)
        .eq('status', 'approved')

      if (memberships && memberships.length > 0) {
        const clubs = memberships.map((m: any) => ({
          id: m.clubs.id,
          name: m.clubs.name,
          name_en: m.clubs.name_en,
          role: m.role,
          logo_url: m.clubs.logo_url,
        }))
        setMyClubs(clubs)
        if (!currentClubId) setCurrentClub(clubs[0].id)
      } else {
        // 가입된 클럽 없음 → 온보딩으로
        if (pathname !== '/onboarding') {
          router.replace('/onboarding')
        }
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  const isOnboarding = pathname === '/onboarding'

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      {!isOnboarding && <AppHeader />}
      <main className={`flex-1 overflow-y-auto ${isOnboarding ? '' : 'pb-20'}`}>
        {children}
      </main>
      {!isOnboarding && <BottomNav />}
      <NotificationModals />
    </div>
  )
}
