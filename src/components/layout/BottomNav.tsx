'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, Wallet, CalendarDays, MessageCircle, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const NAV = [
  { href: '/dashboard', icon: Home,          ko: '홈',    en: 'Home' },
  { href: '/members',   icon: Users,          ko: '회원',  en: 'Members' },
  { href: '/finance',   icon: Wallet,         ko: '재무',  en: 'Finance' },
  { href: '/meetings',  icon: CalendarDays,   ko: '모임',  en: 'Meetings' },
  { href: '/chat',      icon: MessageCircle,  ko: '채팅',  en: 'Chat' },
  { href: '/more',      icon: MoreHorizontal, ko: '더보기', en: 'More' },
]

// 게스트가 접근 가능한 경로 — 홈 / 모임 / 채팅 / 더보기 만
const GUEST_NAV_HREFS = new Set(['/dashboard', '/meetings', '/chat', '/more'])

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const lang     = useAuthStore(s => s.lang)
  const { myClubs, currentClubId } = useAuthStore()
  const myRole   = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const isGuest  = myRole === 'guest'
  const items    = isGuest ? NAV.filter(n => GUEST_NAV_HREFS.has(n.href)) : NAV

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bottom-nav px-3 pb-2">
      <div
        className="rounded-2xl px-2 py-2 flex items-center justify-around"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          boxShadow: '0 -1px 0 rgba(201,168,76,0.08), 0 -8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {items.map(({ href, icon: Icon, ko, en }) => {
          const active = pathname.startsWith(href)
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              style={active ? { background: 'rgba(201,168,76,0.10)' } : undefined}
            >
              {/* 활성 인디케이터 라인 — 골드 */}
              {active && (
                <span
                  className="absolute top-0 left-1/2"
                  style={{
                    width: 22,
                    height: 2,
                    borderRadius: 1,
                    background: 'linear-gradient(90deg, transparent, #e8c96d, transparent)',
                    transform: 'translateX(-50%)',
                  }}
                />
              )}

              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.6}
                style={{
                  color: active ? '#e8c96d' : '#9090a8',
                  transition: 'color 0.15s',
                }}
              />

              <span
                className="text-[10px] font-semibold transition-colors duration-150"
                style={{ color: active ? '#e8c96d' : '#9090a8' }}
              >
                {lang === 'ko' ? ko : en}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
