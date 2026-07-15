'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import AppHeader from '@/components/layout/AppHeader'
import BottomNav from '@/components/layout/BottomNav'
import NotificationModals from '@/components/ui/NotificationModals'
import ForcePasswordSetup from '@/components/ui/ForcePasswordSetup'
import UnpaidLoginNotice from '@/components/ui/UnpaidLoginNotice'
import { setAppBadge, getLastSeen } from '@/lib/appBadge'
import { useChatNotify, playChatPing } from '@/lib/chatNotifications'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setUser, setMyClubs, setCurrentClub, currentClubId, user } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      let { data: { user } } = await supabase.auth.getUser()
      // 세션 만료/유실 → localStorage 저장 자격증명으로 silent 재로그인 시도
      // (사용자가 명시적 로그아웃을 했다면 자격증명이 지워져 있으므로 자동 로그인 안 됨)
      if (!user) {
        try {
          const email = typeof window !== 'undefined' ? localStorage.getItem('isgolf-saved-email') : null
          const pwEnc = typeof window !== 'undefined' ? localStorage.getItem('isgolf-saved-pw') : null
          if (email && pwEnc) {
            const password = atob(pwEnc)
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            if (!error && data.user) {
              user = data.user
              console.log('[auth] auto re-logged in silently')
            }
          }
        } catch { /* silent */ }
      }
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

  // 푸시 자동 복구 — 알림받기를 "켠" 회원(서버 push_opt_in=true)만, PWA/앱 열기만으로
  // SW 재등록으로 사라진 로컬 구독을 조용히 재생성한다. 사용자가 직접 해지(opt_in=false)했으면
  // 절대 되살리지 않는다. → "해지 전까지 유지" + "해지하면 그때만 비활성" 을 서버 기준으로 보장.
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        if (typeof window === 'undefined') return
        // 네이티브 앱 — FCM/APNs 로 등록하고 웹푸시는 건너뜀(채널 배타 → 중복 알림 방지)
        const { isNativeApp } = await import('@/lib/native')
        if (isNativeApp()) {
          const { registerNativePush } = await import('@/lib/push-native')
          await registerNativePush()
          return
        }
        if (!('Notification' in window)) return
        if (Notification.permission !== 'granted') return  // 권한 없으면 조용히 스킵(재요청 안 함)
        const { getPushStatus, getServerPushState, subscribePush } = await import('@/lib/push')
        // 서버 진실의 원천: 사용자가 알림받기를 켠 상태인가?
        const { opted_in } = await getServerPushState()
        if (!opted_in) return                          // 안 켰거나 해지함 → 자동 재구독 금지
        const status = await getPushStatus()
        if (status === 'default') {
          // opt-in 상태인데 로컬 구독이 없거나 stale → 조용히 재구독(상태 유지)
          const r = await subscribePush()
          if (r.ok) console.log('[push] auto-resubscribed silently (opted-in)')
          else console.warn('[push] auto-resubscribe failed:', r.reason)
        }
      } catch (e) { console.warn('[push auto]', e) }
    })()
  }, [user?.id])

  // 접속 표시 — 본인 last_seen_at 갱신 (30초마다 + 탭 visible 전환 / 페이지 변경 시 즉시)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    function ping() {
      if (cancelled) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      fetch('/api/users/heartbeat', { method: 'POST', keepalive: true }).catch(() => {})
    }
    ping()
    const id = setInterval(ping, 30_000)
    function onWake() { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [user?.id])

  // 페이지 변경 시에도 즉시 heartbeat — 회원이 메뉴 이동할 때마다 갱신되어 거의 실시간
  useEffect(() => {
    if (!user?.id) return
    fetch('/api/users/heartbeat', { method: 'POST', keepalive: true }).catch(() => {})
  }, [pathname, user?.id])

  // 앱 배지: 마지막 방문 이후 새로 올라온 공지/경조사 개수 + 채팅 미확인
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
      const chatUnread = useChatNotify.getState().totalUnread
      const total = (noticeCount ?? 0) + (eventCount ?? 0) + chatUnread
      setAppBadge(total)
    }

    refreshBadge()
    function onWake() { if (document.visibilityState === 'visible') refreshBadge() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    const id = setInterval(refreshBadge, 5 * 60_000)  // 5분마다 백그라운드 갱신
    // 채팅 unread 변경 시 즉시 배지 갱신
    const unsub = useChatNotify.subscribe(() => refreshBadge())
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      clearInterval(id)
      unsub()
    }
  }, [currentClubId, user?.id])

  // ── 채팅 글로벌 알림 ─────────────────────────────────────────────────
  // 모든 방의 새 메시지를 실시간 구독 → 활성 방이 아니면 카운트 + 소리
  useEffect(() => {
    const userId = user?.id
    if (!userId) return
    const supabase = createClient()
    let cancelled = false

    // 초기 unread 카운트 계산 — 내가 속한 모든 방에서 last_read_at 이후 메시지 수
    async function loadInitialUnread() {
      try {
        const { data: rooms } = await supabase
          .from('chat_room_members')
          .select('room_id, last_read_at')
          .eq('user_id', userId!)
        if (!rooms || cancelled) return
        let total = 0
        for (const r of rooms) {
          const since = (r as any).last_read_at ?? new Date(0).toISOString()
          const { count } = await supabase.from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', r.room_id)
            .gt('created_at', since)
            .neq('user_id', userId!)
          total += count ?? 0
        }
        if (!cancelled) useChatNotify.getState().setUnread(total)
      } catch (e) { console.warn('[chat unread init]', e) }
    }
    loadInitialUnread()

    // 실시간 구독 — 모든 chat_messages INSERT (필터는 클라에서)
    const channel = supabase.channel(`user-chat-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          try {
            const msg = payload.new as any
            if (!msg || msg.user_id === userId) return  // 본인 메시지는 무시
            // 내가 이 방의 멤버인지 확인
            const { data: mem } = await supabase
              .from('chat_room_members')
              .select('room_id').eq('room_id', msg.room_id).eq('user_id', userId!).maybeSingle()
            if (!mem) return
            // 현재 보고 있는 방이면 즉시 읽음 처리 + 카운트 추가 안 함
            if (useChatNotify.getState().activeRoomId === msg.room_id) {
              await supabase.from('chat_room_members')
                .update({ last_read_at: new Date().toISOString() })
                .eq('room_id', msg.room_id).eq('user_id', userId!)
              return
            }
            // 그 외에는 핑 + 카운트 + 배지
            playChatPing()
            useChatNotify.getState().setUnread(useChatNotify.getState().totalUnread + 1)
          } catch (e) { console.warn('[chat realtime]', e) }
        }
      ).subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const isOnboarding = pathname === '/onboarding'

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      {!isOnboarding && <AppHeader />}
      <main className={`flex-1 overflow-y-auto ${isOnboarding ? '' : 'pb-20'}`}>
        {children}
      </main>
      {!isOnboarding && <BottomNav />}
      <NotificationModals />
      {/* 첫 로그인 후 강제 비밀번호 설정 — users.password_set === false 일 때 화면 전체를 덮음 */}
      <ForcePasswordSetup />
      {/* 본인 회비/벌금 미납 알림 — 1세션 1회 노출 */}
      <UnpaidLoginNotice />
    </div>
  )
}
