'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Image, AlertCircle, LogOut, Globe, User, Settings, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function MorePage() {
  const router = useRouter()
  const { user, lang, setLang, clear } = useAuthStore()
  const ko = lang === 'ko'

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    clear()
    router.replace('/login')
  }

  const items = [
    { href: '/album', icon: Image, label: ko ? '사진 앨범' : 'Photo Album', color: 'text-pink-400' },
    { href: '/announcement', icon: AlertCircle, label: ko ? '경조사 / 회의' : 'Events & Meetings', color: 'text-purple-400' },
    { href: '/settings', icon: Settings, label: ko ? '클럽 설정' : 'Club Settings', color: 'text-gray-400' },
  ]

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Profile */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className="w-14 h-14 bg-green-800 rounded-full flex items-center justify-center text-2xl">
          {user?.avatar_url ? <img src={user.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" /> : '👤'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold">{user?.full_name}</p>
          {user?.full_name_en && <p className="text-gray-400 text-sm">{user.full_name_en}</p>}
          {user?.name_abbr && <p className="text-green-400 text-xs mt-0.5">({user.name_abbr})</p>}
        </div>
        <Link href="/profile" className="text-gray-500 hover:text-green-400">
          <ChevronRight size={20} />
        </Link>
      </div>

      {/* Menu items */}
      <div className="space-y-2">
        {items.map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href} className="glass-card rounded-xl px-4 py-3.5 flex items-center gap-3">
            <Icon size={20} className={color} />
            <span className="text-white text-sm flex-1">{label}</span>
            <ChevronRight size={16} className="text-gray-600" />
          </Link>
        ))}
      </div>

      {/* Language toggle */}
      <div className="glass-card rounded-xl px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe size={20} className="text-green-400" />
          <span className="text-white text-sm">{ko ? '언어' : 'Language'}</span>
        </div>
        <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
          className="bg-green-900/50 border border-green-700 text-green-300 text-xs px-3 py-1 rounded-full">
          {lang === 'ko' ? '한국어 → EN' : 'EN → 한국어'}
        </button>
      </div>

      {/* Logout */}
      <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-900/20 border border-red-900/40 text-red-400">
        <LogOut size={20} />
        <span className="text-sm">{ko ? '로그아웃' : 'Logout'}</span>
      </button>

      <p className="text-center text-gray-700 text-xs pt-2">Inter Stellar GOLF v1.0.0</p>
    </div>
  )
}
