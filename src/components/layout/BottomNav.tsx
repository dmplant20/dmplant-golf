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

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const lang     = useAuthStore(s => s.lang)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bottom-nav px-3 pb-2">
      <div
        className="rounded-2xl px-2 py-2 flex items-center justify-around"
        style={{
          background: 'linear-gradient(180deg, #142014 0%, #0c1a0c 100%)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(74,222,128,0.2)',
          boxShadow: '0 -2px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(74,222,128,0.06), inset 0 1px 0 rgba(74,222,128,0.08)',
        }}
      >
        {NAV.map(({ href, icon: Icon, ko, en }) => {
          const active = pathname.startsWith(href)
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              style={active
                ? {
                    background: 'rgba(74,222,128,0.14)',
                    boxShadow: '0 0 12px rgba(74,222,128,0.12)',
                  }
                : undefined
              }
            >
              {/* active gradient line above icon */}
              {active && (
                <span
                  className="absolute top-0 left-1/2"
                  style={{
                    width: 28,
                    height: 2,
                    borderRadius: 1,
                    background: 'linear-gradient(90deg, transparent, #4ade80, transparent)',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 0 8px rgba(74,222,128,0.6)',
                  }}
                />
              )}

              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.6}
                style={{
                  color: active ? '#4ade80' : '#6b9a6b',
                  transition: 'color 0.15s',
                  filter: active ? 'drop-shadow(0 0 5px rgba(74,222,128,0.5))' : 'none',
                }}
              />

              <span
                className="text-[10px] font-semibold transition-colors duration-150"
                style={{ color: active ? '#4ade80' : '#6b9a6b' }}
              >
                {lang === 'ko' ? ko : en}
              </span>

              {/* active glow dot */}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#4ade80',
                    boxShadow: '0 0 6px rgba(74,222,128,0.8)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
