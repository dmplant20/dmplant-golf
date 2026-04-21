'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { CalendarDays, Wallet, Users, Bell, TrendingUp, ChevronRight, Trophy, MapPin } from 'lucide-react'
import Link from 'next/link'

const ROLE_KO: Record<string, string> = {
  president: '회장', vice_president: '부회장', secretary: '총무',
  auditor: '감사', advisor: '고문', officer: '임원', member: '회원',
}
const ROLE_COLOR: Record<string, string> = {
  president: 'text-amber-300 bg-amber-900/40 border-amber-700/40',
  vice_president: 'text-orange-300 bg-orange-900/40 border-orange-700/40',
  secretary: 'text-blue-300 bg-blue-900/40 border-blue-700/40',
  auditor: 'text-red-300 bg-red-900/40 border-red-700/40',
  advisor: 'text-teal-300 bg-teal-900/40 border-teal-700/40',
  officer: 'text-purple-300 bg-purple-900/40 border-purple-700/40',
  member: 'text-gray-300 bg-gray-800/60 border-gray-700/40',
}

export default function DashboardPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const [stats, setStats] = useState({ members: 0, balance: 0, nextMeeting: '', nextCourse: '' })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [currency, setCurrency] = useState('KRW')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentClubId) return
    const supabase = createClient()
    async function load() {
      setLoading(true)
      const [
        { count: members },
        { data: club },
        { data: notices },
        { data: txns },
        { data: pattern },
      ] = await Promise.all([
        supabase.from('club_memberships').select('*', { count: 'exact', head: true }).eq('club_id', currentClubId).eq('status', 'approved'),
        supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
        supabase.from('announcements').select('id,title,title_en,created_at').eq('club_id', currentClubId).order('created_at', { ascending: false }).limit(3),
        supabase.from('finance_transactions').select('type,amount').eq('club_id', currentClubId),
        supabase.from('recurring_meetings').select('week_of_month,day_of_week,start_time,course_name').eq('club_id', currentClubId).maybeSingle(),
      ])
      let balance = 0
      txns?.forEach((t: any) => {
        if (['fee','donation','fine','other'].includes(t.type)) balance += t.amount
        else if (t.type === 'expense') balance -= t.amount
      })
      let nextMeeting = ''
      if (pattern) {
        const now = new Date()
        for (let i = 0; i < 4; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
          const year = d.getFullYear(), month = d.getMonth() + 1
          const first = new Date(year, month - 1, 1)
          let diff = (pattern.day_of_week - first.getDay() + 7) % 7
          const day = 1 + diff + (pattern.week_of_month - 1) * 7
          if (day > new Date(year, month, 0).getDate()) continue
          const date = new Date(year, month - 1, day)
          if (date >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            nextMeeting = date.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' })
            break
          }
        }
      }
      setStats({ members: members ?? 0, balance, nextMeeting, nextCourse: pattern?.course_name ?? '' })
      setAnnouncements(notices ?? [])
      if (club?.currency) setCurrency(club.currency)
      setLoading(false)
    }
    load()
  }, [currentClubId])

  const sym = { KRW: '₩', VND: '₫', IDR: 'Rp' }[currency] ?? '₩'
  const rc = ROLE_COLOR[myRole] ?? ROLE_COLOR.member
  const roleName = ko ? (ROLE_KO[myRole] ?? myRole) : myRole

  return (
    <div className="px-4 pt-5 pb-6 space-y-5 animate-fade-in">

      {/* ── 히어로 카드 ──────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(22,163,74,0.18) 0%, rgba(6,13,6,0.97) 70%)',
          border: '1px solid rgba(34,197,94,0.22)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
        {/* 배경 글로우 */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.12) 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm mb-1" style={{ color: '#5a7a5a' }}>{ko ? '안녕하세요 👋' : 'Welcome back 👋'}</p>
            <h2 className="text-2xl font-extrabold text-white leading-tight">{user?.full_name ?? 'Golfer'}</h2>
            {user?.full_name_en && <p className="text-sm mt-0.5" style={{ color: '#a3b8a3' }}>{user.full_name_en}</p>}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`badge border text-[11px] ${rc}`}>{roleName}</span>
              <span className="badge text-[11px]" style={{ background: 'rgba(22,163,74,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                ⛳ Inter Stellar GOLF
              </span>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full blur-xl" style={{ background: 'rgba(22,163,74,0.2)' }} />
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.3), rgba(14,53,29,0.8))', border: '1px solid rgba(34,197,94,0.3)' }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" />
                : '⛳'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 통계 3칸 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: Users, label: ko ? '총 회원' : 'Members', value: `${stats.members}${ko ? '명' : ''}`, color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
          { icon: Wallet, label: ko ? '클럽 잔액' : 'Balance', value: `${sym}${(stats.balance/1000).toFixed(0)}K`, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
          { icon: CalendarDays, label: ko ? '다음 모임' : 'Next', value: stats.nextMeeting || '—', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="stat-card rounded-2xl p-3.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 flex-shrink-0"
              style={{ background: bg }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-white font-bold text-sm leading-tight truncate">{value}</p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#5a7a5a' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── 다음 모임 하이라이트 ──────────────────────────────── */}
      {stats.nextMeeting && (
        <Link href="/meetings" className="block rounded-2xl p-4 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.12), rgba(6,13,6,0.95))', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(22,163,74,0.2)' }}>
              <CalendarDays size={20} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-wider mb-0.5" style={{ color: '#22c55e' }}>
                {ko ? '다음 정기모임' : 'NEXT MEETING'}
              </p>
              <p className="text-white font-bold text-sm">{stats.nextMeeting}</p>
              {stats.nextCourse && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={10} style={{ color: '#5a7a5a' }} />
                  <p className="text-xs truncate" style={{ color: '#5a7a5a' }}>{stats.nextCourse}</p>
                </div>
              )}
            </div>
            <ChevronRight size={16} style={{ color: '#22c55e' }} />
          </div>
        </Link>
      )}

      {/* ── 빠른 이동 ─────────────────────────────────────────── */}
      <div>
        <p className="section-title mb-3">{ko ? '빠른 이동' : 'QUICK ACCESS'}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: '/members',      icon: Users,        label: ko ? '회원 관리'  : 'Members',       sub: `${stats.members}${ko ? '명' : ' members'}`,   color: '#60a5fa', bg: 'rgba(59,130,246,0.08)' },
            { href: '/finance',      icon: Wallet,       label: ko ? '재무 현황'  : 'Finance',        sub: `${sym}${stats.balance.toLocaleString()}`,      color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
            { href: '/meetings',     icon: CalendarDays, label: ko ? '정기모임'   : 'Meetings',       sub: stats.nextMeeting || (ko ? '미설정' : 'Not set'), color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
            { href: '/announcement', icon: Bell,         label: ko ? '공지사항'   : 'Notices',        sub: ko ? '확인하기' : 'View all',                  color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
            { href: '/tournament',   icon: Trophy,       label: ko ? '토너먼트'   : 'Tournament',     sub: ko ? '결과 보기' : 'View results',             color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
            { href: '/scorecard',    icon: TrendingUp,   label: ko ? '내 스코어카드' : 'My Scorecard', sub: ko ? '개인 기록' : 'Personal records',         color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)' },
          ].map(({ href, icon: Icon, label, sub, color, bg }) => (
            <Link key={href} href={href}
              className="glass-card rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-[0.97]"
              style={{ textDecoration: 'none' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">{label}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: '#5a7a5a' }}>{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 공지사항 ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">{ko ? '최근 공지사항' : 'ANNOUNCEMENTS'}</p>
          <Link href="/announcement" className="text-xs font-medium" style={{ color: '#22c55e' }}>{ko ? '전체보기' : 'View all'}</Link>
        </div>
        <div className="space-y-2">
          {announcements.length === 0 ? (
            <div className="glass-card rounded-xl py-6 text-center">
              <p className="text-sm" style={{ color: '#3a5a3a' }}>{ko ? '공지사항이 없습니다' : 'No announcements'}</p>
            </div>
          ) : announcements.map(a => (
            <Link key={a.id} href="/announcement"
              className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] block">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(167,139,250,0.15)' }}>
                <Bell size={13} style={{ color: '#a78bfa' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {lang === 'ko' ? a.title : (a.title_en || a.title)}
                </p>
              </div>
              <p className="text-[10px] flex-shrink-0" style={{ color: '#3a5a3a' }}>
                {new Date(a.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
