'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Image, AlertCircle, LogOut, Globe, Settings,
  ChevronRight, CalendarDays, ClipboardList, User, Trophy,
} from 'lucide-react'
import Link from 'next/link'

const ROLE_KO: Record<string, string> = {
  president: '회장', vice_president: '부회장', secretary: '총무',
  auditor: '감사', advisor: '고문', officer: '임원', member: '회원',
}
const ROLE_COLOR: Record<string, string> = {
  president: 'text-amber-300 bg-amber-900/40',
  vice_president: 'text-orange-300 bg-orange-900/40',
  secretary: 'text-blue-300 bg-blue-900/40',
  auditor: 'text-red-300 bg-red-900/40',
  advisor: 'text-teal-300 bg-teal-900/40',
  officer: 'text-purple-300 bg-purple-900/40',
  member: 'text-gray-300 bg-gray-800/60',
}

export default function MorePage() {
  const router = useRouter()
  const { user, lang, setLang, clear, myClubs, currentClubId } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const rc = ROLE_COLOR[myRole] ?? ROLE_COLOR.member
  const roleName = ko ? (ROLE_KO[myRole] ?? myRole) : myRole

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    clear()
    router.replace('/login')
  }

  const menuGroups = [
    {
      title: ko ? '골프' : 'Golf',
      items: [
        { href: '/meetings',  icon: CalendarDays,  label: ko ? '정기모임 일정'    : 'Regular Meetings',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
        { href: '/scorecard', icon: ClipboardList, label: ko ? '개인 스코어카드'  : 'My Scorecard',      color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
        { href: '/tournament', icon: Trophy,       label: ko ? '토너먼트'         : 'Tournament',        color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
      ],
    },
    {
      title: ko ? '커뮤니티' : 'Community',
      items: [
        { href: '/album',        icon: Image,       label: ko ? '사진 앨범'    : 'Photo Album',    color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
        { href: '/announcement', icon: AlertCircle, label: ko ? '경조사 / 공지' : 'Announcements',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
      ],
    },
    {
      title: ko ? '설정' : 'Settings',
      items: [
        { href: '/settings', icon: Settings, label: ko ? '클럽 설정' : 'Club Settings', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
      ],
    },
  ]

  return (
    <div className="px-4 pt-5 pb-6 space-y-5 animate-fade-in">

      {/* ── 프로필 카드 ──────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(22,163,74,0.15) 0%, rgba(6,13,6,0.97) 70%)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.1) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-md" style={{ background: 'rgba(22,163,74,0.3)' }} />
            <div className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.3), rgba(6,13,6,0.8))', border: '2px solid rgba(34,197,94,0.3)' }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
                : '👤'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg leading-tight">{user?.full_name}</p>
            {user?.full_name_en && <p className="text-sm mt-0.5" style={{ color: '#a3b8a3' }}>{user.full_name_en}</p>}
            {user?.name_abbr && <p className="text-xs mt-0.5" style={{ color: '#22c55e' }}>({user.name_abbr})</p>}
            <span className={`badge text-[11px] mt-2 ${rc}`}>{roleName}</span>
          </div>
          <Link href="/profile"
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <User size={16} />
          </Link>
        </div>
      </div>

      {/* ── 메뉴 그룹 ─────────────────────────────────────────── */}
      {menuGroups.map(group => (
        <div key={group.title}>
          <p className="section-title mb-2.5 px-1">{group.title}</p>
          <div className="glass-card rounded-2xl overflow-hidden">
            {group.items.map(({ href, icon: Icon, label, color, bg }, i) => (
              <Link key={href} href={href}
                className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-green-900/10 active:bg-green-900/15"
                style={{ borderTop: i > 0 ? '1px solid rgba(34,197,94,0.07)' : 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <span className="text-white text-sm font-medium flex-1">{label}</span>
                <ChevronRight size={14} style={{ color: '#3a5a3a' }} />
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* ── 언어 토글 ─────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
            <Globe size={17} className="text-green-400" />
          </div>
          <span className="text-white text-sm font-medium">{ko ? '언어' : 'Language'}</span>
        </div>
        <button onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
          className="text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
          style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
          {lang === 'ko' ? '한국어 → EN' : 'EN → 한국어'}
        </button>
      </div>

      {/* ── 로그아웃 ──────────────────────────────────────────── */}
      <button onClick={logout}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
          <LogOut size={17} style={{ color: '#f87171' }} />
        </div>
        <span className="text-sm font-medium">{ko ? '로그아웃' : 'Logout'}</span>
      </button>

      <p className="text-center text-xs pt-1" style={{ color: '#1a3a1a' }}>Inter Stellar GOLF v1.0.0</p>
    </div>
  )
}
