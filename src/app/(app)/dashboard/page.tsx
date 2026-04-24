'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  CalendarDays, Wallet, Users, Bell, TrendingUp, ChevronRight,
  Trophy, MapPin, CheckCircle, XCircle, HelpCircle, LayoutGrid, Clock,
} from 'lucide-react'
import Link from 'next/link'

// ── helpers ────────────────────────────────────────────────────────────────
function getNthWeekday(year: number, month: number, week: number, dow: number): Date | null {
  const first = new Date(year, month - 1, 1)
  let diff = dow - first.getDay()
  if (diff < 0) diff += 7
  const day = 1 + diff + (week - 1) * 7
  if (day > new Date(year, month, 0).getDate()) return null
  return new Date(year, month - 1, day)
}

function getRelevantYM(pattern: any, overrides: any[]): { year: number; month: number; date: Date } | null {
  if (!pattern) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  for (let i = 0; i < 4; i++) {
    const d   = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const year = d.getFullYear(), month = d.getMonth() + 1
    const ov  = overrides.find(o => o.year === year && o.month === month)
    if (ov?.status === 'cancelled') continue
    let date: Date | null
    if (ov?.status === 'rescheduled' && ov.override_date) {
      date = new Date(ov.override_date + 'T00:00:00')
    } else {
      date = getNthWeekday(year, month, pattern.week_of_month, pattern.day_of_week)
    }
    if (!date) continue
    const cutoff = new Date(date); cutoff.setDate(cutoff.getDate() + 1)
    if (cutoff < now) continue
    return { year, month, date }
  }
  return null
}

// ── role labels ────────────────────────────────────────────────────────────
const ROLE_KO: Record<string, string> = {
  president: '회장', vice_president: '부회장', secretary: '총무',
  auditor: '감사', advisor: '고문', officer: '임원', member: '회원',
}
const ROLE_COLOR: Record<string, string> = {
  president:      'text-amber-300 bg-amber-900/40 border-amber-700/40',
  vice_president: 'text-orange-300 bg-orange-900/40 border-orange-700/40',
  secretary:      'text-blue-300 bg-blue-900/40 border-blue-700/40',
  auditor:        'text-red-300 bg-red-900/40 border-red-700/40',
  advisor:        'text-teal-300 bg-teal-900/40 border-teal-700/40',
  officer:        'text-purple-300 bg-purple-900/40 border-purple-700/40',
  member:         'text-gray-300 bg-gray-800/60 border-gray-700/40',
}

