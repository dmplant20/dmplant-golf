'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import AppHeader from '@/components/layout/AppHeader'
import BottomNav from '@/components/layout/BottomNav'
import NotificationModals from '@/components/ui/NotificationModals'
import { setAppBadge, getLastSeen } from '@/lib/appBadge'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setUser, setMyClubs, setCurrentClub, currentClubId, user } = useAuthStore()

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
        // Keep persisted club selection if it's still valid; otherwise fall back to first.
        const stillValid = currentClubId && clubs.some(c => c.id === currentClubId)
        if (!stillValid) setCurrentClub(clubs[0].id)
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

  // Per-club background accent: hash club id → theme 1-4 on document body
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!currentClubId) {
      document.body.removeAttribute('data-club-theme')
      return
    }
    let h = 0
    for (let i = 0; i < currentClubId.length; i++) h = ((h << 5) - h + currentClubId.charCodeAt(i)) | 0
    const theme = (Math.abs(h) % 4) + 1
    document.body.setAttribute('data-club-theme', String(theme))
  }, [currentClubId])

  // 앱 배지: 마지막 방문 이후 새로 올라온 공지/경조사 개수
  useEffect(() => {
    const userId = user?.id
    if (!currentClubId || !userId) return
    let cancelled = false

    async function refreshBadge() {
      const supabase = createClient()
      const since = getLastSeen(userId!, currentClubId!)
      const [{ count: noticeCount }, { count: eventCount }] = await Promise.all([
        supabase.from('announcements')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', currentClubId).gt('created_at', since),
        supabase.from('events')
          .select('*', { count: 'exact', head: true })
          .eq('club_id', currentClubId).gt('created_at', since),
      ])
      if (cancelled) return
      const total = (noticeCount ?? 0) + (eventCount ?? 0)
      setAppBadge(total)
    }

    refreshBadge()
    function onWake() { if (document.visibilityState === 'visible') refreshBadge() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    const id = setInterval(refreshBadge, 5 * 60_000)  // 5분마다 백그라운드 갱신
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      clearInterval(id)
    }
  }, [currentClubId, user?.id])

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
