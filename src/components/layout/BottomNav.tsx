'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Wallet, Trophy, MessageCircle, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { href: '/dashboard', icon: Home, ko: '홈', en: 'Home' },
  { href: '/members', icon: Users, ko: '회원', en: 'Members' },
  { href: '/finance', icon: Wallet, ko: '재무', en: 'Finance' },
  { href: '/tournament', icon: Trophy, ko: '대회', en: 'Tournament' },
  { href: '/chat', icon: MessageCircle, ko: '채팅', en: 'Chat' },
  { href: '/more', icon: MoreHorizontal, ko: '더보기', en: 'More' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const lang = useAuthStore((s) => s.lang)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-t border-green-900/40 bottom-nav">
      <div className="flex items-center justify-around px-1 pt-2 pb-1">
        {navItems.map(({ href, icon: Icon, ko, en }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${active ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{lang === 'ko' ? ko : en}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
