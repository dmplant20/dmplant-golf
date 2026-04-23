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
      <div className="rounded-2xl px-2 py-1.5 flex items-center justify-around"
        style={{
          background: 'rgba(10,18,10,0.94)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(34,197,94,0.14)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.04)',
        }}>
        {NAV.map(({ href, icon: Icon, ko, en }) => {
          const active = pathname.startsWith(href)
          return (
            <button key={href} onClick={() => router.push(href)}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-150"
              style={active ? { background: 'rgba(22,163,74,0.18)' } : {}}>
              <Icon
                size={21}
                strokeWidth={active ? 2.5 : 1.6}
                style={{ color: active ? '#22c55e' : '#4a6a4a', transition: 'color 0.15s' }}
              />
              <span className="text-[9.5px] font-semibold transition-colors duration-150"
                style={{ color: active ? '#22c55e' : '#4a6a4a' }}>
                {lang === 'ko' ? ko : en}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
