'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  CalendarDays, Wallet, Users, Bell, TrendingUp, ChevronRight,
  Trophy, MapPin, CheckCircle, XCircle, HelpCircle, LayoutGrid, Clock,
  CreditCard,
} from 'lucide-react'
import Link from 'next/link'
import PushNotificationToggle from '@/components/ui/PushNotificationToggle'
import { isSuperAdmin } from '@/lib/superAdmin'

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
    // 모임 당일까지는 노출, 모임 다음날부터는 숨김
    // (지나간 모임은 /meetings 페이지 좌측 화살표로 열람 가능 — 데이터는 DB 에 영구 보존)
    const meetingDay = new Date(date); meetingDay.setHours(0, 0, 0, 0)
    if (meetingDay < now) continue
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
  member:         'text-gray-300 bg-white/5 border-white/10',
}

// ── component ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko     = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const isAdmin = isSuperAdmin(user)

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

  // my fee status
  const [myFeeStatus,   setMyFeeStatus]   = useState<{
    feeType: string | null
    annual: number
    monthly: number
    paid: boolean
    unpaidMonths: number[]
    paidAmount: number
  } | null>(null)
  // club-wide fee progress (visible to all members for transparency)
  const [feeProgress,   setFeeProgress]   = useState<{ paid: number; total: number } | null>(null)

  // RSVP submit (인라인 참석/불참 버튼용)
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false)
  const [rsvpError,      setRsvpError]      = useState<string | null>(null)

  // ── RSVP 창 (D-14 ~ D-1, 참가일 +0 까지 허용) ───────────────────────
  const daysUntilMtg = nextMtg?.date
    ? Math.ceil((nextMtg.date.getTime() - new Date(new Date().setHours(0,0,0,0)).getTime()) / 86400000)
    : null
  const rsvpOpen = daysUntilMtg !== null && daysUntilMtg <= 14 && daysUntilMtg >= -1

  async function submitRsvp(status: 'attending' | 'absent') {
    if (!nextMtg || !user || !currentClubId || rsvpSubmitting) return
    if (!rsvpOpen) return  // 창 닫혀 있으면 무시
    if (myRsvp === status) return  // 같은 상태면 무시
    setRsvpSubmitting(true)
    setRsvpError(null)
    const prev = myRsvp
    setMyRsvp(status)  // optimistic
    setAttendCounts(c => {
      const next = { ...c }
      if (prev === 'attending')      next.attending = Math.max(0, next.attending - 1)
      else if (prev === 'absent')    next.absent    = Math.max(0, next.absent - 1)
      else                           next.noResponse= Math.max(0, next.noResponse - 1)
      if (status === 'attending')    next.attending++
      else                           next.absent++
      return next
    })
    try {
      const res = await fetch('/api/meetings/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: currentClubId, year: nextMtg.year, month: nextMtg.month, status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRsvpError(data.error || (ko ? '저장 실패' : 'Save failed'))
        setMyRsvp(prev)
        load()  // 서버 진실로 재동기화
      }
    } catch {
      setRsvpError(ko ? '네트워크 오류' : 'Network error')
      setMyRsvp(prev)
    } finally {
      setRsvpSubmitting(false)
      setTimeout(() => setRsvpError(null), 3500)
    }
  }

  useEffect(() => {
    if (!currentClubId || !user) return
    load()

    // Refetch when user returns to the tab/page — fixes stale RSVP/fee state
    // after the user navigates back from /meetings or /finance.
    function onWake() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
    }
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
      { data: myMembership },
      { data: myFeeTxns },
    ] = await Promise.all([
      supabase.from('club_memberships').select('*', { count: 'exact', head: true })
        .eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('clubs').select('currency,annual_fee,monthly_fee').eq('id', currentClubId).single(),
      supabase.from('announcements').select('id,title,title_en,created_at')
        .eq('club_id', currentClubId).order('created_at', { ascending: false }).limit(3),
      supabase.from('finance_transactions').select('type,amount,member_id,transaction_date').eq('club_id', currentClubId),
      supabase.from('recurring_meetings').select('*').eq('club_id', currentClubId).maybeSingle(),
      supabase.from('meeting_overrides').select('*').eq('club_id', currentClubId),
      supabase.from('club_memberships').select('user_id, fee_type, joined_at').eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('club_memberships').select('fee_type, joined_at')
        .eq('club_id', currentClubId).eq('user_id', user?.id ?? '').eq('status', 'approved').maybeSingle(),
      supabase.from('finance_transactions').select('amount,transaction_date')
        .eq('club_id', currentClubId).eq('type', 'fee').eq('member_id', user?.id ?? ''),
    ])

    let balance = 0
    txns?.forEach((t: any) => {
      if (['fee', 'donation', 'fine', 'other'].includes(t.type)) balance += t.amount
      else if (t.type === 'expense') balance -= t.amount
    })
    setStats({ members: memberCount ?? 0, balance })
    setAnnouncements(notices ?? [])
    if (club?.currency) setCurrency(club.currency)

    // ── my fee status + club-wide fee progress (this calendar year) ─────────
    const yr        = new Date().getFullYear()
    const curMonth  = new Date().getMonth() + 1
    const yrPrefix  = String(yr)
    const feeTxnsYr = (txns ?? []).filter((t: any) => t.type === 'fee' && t.transaction_date?.startsWith(yrPrefix))

    // my fee status
    if (myMembership?.fee_type) {
      const myTxnsYr = (myFeeTxns ?? []).filter((t: any) => t.transaction_date?.startsWith(yrPrefix))
      const paidAmount = myTxnsYr.reduce((s: number, t: any) => s + (t.amount ?? 0), 0)
      if (myMembership.fee_type === 'annual') {
        setMyFeeStatus({
          feeType: 'annual', annual: club?.annual_fee ?? 0, monthly: club?.monthly_fee ?? 0,
          paid: myTxnsYr.length > 0, unpaidMonths: [], paidAmount,
        })
      } else {
        const paidMonths   = new Set(myTxnsYr.map((t: any) => new Date(t.transaction_date).getMonth() + 1))
        // 가입월부터 미납 카운트 — joined_at 이 올해면 그 달부터, 아니면 1월
        const ja = (myMembership as any).joined_at as string | null
        const startM = (ja && ja.startsWith(yrPrefix)) ? Number(ja.slice(5, 7)) : 1
        // 월례회 통과 기준 — 이번 달 월례회 전이면 이번 달은 미납 카운트에서 제외
        let cutoffM = curMonth
        if (pattern) {
          const ov  = (overrides ?? []).find((o: any) => o.year === yr && o.month === curMonth)
          let mtgD: Date | null = null
          if (ov?.status === 'cancelled') mtgD = null
          else if (ov?.status === 'rescheduled' && ov.override_date) mtgD = new Date(ov.override_date + 'T00:00:00')
          else mtgD = getNthWeekday(yr, curMonth, pattern.week_of_month, pattern.day_of_week)
          const today = new Date(); today.setHours(0,0,0,0)
          cutoffM = (mtgD && today > mtgD) ? curMonth : (curMonth - 1)
        }
        const unpaidMonths: number[] = []
        if (cutoffM >= startM) {
          for (let m = startM; m <= cutoffM; m++) if (!paidMonths.has(m)) unpaidMonths.push(m)
        }
        setMyFeeStatus({
          feeType: 'monthly', annual: club?.annual_fee ?? 0, monthly: club?.monthly_fee ?? 0,
          paid: unpaidMonths.length === 0, unpaidMonths, paidAmount,
        })
      }
    } else {
      setMyFeeStatus(null)
    }

    // club-wide fee progress: count members who have paid at least once this year
    const feeMembers = (allMems ?? []).filter((m: any) => m.fee_type) as any[]
    if (feeMembers.length > 0) {
      const paidIds = new Set(feeTxnsYr.filter((t: any) => t.member_id).map((t: any) => t.member_id))
      const paid    = feeMembers.filter((m: any) => paidIds.has(m.user_id)).length
      setFeeProgress({ paid, total: feeMembers.length })
    } else {
      setFeeProgress(null)
    }

    // ── meeting status ──────────────────────────────────────────────────────
    const ym = getRelevantYM(pattern, overrides ?? [])
    if (ym) {
      setNextMtg({ ...ym, venue: pattern?.venue ?? undefined })

      const [{ data: atts }, { data: grps }] = await Promise.all([
        supabase.from('meeting_attendances')
          .select('user_id, status')
          .eq('club_id', currentClubId).eq('year', ym.year).eq('month', ym.month),
        supabase.from('meeting_groups')
          .select('group_number, tee_time, course_name, meeting_group_members(user_id, guest_id, users(full_name, full_name_en), meeting_guests(full_name, full_name_en))')
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

  // date formatted (긴 버전 = 모임 카드, 짧은 버전 = 통계 카드)
  const nextDateStr = nextMtg?.date.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' }) ?? ''
  const nextDateShort = nextMtg
    ? (ko
        ? `${nextMtg.date.getMonth() + 1}/${nextMtg.date.getDate()}`
        : nextMtg.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    : ''

  return (
    <div className="px-4 pt-5 pb-6 space-y-5 animate-fade-in">

      {/* ── 히어로 카드 (2단 미니멀) ─────────────────────────────── */}
      <div className="pro-card rounded-2xl px-4 py-3 relative overflow-hidden">
        <div className="flex items-center gap-3">
          {/* 아바타 */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
          >
            {user?.avatar_url
              ? <img src={user.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
              : '⛳'}
          </div>
          <div className="flex-1 min-w-0">
            {/* 1단: 인사 + 한글 이름 + 영문 이름 */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-lg font-semibold leading-tight tracking-tight"
                style={{
                  color: 'var(--text)',
                  fontFamily: '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif',
                  letterSpacing: '-0.01em',
                }}>
                <span className="mr-1">👋</span>{user?.full_name ?? 'Golfer'}
              </h2>
              {user?.full_name_en && (
                <span className="text-sm truncate font-light" style={{ color: 'var(--text-2)' }}>
                  {user.full_name_en}
                </span>
              )}
            </div>
            {/* 2단: 역할 뱃지 + DEV (Inter Stellar 뱃지 제거) */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`badge border text-[10px] ${rc}`}>{roleName}</span>
              {isAdmin && (
                <span className="badge text-[10px]"
                  title="개발자 슈퍼관리자 — 모든 클럽 모든 권한"
                  style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.4)' }}>
                  🔧 DEV
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 푸시 알림 활성화 배너 (default 상태에서만 자동 노출) ─── */}
      <PushNotificationToggle variant="banner" />

      {/* ── 통계 ── 클릭 시 해당 페이지로 이동, 컴팩트 horizontal 카드 ────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users,       label: ko ? '총 회원'  : 'Members', value: `${stats.members}${ko ? '명' : ''}`,                              color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', href: '/members'  },
          { icon: Wallet,      label: ko ? '클럽 잔액': 'Balance',  value: stats.balance === 0 ? `${sym}0` : `${sym}${(stats.balance/1000).toFixed(0)}K`, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', href: '/finance'  },
          { icon: CalendarDays,label: ko ? '다음 모임': 'Next',     value: nextDateShort || '—',                                              color: 'var(--gold-l)', bg: 'rgba(201,168,76,0.1)', href: '/meetings' },
        ].map(({ icon: Icon, label, value, color, bg, href }) => (
          <Link
            key={label}
            href={href}
            className="stat-card rounded-xl px-2 py-1.5 flex items-center gap-2 transition active:scale-[0.97] hover:bg-white/[0.02]"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon size={13} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[14px] leading-tight truncate" style={{ color: 'var(--text)' }}>{value}</p>
              <p className="text-[11px] leading-tight truncate mt-0.5 font-medium" style={{ color: '#cbd5e1' }}>{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── 정기모임 현황 카드 ────────────────────────────────────── */}
      {nextMtg && !loading && (
        <div className="glass-card rounded-2xl overflow-hidden">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} style={{ color: 'var(--gold-l)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {ko ? `${nextMtg.month}월 정기모임 현황` : `${nextMtg.date.toLocaleDateString('en-US',{month:'long'})} Meeting`}
              </span>
            </div>
            <Link href="/meetings" className="text-xs flex items-center gap-0.5 font-medium" style={{ color: 'var(--gold-l)' }}>
              {ko ? '전체보기' : 'Full view'} <ChevronRight size={12} />
            </Link>
          </div>

          {/* 날짜 + venue */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--surface-2)' }}>
              <Clock size={16} style={{ color: 'var(--gold-l)' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{nextDateStr}</p>
              {nextMtg.venue && (
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-3)' }}>
                  <MapPin size={10} />{nextMtg.venue}
                </p>
              )}
            </div>
          </div>

          {/* 참석 카운터 */}
          <div className="grid grid-cols-3 mx-4 mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="text-center py-2.5" style={{ borderRight: '1px solid var(--border)' }}>
              <p className="text-2xl font-black leading-none" style={{ color: '#4ade80' }}>{attendCounts.attending}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>✅ {ko ? '참석' : 'Attending'}</p>
            </div>
            <div className="text-center py-2.5" style={{ borderRight: '1px solid var(--border)' }}>
              <p className="text-2xl font-black leading-none" style={{ color: '#f87171' }}>{attendCounts.absent}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>❌ {ko ? '불참' : 'Absent'}</p>
            </div>
            <div className="text-center py-2.5">
              <p className="text-2xl font-black leading-none" style={{ color: 'var(--text-2)' }}>{attendCounts.noResponse}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>❓ {ko ? '미응답' : 'No reply'}</p>
            </div>
          </div>

          {/* 내 RSVP 상태 + 인라인 참석/불참 버튼 */}
          <div className="px-4 pb-3 space-y-2">
            {/* 현재 상태 라벨 */}
            <div className={`rounded-xl px-3 py-2 flex items-center gap-2 ${
              myRsvp === 'attending' ? 'bg-green-900/20 border border-green-800/40'
              : myRsvp === 'absent'  ? 'bg-red-900/20 border border-red-800/40'
              :                        'bg-amber-900/15 border border-amber-700/30'
            }`}>
              {myRsvp === 'attending'
                ? <CheckCircle size={15} style={{ color: 'var(--green-l)' }} />
                : myRsvp === 'absent'
                  ? <XCircle size={15} className="text-red-400" />
                  : <HelpCircle size={15} className="text-amber-400" />}
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>
                {myRsvp === 'attending'
                  ? (ko ? '내 응답: 참석' : 'My RSVP: Attending')
                  : myRsvp === 'absent'
                    ? (ko ? '내 응답: 불참' : 'My RSVP: Absent')
                    : (ko ? '아직 응답 전입니다' : 'Not yet responded')}
              </span>
              {rsvpSubmitting && (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
              )}
            </div>

            {/* 참석 / 불참 버튼 — 한 번 응답하면 숨김 (카운터·라벨은 유지). */}
            {/* 응답 변경이 필요하면 /meetings 페이지에서 수정. */}
            {!myRsvp && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => submitRsvp('attending')}
                  disabled={rsvpSubmitting || !rsvpOpen}
                  className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.97]"
                  style={
                    !rsvpOpen
                      ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-3)', cursor: 'not-allowed' }
                      : { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', color: '#86efac', cursor: 'pointer' }
                  }
                >
                  <CheckCircle size={15} />
                  {ko ? '참석' : 'Attending'}
                </button>
                <button
                  type="button"
                  onClick={() => submitRsvp('absent')}
                  disabled={rsvpSubmitting || !rsvpOpen}
                  className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.97]"
                  style={
                    !rsvpOpen
                      ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-3)', cursor: 'not-allowed' }
                      : { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5', cursor: 'pointer' }
                  }
                >
                  <XCircle size={15} />
                  {ko ? '불참' : 'Absent'}
                </button>
              </div>
            )}

            {/* 비활성 안내: D-14 이후부터 활성화 */}
            {!rsvpOpen && daysUntilMtg !== null && daysUntilMtg > 14 && (
              <p className="text-[11px] text-center" style={{ color: 'var(--text-3)' }}>
                {ko
                  ? `D-${daysUntilMtg} · 모임 14일 전부터 응답할 수 있습니다 (D-${daysUntilMtg - 14}일 후 활성)`
                  : `D-${daysUntilMtg} · RSVP opens 14 days before the meeting`}
              </p>
            )}

            {rsvpError && (
              <p className="text-[11px] px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                ⚠ {rsvpError}
              </p>
            )}
          </div>

          {/* 조편성 결과 */}
          {meetingGroups.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutGrid size={12} style={{ color: 'var(--gold-l)' }} />
                <p className="section-title">{ko ? '조 편성 결과' : 'GROUP ASSIGNMENTS'}</p>
              </div>
              <div className="space-y-1.5">
                {meetingGroups.map((g: any) => (
                  <div key={g.group_number}
                    className="flex items-start gap-2.5 rounded-xl px-3 py-2"
                    style={{ background: 'var(--surface-2)' }}>
                    <span className="text-[10px] font-black rounded-lg px-1.5 py-0.5 flex-shrink-0 mt-0.5"
                      style={{ color: 'var(--gold-l)', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}>
                      {g.group_number}조
                    </span>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      {(g.meeting_group_members ?? [])
                        .map((m: any, i: number) => {
                          const isGuest = !!m.guest_id
                          const gst = Array.isArray(m.meeting_guests) ? m.meeting_guests[0] : m.meeting_guests
                          const nm = isGuest
                            ? (lang === 'ko' ? gst?.full_name : (gst?.full_name_en || gst?.full_name))
                            : (lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name))
                          if (!nm) return null
                          return (
                            <span key={m.user_id ?? m.guest_id ?? i}>
                              {i > 0 && <span style={{ color: 'var(--gold)', margin: '0 4px' }}>·</span>}
                              <span style={{ color: isGuest ? '#c4b5fd' : 'var(--text)' }}>{nm}</span>
                            </span>
                          )
                        })
                        .filter(Boolean)}
                    </p>
                  </div>
                ))}
              </div>
              <Link href="/meetings" className="block mt-2 text-center text-[11px]" style={{ color: 'var(--gold-l)' }}>
                {ko ? '정기모임 상세보기 →' : 'See full meeting details →'}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── 내 회비 상태 + 클럽 납부 진행 ─────────────────────────── */}
      {(myFeeStatus || feeProgress) && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <CreditCard size={14} style={{ color: 'var(--gold-l)' }} />
              <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {ko ? `${new Date().getFullYear()}년 회비 현황` : `${new Date().getFullYear()} Fee Status`}
              </span>
            </div>
            <Link href="/finance" className="text-xs flex items-center gap-0.5 font-medium" style={{ color: 'var(--gold-l)' }}>
              {ko ? '재무현황' : 'Finance'} <ChevronRight size={12} />
            </Link>
          </div>

          {/* 내 회비 상태 */}
          {myFeeStatus && (
            <div className="px-4 pt-3 pb-2">
              <div className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${
                myFeeStatus.paid
                  ? 'bg-green-900/20 border border-green-800/40'
                  : 'bg-red-900/20 border border-red-800/40'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  {myFeeStatus.paid
                    ? <CheckCircle size={15} style={{ color: 'var(--green-l)' }} />
                    : <XCircle size={15} className="text-red-400" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {myFeeStatus.paid
                        ? (ko
                            ? (myFeeStatus.feeType === 'annual' ? '내 연회비: 납부완료' : '내 월회비: 모두 납부완료')
                            : (myFeeStatus.feeType === 'annual' ? 'Annual fee: Paid' : 'Monthly fees: All paid'))
                        : (ko
                            ? (myFeeStatus.feeType === 'annual'
                                ? '내 연회비: 미납'
                                : `내 월회비 미납: ${myFeeStatus.unpaidMonths.join(',')}월`)
                            : (myFeeStatus.feeType === 'annual'
                                ? 'Annual fee: Unpaid'
                                : `Unpaid months: ${myFeeStatus.unpaidMonths.join(',')}`))}
                    </p>
                    {myFeeStatus.paidAmount > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {ko ? '납부 누계' : 'Paid total'}: {sym}{myFeeStatus.paidAmount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <Link href="/finance"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{ color: 'var(--gold-l)', background: 'rgba(201,168,76,0.12)' }}>
                  {ko ? '계좌' : 'Pay'} →
                </Link>
              </div>
            </div>
          )}

          {/* 클럽 전체 납부 진행 */}
          {feeProgress && feeProgress.total > 0 && (
            <div className="px-4 pb-4 pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {ko ? '클럽 전체 납부 진행' : 'Club-wide progress'}
                </p>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>
                  {feeProgress.paid} / {feeProgress.total}{ko ? '명' : ''}
                </p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((feeProgress.paid / feeProgress.total) * 100)}%`,
                    background: 'linear-gradient(135deg,#c9a84c,#a07830)',
                  }}
                />
              </div>
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
            { href: '/meetings',     icon: CalendarDays, label: ko ? '정기모임'      : 'Meetings',       sub: nextDateStr || (ko ? '미설정' : 'Not set'),                      color: 'var(--gold-l)', bg: 'rgba(201,168,76,0.08)' },
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
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text)' }}>{label}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 공지사항 ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title">{ko ? '최근 공지사항' : 'ANNOUNCEMENTS'}</p>
          <Link href="/announcement" className="text-xs font-medium" style={{ color: 'var(--gold-l)' }}>{ko ? '전체보기' : 'View all'}</Link>
        </div>
        <div className="space-y-2">
          {announcements.length === 0 ? (
            <div className="glass-card rounded-xl py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>{ko ? '공지사항이 없습니다' : 'No announcements'}</p>
            </div>
          ) : announcements.map(a => (
            <Link key={a.id} href="/announcement"
              className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] block">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(167,139,250,0.12)' }}>
                <Bell size={13} style={{ color: '#a78bfa' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {lang === 'ko' ? a.title : (a.title_en || a.title)}
                </p>
              </div>
              <p className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                {new Date(a.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