// ── component ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko     = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'

  // base stats
  const [stats,         setStats]         = useState({ members: 0, balance: 0 })
  const [currency,      setCurrency]      = useState('KRW')
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)

  // meeting status
  const [nextMtg,       setNextMtg]       = useState<{ year: number; month: number; date: Date; venue?: string } | null>(null)
  const [attendCounts,  setAttendCounts]  = useState({ attending: 0, absent: 0, noResponse: 0 })
  const [myRsvp,        setMyRsvp]        = useState<string | null>(null)
  const [meetingGroups, setMeetingGroups] = useState<any[]>([])

  useEffect(() => {
    if (!currentClubId || !user) return
    load()
  }, [currentClubId, user?.id])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const [
      { count: memberCount },
      { data: club },
      { data: notices },
      { data: txns },
      { data: pattern },
      { data: overrides },
      { data: allMems },
    ] = await Promise.all([
      supabase.from('club_memberships').select('*', { count: 'exact', head: true })
        .eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
      supabase.from('announcements').select('id,title,title_en,created_at')
        .eq('club_id', currentClubId).order('created_at', { ascending: false }).limit(3),
      supabase.from('finance_transactions').select('type,amount').eq('club_id', currentClubId),
      supabase.from('recurring_meetings').select('*').eq('club_id', currentClubId).maybeSingle(),
      supabase.from('meeting_overrides').select('*').eq('club_id', currentClubId),
      supabase.from('club_memberships').select('user_id').eq('club_id', currentClubId).eq('status', 'approved'),
    ])

    let balance = 0
    txns?.forEach((t: any) => {
      if (['fee', 'donation', 'fine', 'other'].includes(t.type)) balance += t.amount
      else if (t.type === 'expense') balance -= t.amount
    })
    setStats({ members: memberCount ?? 0, balance })
    setAnnouncements(notices ?? [])
    if (club?.currency) setCurrency(club.currency)

    // ── meeting status ──────────────────────────────────────────────────────
    const ym = getRelevantYM(pattern, overrides ?? [])
    if (ym) {
      setNextMtg({ ...ym, venue: pattern?.venue ?? undefined })

      const [{ data: atts }, { data: grps }] = await Promise.all([
        supabase.from('meeting_attendances')
          .select('user_id, status')
          .eq('club_id', currentClubId).eq('year', ym.year).eq('month', ym.month),
        supabase.from('meeting_groups')
          .select('group_number, tee_time, meeting_group_members(user_id, users(full_name, full_name_en))')
          .eq('club_id', currentClubId).eq('year', ym.year).eq('month', ym.month)
          .order('group_number'),
      ])

      const total     = allMems?.length ?? 0
      const attending = atts?.filter((a: any) => a.status === 'attending').length ?? 0
      const absent    = atts?.filter((a: any) => a.status === 'absent').length ?? 0
      setAttendCounts({ attending, absent, noResponse: total - attending - absent })
      setMyRsvp(atts?.find((a: any) => a.user_id === user?.id)?.status ?? null)
      setMeetingGroups(grps ?? [])
    }

    setLoading(false)
  }

  const sym      = { KRW: '₩', VND: '₫', IDR: 'Rp' }[currency] ?? '₩'
  const rc       = ROLE_COLOR[myRole] ?? ROLE_COLOR.member
  const roleName = ko ? (ROLE_KO[myRole] ?? myRole) : myRole

  // date formatted
  const nextDateStr = nextMtg?.date.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' }) ?? ''

  return (
    <div className="px-4 pt-5 pb-6 space-y-5 animate-fade-in">

      {/* ── 히어로 카드 ─────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(22,163,74,0.18) 0%, rgba(6,13,6,0.97) 70%)',
          border: '1px solid rgba(34,197,94,0.22)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
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

      {/* ── 통계 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: Users,       label: ko ? '총 회원'  : 'Members', value: `${stats.members}${ko ? '명' : ''}`,                              color: '#60a5fa', bg: 'rgba(59,130,246,0.1)' },
          { icon: Wallet,      label: ko ? '클럽 잔액': 'Balance',  value: stats.balance === 0 ? `${sym}0` : `${sym}${(stats.balance/1000).toFixed(0)}K`, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
          { icon: CalendarDays,label: ko ? '다음 모임': 'Next',     value: nextDateStr || '—',                                               color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="stat-card rounded-2xl p-3.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 flex-shrink-0" style={{ background: bg }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-white font-bold text-sm leading-tight truncate">{value}</p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#5a7a5a' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── 정기모임 현황 카드 ────────────────────────────────────── */}
      {nextMtg && !loading && (
        <div className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(34,197,94,0.22)', background: 'rgba(4,10,4,0.97)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(34,197,94,0.1)', background: 'rgba(22,163,74,0.07)' }}>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-green-400" />
              <span className="text-sm font-bold text-white">
                {ko ? `${nextMtg.month}월 정기모임 현황` : `${nextMtg.date.toLocaleDateString('en-US',{month:'long'})} Meeting`}
              </span>
            </div>
            <Link href="/meetings" className="text-xs text-green-400 flex items-center gap-0.5 font-medium">
              {ko ? '전체보기' : 'Full view'} <ChevronRight size={12} />
            </Link>
          </div>

          {/* 날짜 + venue */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(22,163,74,0.15)' }}>
              <Clock size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{nextDateStr}</p>
              {nextMtg.venue && (
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: '#5a7a5a' }}>
                  <MapPin size={10} />{nextMtg.venue}
                </p>
              )}
            </div>
          </div>

          {/* 참석 카운터 */}
          <div className="grid grid-cols-3 mx-4 mb-3 rounded-xl overflow-hidden border border-gray-800/60">
            <div className="text-center py-2.5 border-r border-gray-800/60">
              <p className="text-2xl font-black text-green-400 leading-none">{attendCounts.attending}</p>
              <p className="text-[10px] text-gray-500 mt-1">✅ {ko ? '참석' : 'Attending'}</p>
            </div>
            <div className="text-center py-2.5 border-r border-gray-800/60">
              <p className="text-2xl font-black text-red-400 leading-none">{attendCounts.absent}</p>
              <p className="text-[10px] text-gray-500 mt-1">❌ {ko ? '불참' : 'Absent'}</p>
            </div>
            <div className="text-center py-2.5">
              <p className="text-2xl font-black text-gray-400 leading-none">{attendCounts.noResponse}</p>
              <p className="text-[10px] text-gray-500 mt-1">❓ {ko ? '미응답' : 'No reply'}</p>
            </div>
          </div>

          {/* 내 RSVP 상태 */}
          <div className="px-4 pb-3">
            <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${
              myRsvp === 'attending' ? 'bg-green-900/25 border border-green-800/50'
              : myRsvp === 'absent'  ? 'bg-red-900/25 border border-red-800/50'
              :                        'bg-amber-900/20 border border-amber-700/40'
            }`}>
              <div className="flex items-center gap-2">
                {myRsvp === 'attending'
                  ? <CheckCircle size={15} className="text-green-400" />
                  : myRsvp === 'absent'
                    ? <XCircle size={15} className="text-red-400" />
                    : <HelpCircle size={15} className="text-amber-400" />}
                <span className="text-sm text-white font-medium">
                  {myRsvp === 'attending'
                    ? (ko ? '내 응답: 참석' : 'My RSVP: Attending')
                    : myRsvp === 'absent'
                      ? (ko ? '내 응답: 불참' : 'My RSVP: Absent')
                      : (ko ? '아직 응답 전입니다' : 'Not yet responded')}
                </span>
              </div>
              <Link href="/meetings"
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  myRsvp ? 'text-green-400 bg-green-900/30' : 'text-white bg-green-700 hover:bg-green-600'
                }`}>
                {myRsvp ? (ko ? '변경' : 'Change') : (ko ? '응답하기' : 'Respond')} →
              </Link>
            </div>
          </div>

          {/* 조편성 결과 */}
          {meetingGroups.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutGrid size={12} className="text-green-400" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {ko ? '조 편성 결과' : 'Group assignments'}
                </p>
              </div>
              <div className="space-y-1.5">
                {meetingGroups.map((g: any) => (
                  <div key={g.group_number}
                    className="flex items-start gap-2.5 bg-gray-800/40 rounded-xl px-3 py-2">
                    <span className="text-[10px] font-black text-green-400 bg-green-900/30 border border-green-800/30 rounded-lg px-1.5 py-0.5 flex-shrink-0 mt-0.5">
                      {g.group_number}조
                    </span>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {(g.meeting_group_members ?? [])
                        .map((m: any) => lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name))
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
              <Link href="/meetings" className="block mt-2 text-center text-[11px] text-green-500 hover:text-green-400">
                {ko ? '정기모임 상세보기 →' : 'See full meeting details →'}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── 빠른 이동 ─────────────────────────────────────────────── */}
      <div>
        <p className="section-title mb-3">{ko ? '빠른 이동' : 'QUICK ACCESS'}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: '/members',      icon: Users,        label: ko ? '회원 관리'     : 'Members',       sub: `${stats.members}${ko ? '명' : ' members'}`,                      color: '#60a5fa', bg: 'rgba(59,130,246,0.08)' },
            { href: '/finance',      icon: Wallet,       label: ko ? '재무 현황'     : 'Finance',        sub: `${sym}${stats.balance.toLocaleString()}`,                        color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
            { href: '/meetings',     icon: CalendarDays, label: ko ? '정기모임'      : 'Meetings',       sub: nextDateStr || (ko ? '미설정' : 'Not set'),                      color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
            { href: '/announcement', icon: Bell,         label: ko ? '공지사항'      : 'Notices',        sub: ko ? '확인하기' : 'View all',                                    color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
            { href: '/tournament',   icon: Trophy,       label: ko ? '토너먼트'      : 'Tournament',     sub: ko ? '결과 보기' : 'View results',                               color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
            { href: '/scorecard',    icon: TrendingUp,   label: ko ? '내 스코어카드' : 'My Scorecard',   sub: ko ? '개인 기록' : 'Personal records',                           color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)' },
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

      {/* ── 공지사항 ──────────────────────────────────────────────── */}
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
