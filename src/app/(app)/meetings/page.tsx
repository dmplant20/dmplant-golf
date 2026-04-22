'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  CalendarDays, Settings2, X, ChevronLeft, AlertTriangle,
  CheckCircle, XCircle, Clock, MapPin, Users, Shuffle,
  ListOrdered, Check, Ban, HelpCircle, Edit2, BarChart2,
  TrendingDown, TrendingUp, Minus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import CourseSearchInput from '@/components/ui/CourseSearchInput'

// ── helpers ────────────────────────────────────────────────────────────────
function getNthWeekday(year: number, month: number, week: number, dow: number): Date | null {
  const first = new Date(year, month - 1, 1)
  let diff = dow - first.getDay()
  if (diff < 0) diff += 7
  const day = 1 + diff + (week - 1) * 7
  if (day > new Date(year, month, 0).getDate()) return null
  return new Date(year, month - 1, day)
}

function fmtDate(d: Date, ko: boolean) {
  return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' })
}

function fmtTime(t: string, ko: boolean) {
  const [h, m] = t.split(':').map(Number)
  if (ko) {
    const ap = h < 12 ? '오전' : '오후'
    const hh = h % 12 || 12
    return `${ap} ${hh}:${String(m).padStart(2, '0')}`
  }
  const ap = h < 12 ? 'AM' : 'PM'
  const hh = h % 12 || 12
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`
}

function getDaysUntil(date: Date): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

function getRelevantMeeting(pattern: any, overrides: any[]) {
  if (!pattern) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const year = d.getFullYear(), month = d.getMonth() + 1
    const ov = overrides.find(o => o.year === year && o.month === month)
    if (ov?.status === 'cancelled') continue
    let date: Date | null
    if (ov?.status === 'rescheduled' && ov.override_date) {
      date = new Date(ov.override_date + 'T00:00:00')
    } else {
      date = getNthWeekday(year, month, pattern.week_of_month, pattern.day_of_week)
    }
    if (!date) continue
    const next = new Date(date); next.setDate(next.getDate() + 1)
    if (next < now) continue
    return {
      year, month, date,
      time: ov?.override_time ?? pattern.start_time,
      venue: pattern.venue,
      status: ov?.status ?? 'scheduled',
      reason: ov?.reason ?? null,
    }
  }
  return null
}

const DOW_KO  = ['일','월','화','수','목','금','토']
const DOW_EN  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const WEEK_KO = ['1째','2째','3째','4째','5째']
const WEEK_EN = ['1st','2nd','3rd','4th','5th']

// ── BottomSheet (z-[200] + sticky footer) ─────────────────────────────────
function BottomSheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; footer?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 p-1"><X size={18} /></button>
        </div>
        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {children}
        </div>
        {/* sticky footer — always visible */}
        {footer && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-800 bg-gray-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const router = useRouter()
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [pattern,     setPattern]     = useState<any>(null)
  const [overrides,   setOverrides]   = useState<any[]>([])
  const [attendances, setAttendances] = useState<any[]>([])
  const [groups,      setGroups]      = useState<any[]>([])
  const [clubMembers, setClubMembers] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [noticeSent,  setNoticeSent]  = useState(false)

  const [showPatternModal,  setShowPatternModal]  = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [showGroupModal,    setShowGroupModal]    = useState(false)
  const [showAnalysis,      setShowAnalysis]      = useState(false)
  const [saving,            setSaving]            = useState(false)

  const [pForm, setPForm] = useState({ week: 3, dow: 4, time: '07:00', venue: '', notes: '' })
  const [oForm, setOForm] = useState({ status: 'cancelled', date: '', time: '', reason: '' })
  const [assign, setAssign] = useState<Record<string, number>>({})

  // ── golf course picker ─────────────────────────────────────────────────
  const [courses,          setCourses]          = useState<any[]>([])
  const [courseSearch,     setCourseSearch]     = useState('')
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [coursesLoading,   setCoursesLoading]   = useState(false)

  async function loadCourses() {
    if (courses.length > 0) return
    setCoursesLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('golf_courses')
      .select('id, name, name_vn, province, holes, par, distance_km, green_fee_weekday_vnd')
      .eq('is_active', true).order('distance_km')
    if (error) console.error('golf_courses:', error.message)
    setCourses(data ?? [])
    setCoursesLoading(false)
  }

  function closePatternModal() {
    setShowPatternModal(false)
    setShowCoursePicker(false)
    setCourseSearch('')
  }

  // ── score tracking ─────────────────────────────────────────────────────
  const [scores,        setScores]        = useState<any[]>([])    // saved scores for this meeting
  const [scoreInput,    setScoreInput]    = useState<Record<string, string>>({})
  const [savingScores,  setSavingScores]  = useState(false)
  const [yearlyScores,  setYearlyScores]  = useState<any[]>([])
  const [yearlyLoading, setYearlyLoading] = useState(false)

  // ── load ──────────────────────────────────────────────────────────────
  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: pat, error: patErr }, { data: ovr }, { data: mems }] = await Promise.all([
      supabase.from('recurring_meetings').select('*').eq('club_id', currentClubId).maybeSingle(),
      supabase.from('meeting_overrides').select('*').eq('club_id', currentClubId),
      supabase.from('club_memberships')
        .select('user_id, club_handicap, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('status', 'approved'),
    ])
    if (patErr) console.error('pattern load:', patErr.message)
    setPattern(pat ?? null)
    setOverrides(ovr ?? [])
    setClubMembers(mems ?? [])
    if (pat) setPForm({ week: pat.week_of_month, dow: pat.day_of_week, time: pat.start_time?.slice(0, 5) ?? '07:00', venue: pat.venue ?? '', notes: pat.notes ?? '' })
    setLoading(false)
  }

  async function loadRsvp(year: number, month: number) {
    if (!currentClubId) return
    const supabase = createClient()
    const [{ data: att }, { data: grps }, { data: sc }] = await Promise.all([
      supabase.from('meeting_attendances')
        .select('user_id, status, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month),
      supabase.from('meeting_groups')
        .select('group_number, tee_time, meeting_group_members(user_id, users(full_name, full_name_en, name_abbr))')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month).order('group_number'),
      supabase.from('round_scores')
        .select('user_id, gross_score, handicap_used, net_score, course_name, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month),
    ])
    setAttendances(att ?? [])
    setGroups(grps ?? [])
    setScores(sc ?? [])
    const a: Record<string, number> = {}
    ;(grps ?? []).forEach((g: any) => g.meeting_group_members?.forEach((m: any) => { a[m.user_id] = g.group_number }))
    setAssign(a)
    // initialize score input from saved scores
    const si: Record<string, string> = {}
    sc?.forEach(s => { si[s.user_id] = String(s.gross_score) })
    setScoreInput(si)
  }

  async function loadYearlyAnalysis() {
    if (!currentClubId || !meeting) return
    setYearlyLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('round_scores')
      .select('user_id, gross_score, handicap_used, month, course_par, users(full_name, full_name_en, name_abbr)')
      .eq('club_id', currentClubId)
      .eq('year', meeting.year)
      .order('month')
    setYearlyScores(data ?? [])
    setYearlyLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  const meeting = useMemo(() => getRelevantMeeting(pattern, overrides), [pattern, overrides])

  useEffect(() => {
    if (meeting) loadRsvp(meeting.year, meeting.month)
  }, [meeting?.year, meeting?.month, currentClubId])

  const daysUntil   = meeting?.date ? getDaysUntil(meeting.date) : null
  const isRsvpOpen  = daysUntil !== null && daysUntil <= 14 && daysUntil >= -1
  const isScoreOpen = daysUntil !== null && daysUntil <= 1  // 당일 또는 이후

  const attending = attendances.filter(a => a.status === 'attending')
  const absent    = attendances.filter(a => a.status === 'absent')
  const notRespon = clubMembers.filter(m => !attendances.find(a => a.user_id === m.user_id))
  const myAtt     = attendances.find(a => a.user_id === user?.id)

  // ── auto notice ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRsvpOpen || !canManage || !meeting || noticeSent) return
    ;(async () => {
      const supabase = createClient()
      const key = `[정기모임-${meeting.year}-${meeting.month}]`
      const { data: ex } = await supabase.from('announcements')
        .select('id').eq('club_id', currentClubId).ilike('title', `${key}%`).maybeSingle()
      if (ex) { setNoticeSent(true); return }
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) return
      const ds = fmtDate(meeting.date, ko)
      const ts = meeting.time ? ` ${fmtTime(meeting.time.slice(0, 5), ko)}` : ''
      await supabase.from('announcements').insert({
        club_id: currentClubId,
        title: `${key} ${meeting.year}년 ${meeting.month}월 정기모임 안내`,
        title_en: `${key} ${meeting.date.toLocaleDateString('en-US', { month: 'long' })} Regular Meeting`,
        content: `${meeting.year}년 ${meeting.month}월 정기모임 일정 안내드립니다.\n\n📅 ${ds}${ts}\n📍 ${meeting.venue ?? '미정'}\n\n정기모임 메뉴에서 참석/불참 여부를 등록해 주세요.`,
        content_en: `Regular meeting on ${fmtDate(meeting.date, false)}${ts}. Please RSVP via the Meetings menu.`,
        author_id: au.id,
      })
      setNoticeSent(true)
    })()
  }, [isRsvpOpen, canManage, meeting?.year, meeting?.month])

  // ── RSVP ──────────────────────────────────────────────────────────────
  async function rsvp(status: 'attending' | 'absent') {
    if (!meeting || !user) return
    const supabase = createClient()
    await supabase.from('meeting_attendances').upsert(
      { club_id: currentClubId, year: meeting.year, month: meeting.month, user_id: user.id, status, responded_at: new Date().toISOString() },
      { onConflict: 'club_id,year,month,user_id' }
    )
    await loadRsvp(meeting.year, meeting.month)
  }

  // ── auto grouping ──────────────────────────────────────────────────────
  function buildAutoAssign(method: 'handicap' | 'random') {
    const pool = clubMembers.filter(m => attendances.find(a => a.user_id === m.user_id && a.status === 'attending'))
    let ordered = [...pool]
    if (method === 'handicap') {
      ordered.sort((a, b) => (a.club_handicap ?? 99) - (b.club_handicap ?? 99))
      const n = Math.ceil(ordered.length / 4)
      const rows: any[][] = Array.from({ length: n }, () => [])
      ordered.forEach((m, i) => rows[i % n].push(m))
      ordered = rows.flat()
    } else {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]]
      }
    }
    const a: Record<string, number> = {}
    ordered.forEach((m, i) => { a[m.user_id] = Math.floor(i / 4) + 1 })
    setAssign(a)
  }

  // ── save groups ────────────────────────────────────────────────────────
  async function saveGroups() {
    if (!meeting || !currentClubId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('meeting_groups').delete().eq('club_id', currentClubId).eq('year', meeting.year).eq('month', meeting.month)
    const nums = [...new Set(Object.values(assign) as number[])].sort()
    for (const gNum of nums) {
      const { data: g } = await supabase.from('meeting_groups').insert({ club_id: currentClubId, year: meeting.year, month: meeting.month, group_number: gNum }).select().single()
      if (g) {
        const uids = Object.entries(assign).filter(([, n]) => n === gNum).map(([uid]) => uid)
        if (uids.length) await supabase.from('meeting_group_members').insert(uids.map(uid => ({ group_id: g.id, user_id: uid })))
      }
    }
    setSaving(false)
    setShowGroupModal(false)
    await loadRsvp(meeting.year, meeting.month)
  }

  // ── save pattern ───────────────────────────────────────────────────────
  async function savePattern() {
    if (!currentClubId || !canManage) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('recurring_meetings').upsert({
      club_id: currentClubId, week_of_month: pForm.week, day_of_week: pForm.dow,
      start_time: pForm.time, venue: pForm.venue || null, notes: pForm.notes || null,
      is_active: true, created_by: user!.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'club_id' })
    setSaving(false)
    closePatternModal()
    load()
  }

  // ── save override ──────────────────────────────────────────────────────
  async function saveOverride() {
    if (!currentClubId || !meeting) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('meeting_overrides').upsert({
      club_id: currentClubId, year: meeting.year, month: meeting.month,
      status: oForm.status,
      override_date: oForm.status === 'rescheduled' ? oForm.date : null,
      override_time: oForm.status === 'rescheduled' && oForm.time ? oForm.time : null,
      reason: oForm.reason || null, created_by: user!.id,
    }, { onConflict: 'club_id,year,month' })
    setSaving(false)
    setShowOverrideModal(false)
    load()
  }

  async function removeOverride() {
    if (!currentClubId || !meeting) return
    const supabase = createClient()
    await supabase.from('meeting_overrides').delete().eq('club_id', currentClubId).eq('year', meeting.year).eq('month', meeting.month)
    load()
  }

  // ── save scores ────────────────────────────────────────────────────────
  async function saveScores() {
    if (!meeting || !currentClubId) return
    setSavingScores(true)
    const supabase = createClient()
    const { data: { user: au } } = await supabase.auth.getUser()
    // fetch club handicaps for all attending members
    const { data: mems } = await supabase.from('club_memberships')
      .select('user_id, club_handicap').eq('club_id', currentClubId)
    const hcMap: Record<string, number | null> = {}
    mems?.forEach(m => { hcMap[m.user_id] = m.club_handicap })

    // find course par from selected venue
    const coursePar = courses.find(c => c.name === meeting.venue)?.par ?? 72

    for (const [userId, grossStr] of Object.entries(scoreInput)) {
      const gross = parseInt(grossStr)
      if (isNaN(gross) || gross <= 0) continue
      const hc = hcMap[userId] ?? null
      await supabase.from('round_scores').upsert({
        club_id:      currentClubId,
        user_id:      userId,
        year:         meeting.year,
        month:        meeting.month,
        gross_score:  gross,
        handicap_used: hc,
        net_score:    hc != null ? gross - hc : null,
        course_name:  meeting.venue ?? null,
        course_par:   coursePar,
        played_at:    meeting.date.toISOString().split('T')[0],
        recorded_by:  au!.id,
      }, { onConflict: 'club_id,user_id,year,month' })
    }

    // if canManage, update club_handicap recommendations after year-end (12+ rounds)
    setSavingScores(false)
    await loadRsvp(meeting.year, meeting.month)
  }

  // ── handicap suggestion ────────────────────────────────────────────────
  function getHcSuggestion(avgGross: number, currentHc: number | null, par: number) {
    const avgOverPar = avgGross - par
    const hc = currentHc ?? avgOverPar
    const diff = avgOverPar - hc
    if (diff <= -3) return { delta: Math.max(-3, Math.round(diff)), dir: 'down' as const }
    if (diff >= 3)  return { delta: Math.min(3,  Math.round(diff)), dir: 'up'   as const }
    return { delta: 0, dir: 'stable' as const }
  }

  // ── yearly stats computed from yearlyScores ────────────────────────────
  const yearlyByUser = useMemo(() => {
    if (!yearlyScores.length) return []
    const map = new Map<string, { user: any; scores: number[]; par: number; hc: number | null }>()
    yearlyScores.forEach(s => {
      if (!map.has(s.user_id)) map.set(s.user_id, { user: s.users, scores: [], par: s.course_par ?? 72, hc: s.handicap_used })
      map.get(s.user_id)!.scores.push(s.gross_score)
    })
    return Array.from(map.entries()).map(([uid, v]) => {
      const avg = v.scores.reduce((a, b) => a + b, 0) / v.scores.length
      const min = Math.min(...v.scores)
      const member = clubMembers.find(m => m.user_id === uid)
      const clubHc = member?.club_handicap ?? v.hc
      const suggestion = getHcSuggestion(avg, clubHc, v.par)
      return { uid, user: v.user, rounds: v.scores.length, scores: v.scores, avg, min, clubHc, suggestion, par: v.par }
    }).sort((a, b) => a.avg - b.avg)
  }, [yearlyScores, clubMembers])

  // ── display helpers ────────────────────────────────────────────────────
  function memberName(m: any) {
    return lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)
  }

  function dDayBadge() {
    if (daysUntil === null) return null
    if (daysUntil === 0) return <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">D-Day</span>
    if (daysUntil < 0)   return <span className="bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded-full">{ko ? '완료' : 'Done'}</span>
    return <span className={`text-xs px-2 py-0.5 rounded-full ${daysUntil <= 7 ? 'bg-red-900/70 text-red-300' : daysUntil <= 14 ? 'bg-yellow-900/70 text-yellow-300' : 'bg-gray-800 text-gray-400'}`}>D-{daysUntil}</span>
  }

  const assignedGroupNums = [...new Set(Object.values(assign) as number[])].sort()

  // score summary for this meeting
  const thisMonthScores = scores.filter(s => parseInt(scoreInput[s.user_id] ?? '0') > 0 || s.gross_score > 0)
  const allGross = scores.map(s => s.gross_score).filter(Boolean)
  const avgGrossThis = allGross.length ? Math.round(allGross.reduce((a, b) => a + b, 0) / allGross.length) : null

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-4 pb-28 max-w-md mx-auto">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="text-gray-400 p-1"><ChevronLeft size={20} /></button>
        <CalendarDays size={18} className="text-green-400" />
        <h1 className="text-base font-bold text-white flex-1">{ko ? '정기모임 일정' : 'Regular Meetings'}</h1>
        {canManage && (
          <button onClick={() => { loadCourses(); setShowPatternModal(true) }}
            className="flex items-center gap-1 text-xs text-green-400 border border-green-800 rounded-full px-3 py-1.5">
            <Settings2 size={12} />{ko ? '패턴 설정' : 'Pattern'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-16">{ko ? '로딩 중...' : 'Loading...'}</p>
      ) : !pattern ? (
        <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
          <CalendarDays size={36} className="text-gray-600" />
          <div>
            <p className="text-white font-semibold">{ko ? '정기 일정이 설정되지 않았습니다' : 'No recurring pattern set'}</p>
            <p className="text-xs text-gray-500 mt-1">{ko ? '패턴을 설정하면 매월 일정이 자동으로 생성됩니다.' : 'Set a pattern to auto-generate monthly schedules.'}</p>
          </div>
          {canManage && (
            <button onClick={() => { loadCourses(); setShowPatternModal(true) }}
              className="bg-green-700 hover:bg-green-600 text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition">
              {ko ? '패턴 설정하기' : 'Set Pattern'}
            </button>
          )}
        </div>
      ) : !meeting ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">{ko ? '예정된 모임이 없습니다.' : 'No upcoming meetings.'}</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Meeting card ── */}
          <div className={`glass-card rounded-2xl p-4 space-y-2 ${meeting.status === 'cancelled' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400">{ko ? `${meeting.year}년 ${meeting.month}월 정기모임` : `${meeting.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Meeting`}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white font-bold text-lg">{fmtDate(meeting.date, ko)}</p>
                  {dDayBadge()}
                </div>
              </div>
              {meeting.status === 'cancelled'   && <XCircle size={20} className="text-red-400 flex-shrink-0 mt-1" />}
              {meeting.status === 'rescheduled' && <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-1" />}
              {meeting.status === 'scheduled'   && <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-1" />}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {meeting.time  && <span className="flex items-center gap-1"><Clock size={12} />{fmtTime(meeting.time.slice(0,5), ko)}</span>}
              {meeting.venue && <span className="flex items-center gap-1"><MapPin size={12} />{meeting.venue}</span>}
            </div>
            {meeting.reason && <p className="text-xs text-yellow-400">{meeting.reason}</p>}
            {noticeSent && isRsvpOpen && (
              <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={11} />{ko ? '공지 자동 발송됨' : 'Notice sent'}</p>
            )}
            {canManage && meeting.status !== 'cancelled' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => {
                  const ds = `${meeting.date.getFullYear()}-${String(meeting.date.getMonth()+1).padStart(2,'0')}-${String(meeting.date.getDate()).padStart(2,'0')}`
                  setOForm({ status: 'cancelled', date: ds, time: '', reason: '' })
                  setShowOverrideModal(true)
                }} className="flex-1 text-xs border border-gray-700 rounded-lg py-2 text-gray-400 hover:border-yellow-700 hover:text-yellow-400 transition">
                  {ko ? '일정 조정' : 'Adjust'}
                </button>
                {meeting.status !== 'scheduled' && (
                  <button onClick={removeOverride} className="flex-1 text-xs border border-gray-700 rounded-lg py-2 text-gray-400 hover:border-green-800 hover:text-green-400 transition">
                    {ko ? '원복' : 'Reset'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RSVP ── */}
          {isRsvpOpen && meeting.status !== 'cancelled' && (
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{ko ? '참석 여부' : 'RSVP'}</p>
                <span className="text-xs text-gray-500">{attending.length}{ko ? '명 참석' : ' attending'}</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">{ko ? '내 응답' : 'My response'}</p>
                <div className="flex gap-2">
                  <button onClick={() => rsvp('attending')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition ${myAtt?.status === 'attending' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    <Check size={15} />{ko ? '참석' : 'Attending'}
                  </button>
                  <button onClick={() => rsvp('absent')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition ${myAtt?.status === 'absent' ? 'bg-red-800 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    <Ban size={15} />{ko ? '불참' : 'Absent'}
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {attending.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 font-medium mb-1.5 flex items-center gap-1"><Check size={11} />{ko ? `참석 (${attending.length}명)` : `Attending (${attending.length})`}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {attending.map((a: any) => (
                        <span key={a.user_id} className="bg-green-900/30 text-green-300 text-xs px-2.5 py-1 rounded-full">
                          {lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)}
                          {a.users?.name_abbr ? ` (${a.users.name_abbr})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {absent.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 font-medium mb-1.5 flex items-center gap-1"><Ban size={11} />{ko ? `불참 (${absent.length}명)` : `Absent (${absent.length})`}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {absent.map((a: any) => (
                        <span key={a.user_id} className="bg-red-900/30 text-red-400 text-xs px-2.5 py-1 rounded-full">
                          {lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {notRespon.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1"><HelpCircle size={11} />{ko ? `미응답 (${notRespon.length}명)` : `No response (${notRespon.length})`}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {notRespon.map((m: any) => (
                        <span key={m.user_id} className="bg-gray-800 text-gray-500 text-xs px-2.5 py-1 rounded-full">
                          {memberName(m)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Groups ── */}
          {(groups.length > 0 || (canManage && isRsvpOpen && attending.length > 0)) && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users size={15} className="text-green-400" />{ko ? '조 편성' : 'Groups'}
                </p>
                {canManage && (
                  <button onClick={() => setShowGroupModal(true)} className="text-xs text-green-400 border border-green-800 rounded-full px-3 py-1">
                    <Edit2 size={11} className="inline mr-1" />{ko ? '편집' : 'Edit'}
                  </button>
                )}
              </div>
              {groups.length === 0 ? (
                <p className="text-xs text-gray-500">{ko ? '아직 조 편성이 없습니다.' : 'No groups yet.'}</p>
              ) : (
                <div className="space-y-3">
                  {groups.map((g: any) => (
                    <div key={g.group_number} className="bg-gray-800/60 rounded-xl p-3">
                      <p className="text-xs font-semibold text-green-400 mb-2">
                        {g.group_number}조{g.tee_time ? ` · ${g.tee_time}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(g.meeting_group_members ?? []).map((m: any) => (
                          <span key={m.user_id} className="bg-gray-700 text-gray-200 text-xs px-2.5 py-1 rounded-full">
                            {lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Score Section ── */}
          {isScoreOpen && meeting.status !== 'cancelled' && attending.length > 0 && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart2 size={15} className="text-yellow-400" />
                  {ko ? `${meeting.month}월 스코어` : `${meeting.date.toLocaleDateString('en-US',{month:'short'})} Scores`}
                </p>
                <div className="flex items-center gap-2">
                  {scores.length > 0 && (
                    <button
                      onClick={() => { loadYearlyAnalysis(); setShowAnalysis(true) }}
                      className="text-xs text-yellow-400 border border-yellow-800/60 rounded-full px-2.5 py-1 hover:bg-yellow-900/20 transition">
                      📊 {ko ? '연간 분석' : 'Annual'}
                    </button>
                  )}
                </div>
              </div>

              {/* Score summary if already saved */}
              {scores.length > 0 && avgGrossThis !== null && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-900/30 rounded-xl py-2">
                    <p className="text-xs text-gray-400">{ko ? '최저' : 'Best'}</p>
                    <p className="text-base font-bold text-green-300">{Math.min(...allGross)}</p>
                  </div>
                  <div className="bg-blue-900/30 rounded-xl py-2">
                    <p className="text-xs text-gray-400">{ko ? '평균' : 'Avg'}</p>
                    <p className="text-base font-bold text-blue-300">{avgGrossThis}</p>
                  </div>
                  <div className="bg-red-900/30 rounded-xl py-2">
                    <p className="text-xs text-gray-400">{ko ? '최고' : 'High'}</p>
                    <p className="text-base font-bold text-red-300">{Math.max(...allGross)}</p>
                  </div>
                </div>
              )}

              {/* Score inputs */}
              <div className="space-y-2">
                {attending.map((att: any) => {
                  const name = lang === 'ko' ? att.users?.full_name : (att.users?.full_name_en || att.users?.full_name)
                  const abbr = att.users?.name_abbr
                  const canEdit = canManage || att.user_id === user?.id
                  const existing = scores.find(s => s.user_id === att.user_id)
                  const hcInfo = clubMembers.find(m => m.user_id === att.user_id)?.club_handicap
                  return (
                    <div key={att.user_id} className="flex items-center gap-3 bg-gray-800/60 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{name}{abbr ? ` (${abbr})` : ''}</p>
                        {hcInfo != null && <p className="text-xs text-gray-500">HC {hcInfo}</p>}
                      </div>
                      {canEdit ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => setScoreInput(p => ({ ...p, [att.user_id]: String(Math.max(60, parseInt(p[att.user_id]||'72') - 1)) }))}
                            className="w-7 h-7 rounded-lg bg-gray-700 text-white text-sm font-bold hover:bg-gray-600 transition">−</button>
                          <input
                            type="number" min="60" max="150"
                            value={scoreInput[att.user_id] ?? ''}
                            onChange={e => setScoreInput(p => ({ ...p, [att.user_id]: e.target.value }))}
                            placeholder="—"
                            className="w-14 text-center bg-gray-700 border border-gray-600 rounded-lg py-1.5 text-white text-sm font-bold"
                          />
                          <button onClick={() => setScoreInput(p => ({ ...p, [att.user_id]: String(parseInt(p[att.user_id]||'72') + 1) }))}
                            className="w-7 h-7 rounded-lg bg-gray-700 text-white text-sm font-bold hover:bg-gray-600 transition">+</button>
                        </div>
                      ) : (
                        <span className={`text-sm font-bold flex-shrink-0 ${existing ? 'text-yellow-300' : 'text-gray-600'}`}>
                          {existing ? existing.gross_score : '—'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={saveScores}
                disabled={savingScores || Object.keys(scoreInput).length === 0}
                className="w-full py-3 rounded-xl bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 text-white font-bold text-sm transition flex items-center justify-center gap-2"
              >
                <BarChart2 size={15} />
                {savingScores ? (ko ? '저장 중...' : 'Saving...') : (ko ? '스코어 저장' : 'Save Scores')}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Pattern Modal ── */}
      <BottomSheet
        open={showPatternModal}
        onClose={closePatternModal}
        title={ko ? '정기 일정 패턴 설정' : 'Set Meeting Pattern'}
        footer={
          <div className="flex gap-3">
            <button onClick={closePatternModal} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={savePattern} disabled={saving} className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-bold text-sm">{saving ? '...' : (ko ? '저장' : 'Save')}</button>
          </div>
        }
      >
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '몇 번째 주' : 'Week of Month'}</label>
          <div className="grid grid-cols-5 gap-1.5">
            {[1,2,3,4,5].map(w => (
              <button key={w} type="button" onClick={() => setPForm(f => ({ ...f, week: w }))}
                className={`py-2.5 rounded-xl text-sm font-medium transition ${pForm.week === w ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {ko ? WEEK_KO[w-1] : WEEK_EN[w-1]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '요일' : 'Day of Week'}</label>
          <div className="grid grid-cols-7 gap-1">
            {[0,1,2,3,4,5,6].map(d => (
              <button key={d} type="button" onClick={() => setPForm(f => ({ ...f, dow: d }))}
                className={`py-2.5 rounded-xl text-xs font-medium transition ${pForm.dow === d ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {ko ? DOW_KO[d] : DOW_EN[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
          <p className="text-green-300 text-sm font-semibold">
            {ko ? `매월 ${WEEK_KO[pForm.week-1]}주 ${DOW_KO[pForm.dow]}요일` : `Every ${WEEK_EN[pForm.week-1]} ${DOW_EN[pForm.dow]}`}
          </p>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '모임 시간' : 'Time'}</label>
          <input type="time" value={pForm.time} onChange={e => setPForm(f => ({ ...f, time: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        </div>
        {/* Venue with course autocomplete */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '골프장 / 장소' : 'Golf Course / Venue'}</label>
          <CourseSearchInput
            value={pForm.venue}
            onChange={v => setPForm(f => ({ ...f, venue: v }))}
            onSelect={c => setPForm(f => ({ ...f, venue: c.name }))}
            placeholder={ko ? '골프장명 입력하면 자동검색...' : 'Type to search courses...'}
            useFixed
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '메모 (선택)' : 'Notes (optional)'}</label>
          <textarea rows={2} value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm resize-none" />
        </div>
      </BottomSheet>

      {/* ── Override Modal ── */}
      <BottomSheet
        open={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title={ko ? '일정 조정' : 'Adjust Schedule'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowOverrideModal(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={saveOverride} disabled={saving || (oForm.status === 'rescheduled' && !oForm.date)}
              className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-bold text-sm">{saving ? '...' : (ko ? '저장' : 'Save')}</button>
          </div>
        }
      >
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '처리 방식' : 'Action'}</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOForm(f => ({ ...f, status: 'cancelled' }))}
              className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 ${oForm.status === 'cancelled' ? 'bg-red-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
              <XCircle size={15} />{ko ? '이달 취소' : 'Cancel'}
            </button>
            <button type="button" onClick={() => setOForm(f => ({ ...f, status: 'rescheduled' }))}
              className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 ${oForm.status === 'rescheduled' ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
              <AlertTriangle size={15} />{ko ? '날짜 변경' : 'Reschedule'}
            </button>
          </div>
        </div>
        {oForm.status === 'rescheduled' && (
          <>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '변경 날짜' : 'New Date'}</label>
              <input type="date" value={oForm.date} onChange={e => setOForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '변경 시간 (선택)' : 'New Time (optional)'}</label>
              <input type="time" value={oForm.time} onChange={e => setOForm(f => ({ ...f, time: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
            </div>
          </>
        )}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '사유 (선택)' : 'Reason (optional)'}</label>
          <input value={oForm.reason} onChange={e => setOForm(f => ({ ...f, reason: e.target.value }))} placeholder={ko ? '예: 설날, 폭설' : 'e.g. Holiday'} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        </div>
      </BottomSheet>

      {/* ── Group Modal ── */}
      <BottomSheet
        open={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        title={ko ? '조 편성' : 'Group Formation'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowGroupModal(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={saveGroups} disabled={saving || assignedGroupNums.length === 0}
              className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-bold text-sm">{saving ? '...' : (ko ? '저장' : 'Save')}</button>
          </div>
        }
      >
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '자동 조편성' : 'Auto grouping'}</label>
          <div className="flex gap-2">
            <button onClick={() => buildAutoAssign('handicap')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition">
              <ListOrdered size={14} />{ko ? '핸디순' : 'By handicap'}
            </button>
            <button onClick={() => buildAutoAssign('random')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition">
              <Shuffle size={14} />{ko ? '랜덤' : 'Random'}
            </button>
          </div>
        </div>
        {attending.length > 0 ? (
          <div>
            <label className="text-xs text-gray-400 block mb-2">{ko ? '수동 조 지정' : 'Manual assignment'}</label>
            <div className="space-y-2">
              {attending.map((att: any) => {
                const name = lang === 'ko' ? att.users?.full_name : (att.users?.full_name_en || att.users?.full_name)
                const cur = assign[att.user_id]
                const maxGroup = Math.max(0, ...(Object.values(assign) as number[]))
                const numButtons = Math.min(6, Math.max(maxGroup + 1, (cur ?? 0) + 1, 4))
                return (
                  <div key={att.user_id} className="flex items-center justify-between gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                    <span className="text-sm text-white flex-1 truncate">{name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {Array.from({ length: numButtons }, (_, i) => i + 1).map(n => (
                        <button key={n}
                          onClick={() => setAssign(prev => ({ ...prev, [att.user_id]: n }))}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition ${cur === n ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 text-center py-4">{ko ? '참석자가 없습니다.' : 'No attendees yet.'}</p>
        )}
        {assignedGroupNums.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 block">{ko ? '편성 미리보기' : 'Preview'}</label>
            {assignedGroupNums.map(gn => {
              const gMembers = attending.filter((a: any) => assign[a.user_id] === gn)
              return (
                <div key={gn} className="bg-green-900/20 border border-green-800/40 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-green-400 mb-1">{gn}조 ({gMembers.length}{ko ? '명' : ''})</p>
                  <p className="text-xs text-gray-300">{gMembers.map((a: any) => lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)).join(', ')}</p>
                </div>
              )
            })}
          </div>
        )}
      </BottomSheet>

      {/* ── Annual Handicap Analysis ── */}
      <BottomSheet
        open={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        title={ko ? `${meeting?.year ?? ''}년 핸디 분석` : `${meeting?.year ?? ''} Handicap Analysis`}
        footer={
          <button onClick={() => setShowAnalysis(false)} className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">{ko ? '닫기' : 'Close'}</button>
        }
      >
        {yearlyLoading ? (
          <p className="text-center text-gray-500 py-8">{ko ? '분석 중...' : 'Analyzing...'}</p>
        ) : yearlyByUser.length === 0 ? (
          <p className="text-center text-gray-500 py-8">{ko ? '올해 등록된 스코어가 없습니다.' : 'No scores recorded this year.'}</p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {ko ? `총 ${yearlyByUser.reduce((s, u) => s + u.rounds, 0)}라운드 · ${yearlyByUser.length}명` : `${yearlyByUser.reduce((s, u) => s + u.rounds, 0)} rounds · ${yearlyByUser.length} members`}
            </p>
            <div className="space-y-3">
              {yearlyByUser.map((u) => {
                const name = lang === 'ko' ? u.user?.full_name : (u.user?.full_name_en || u.user?.full_name)
                const { delta, dir } = u.suggestion
                return (
                  <div key={u.uid} className="bg-gray-800/70 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${dir === 'down' ? 'bg-green-900/60 text-green-300' : dir === 'up' ? 'bg-red-900/60 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
                        HC {u.clubHc ?? '?'}
                        {dir === 'down' && ` → ${(u.clubHc ?? 0) + delta}`}
                        {dir === 'up'   && ` → ${(u.clubHc ?? 0) + delta}`}
                        {dir === 'stable' && ' ✓'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-500">{ko ? '라운드' : 'Rounds'}</p>
                        <p className="text-sm font-bold text-white">{u.rounds}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-500">{ko ? '평균' : 'Avg'}</p>
                        <p className="text-sm font-bold text-yellow-300">{u.avg.toFixed(1)}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-500">{ko ? '최저' : 'Best'}</p>
                        <p className="text-sm font-bold text-green-300">{u.min}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-500">{ko ? '평균-파' : 'Avg-Par'}</p>
                        <p className={`text-sm font-bold ${u.avg - u.par < (u.clubHc ?? 99) ? 'text-green-300' : 'text-red-300'}`}>
                          +{(u.avg - u.par).toFixed(0)}
                        </p>
                      </div>
                    </div>
                    {dir !== 'stable' && (
                      <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${dir === 'down' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {dir === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {ko
                          ? `평균 타수 기준 내년 핸디 ${dir === 'down' ? '감소' : '증가'} 권장 (${delta > 0 ? '+' : ''}${delta})`
                          : `Suggest ${dir === 'down' ? 'reducing' : 'increasing'} HC by ${Math.abs(delta)} next year`
                        }
                      </div>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {u.scores.map((g: number, i: number) => (
                        <span key={i} className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{g}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {canManage && (
              <p className="text-xs text-gray-500 text-center">
                {ko ? '* 핸디 실제 변경은 회원 관리에서 수동으로 적용하세요' : '* Apply HC changes manually in Members page'}
              </p>
            )}
          </>
        )}
      </BottomSheet>

    </div>
  )
}
