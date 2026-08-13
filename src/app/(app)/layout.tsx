'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import AppHeader from '@/components/layout/AppHeader'
import BottomNav from '@/components/layout/BottomNav'
import NotificationModals from '@/components/ui/NotificationModals'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { setUser, setMyClubs, setCurrentClub } = useAuthStore()
  const userIdRef   = useRef<string | null>(null)
  const initialized = useRef(false)

  // ── 프로필만 다시 읽기 (is_developer 등 즉시 반영) ──────────────
  async function refreshProfile(supabase: ReturnType<typeof createClient>, uid: string) {
    const { data: profile } = await supabase.from('users').select('*').eq('id', uid).single()
    if (profile) setUser(profile)
  }

  // ── 클럽 목록 다시 읽기 (멤버십 변경 반영) ──────────────────────
  async function refreshClubs(supabase: ReturnType<typeof createClient>, uid: string) {
    const { data: memberships } = await supabase
      .from('club_memberships')
      .select('club_id, role, clubs(id, name, name_en, logo_url)')
      .eq('user_id', uid)
      .eq('status', 'approved')

    if (!memberships || memberships.length === 0) {
      if (pathname !== '/onboarding') router.replace('/onboarding')
      return
    }

    const clubs = memberships.map((m: any) => ({
      id: m.clubs.id,
      name: m.clubs.name,
      name_en: m.clubs.name_en,
      role: m.role,
      logo_url: m.clubs.logo_url,
    }))
    setMyClubs(clubs)

    // ── 클럽 선택 절대 고정 ─────────────────────────────────────────
    // localStorage에서 직접 읽어 사용자가 선택한 클럽만 유지
    const saved   = useAuthStore.getState().currentClubId
    const isValid = clubs.some(c => c.id === saved)
    if (!saved || !isValid) setCurrentClub(clubs[0].id)
    // isValid이면 절대 건드리지 않음
  }

  // ── 최초 초기화 ─────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      userIdRef.current = user.id

      await refreshProfile(supabase, user.id)
      await refreshClubs(supabase, user.id)
    }

    init()

    // 로그아웃 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        initialized.current = false
        userIdRef.current   = null
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── 페이지 이동마다 프로필 + 클럽 갱신 ──────────────────────────
  useEffect(() => {
    const uid = userIdRef.current
    if (!uid) return
    const supabase = createClient()
    refreshProfile(supabase, uid)
    refreshClubs(supabase, uid)
  }, [pathname])

  // ── 앱이 포그라운드로 돌아올 때 갱신 (탭 전환 / 화면 복귀) ──────
  useEffect(() => {
    function onVisible() {
      const uid = userIdRef.current
      if (!uid || document.visibilityState !== 'visible') return
      const supabase = createClient()
      refreshProfile(supabase, uid)
      refreshClubs(supabase, uid)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
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
