'use client'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  CalendarDays, Settings2, X, ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle, XCircle, Clock, MapPin, Users, Shuffle,
  ListOrdered, Check, Ban, HelpCircle, Edit2, BarChart2,
  TrendingDown, TrendingUp, Minus, UtensilsCrossed, Bell,
  BellOff, Navigation, Plus, Trash2, FileDown, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import CourseSearchInput from '@/components/ui/CourseSearchInput'
import PlaceSearchInput  from '@/components/ui/PlaceSearchInput'
import MapEmbed          from '@/components/ui/MapEmbed'
import { isSuperAdmin } from '@/lib/superAdmin'
import { romanizeKoreanName, hasHangul, formatKoreanEnglishName } from '@/lib/hangulRomanize'

// ── push helpers ──────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding   = '='.repeat((4 - base64String.length % 4) % 4)
  const base64    = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData   = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary  = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

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
    // 모임 당일까지는 기본 노출, 모임 다음날부터는 다음 모임으로 자동 이동
    // (지난 모임은 좌측 ← 화살표로 navYM 을 이동시켜 열람 — 모든 조편성/출석 데이터는 보존)
    const meetingDay = new Date(date); meetingDay.setHours(0, 0, 0, 0)
    if (meetingDay < now) continue
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
  const currentClub = myClubs.find(c => c.id === currentClubId)
  const myRole = currentClub?.role ?? 'member'
  const currentClubName = currentClub?.name ?? ''
  const isAdmin = isSuperAdmin(user)
  const canManage = ['president', 'secretary'].includes(myRole) || isAdmin

  const [pattern,     setPattern]     = useState<any>(null)
  const [overrides,   setOverrides]   = useState<any[]>([])
  const [attendances, setAttendances] = useState<any[]>([])
  const [groups,      setGroups]      = useState<any[]>([])
  const [clubMembers, setClubMembers] = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [noticeSent,  setNoticeSent]  = useState(false)

  const [showPatternModal,   setShowPatternModal]   = useState(false)
  const [showOverrideModal,  setShowOverrideModal]  = useState(false)
  const [showGroupModal,     setShowGroupModal]     = useState(false)
  const [showAnalysis,       setShowAnalysis]       = useState(false)
  const [showAttendingModal, setShowAttendingModal] = useState(false)
  const [rsvpError,          setRsvpError]          = useState<string | null>(null)
  // 회장·총무가 미응답 회원의 응답을 대신 입력할 때 — 타겟 회원
  const [proxyTarget,        setProxyTarget]        = useState<any | null>(null)
  const [proxySaving,        setProxySaving]        = useState(false)
  const [saving,             setSaving]             = useState(false)
  const [autoGroupLoading,   setAutoGroupLoading]   = useState(false)
  // 수동 조 지정 영역 회원 검색 — 한 글자만 쳐도 필터링
  const [groupSearch,        setGroupSearch]         = useState('')
  // 조별로 저장 완료한 조 — 모달에서 숨김 처리 (다음 조 편성 집중)
  const [hiddenGroupNums,    setHiddenGroupNums]     = useState<Set<number>>(new Set())
  const [showAllGroups,      setShowAllGroups]       = useState(false)
  const [savingGroupNum,     setSavingGroupNum]      = useState<number | null>(null)

  // ── month navigation (과거 기록 열람) ──────────────────────────────────────
  const [navYM, setNavYM] = useState<{ year: number; month: number } | null>(null)
  const navLoadRef = useRef(0)  // prevent stale loads

  const [pForm, setPForm] = useState({ week: 3, dow: 4, time: '07:00', venue: '', notes: '' })
  const [oForm, setOForm] = useState({ status: 'cancelled', date: '', time: '', reason: '' })
  // assign: 회원은 user_id, 게스트는 'g:<guest_id>' prefix 키로 구분
  const [assign, setAssign] = useState<Record<string, number>>({})

  // ── Guest 추천 ──────────────────────────────────────────────────────
  const [guests,      setGuests]      = useState<any[]>([])
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [guestForm, setGuestForm] = useState({ full_name: '', full_name_en: '', handicap: '', notes: '' })
  const [guestSaving, setGuestSaving] = useState(false)
  const [guestError,  setGuestError]  = useState<string | null>(null)

  // 조별 티오프 시간 — { 1: '06:49', 2: '07:03', ... }
  const [teeTimes, setTeeTimes] = useState<Record<number, string>>({})
  // 조별 코스 이름 — { 1: 'Stella-Sole', 2: 'Luna-Stella', ... }
  const [courseNames, setCourseNames] = useState<Record<number, string>>({})
  // 골프장 응답 원본 (참고용 — 파싱하지 않고 화면에만 보존)
  const [courseReplyMemo, setCourseReplyMemo] = useState('')
  // 골프장 응답 붙여넣기 모달
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText,      setPasteText]      = useState('')
  const [rosterCopied, setRosterCopied] = useState(false)
  // 영문 명단 미리보기 모달
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [rosterText, setRosterText] = useState('')
  const [rosterMissing, setRosterMissing] = useState<string[]>([])

  // ── 2차 모임 ──────────────────────────────────────────────────────────────
  const [secondMeeting,    setSecondMeeting]    = useState<any | null>(null)
  const [secondAtts,       setSecondAtts]       = useState<any[]>([])
  const [showSecondModal,  setShowSecondModal]  = useState(false)
  const [savingSecond,     setSavingSecond]     = useState(false)
  const [sendingPush,      setSendingPush]      = useState(false)
  const [pushResult,       setPushResult]       = useState<string | null>(null)
  const emptySecondForm = { name: '', address: '', placeId: '', lat: '', lng: '', time: '19:00', notes: '' }
  const [sForm, setSForm] = useState(emptySecondForm)

  // ── push notification subscription ────────────────────────────────────
  const [pushEnabled,  setPushEnabled]  = useState(false)
  const [pushLoading,  setPushLoading]  = useState(false)

  // golf course picker ─────────────────────────────────────────────────
  const [courses,          setCourses]          = useState<any[]>([])
  const [courseSearch,     setCourseSearch]     = useState('')
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [coursesLoading,   setCoursesLoading]   = useState(false)

  async function loadCourses() {
    if (courses.length > 0) return
    setCoursesLoading(true)
    const supabase = createClient()
    // 실제 DB 스키마와 마이그레이션 SQL 사이 불일치 존재 — 안전하게 select('*') 으로
    // 받고, 결과에서 필요한 필드만 코드에서 옵셔널로 사용. 컬럼이 없는 환경에서도
    // 콘솔 에러 없이 동작.
    const { data, error } = await supabase
      .from('golf_courses')
      .select('*')
      .eq('is_active', true)
    if (error) {
      // 테이블 자체가 없거나 RLS 차단 — 빈 배열로 폴백 (UI 는 venue 텍스트 그대로 사용)
      console.warn('golf_courses unavailable (using fallback):', error.message)
      setCourses([])
    } else {
      // distance_km 가 있으면 그 기준 정렬, 없으면 이름순
      const sorted = (data ?? []).slice().sort((a: any, b: any) => {
        if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km
        return String(a.name ?? '').localeCompare(String(b.name ?? ''))
      })
      setCourses(sorted)
    }
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
    const [{ data: att }, { data: grps }, { data: sc }, { data: sm }, { data: gst }] = await Promise.all([
      supabase.from('meeting_attendances')
        .select('user_id, status, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month),
      supabase.from('meeting_groups')
        .select('group_number, tee_time, course_name, meeting_group_members(user_id, guest_id, users(full_name, full_name_en, name_abbr), meeting_guests(full_name, full_name_en, handicap))')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month).order('group_number'),
      supabase.from('round_scores')
        .select('user_id, gross_score, handicap_used, net_score, course_name, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month),
      supabase.from('second_meetings')
        .select('*, second_meeting_attendances(user_id, status, users(full_name, full_name_en, name_abbr))')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month).maybeSingle(),
      supabase.from('meeting_guests')
        .select('id,full_name,full_name_en,handicap,notes,recommended_by,approved,approved_by,approved_at,created_at,recommender:users!recommended_by(full_name)')
        .eq('club_id', currentClubId).eq('year', year).eq('month', month)
        .order('created_at', { ascending: false }),
    ])
    setAttendances(att ?? [])
    setGuests(gst ?? [])
    setGroups(grps ?? [])
    setScores(sc ?? [])
    setSecondMeeting(sm ?? null)
    setSecondAtts(sm?.second_meeting_attendances ?? [])
    if (sm) setSForm({ name: sm.restaurant_name, address: sm.restaurant_address ?? '', placeId: sm.google_place_id ?? '', lat: sm.lat ? String(sm.lat) : '', lng: sm.lng ? String(sm.lng) : '', time: sm.time ?? '19:00', notes: sm.notes ?? '' })
    const a: Record<string, number> = {}
    const tt: Record<number, string> = {}
    const cn: Record<number, string> = {}
    ;(grps ?? []).forEach((g: any) => {
      if (g.tee_time) tt[g.group_number] = String(g.tee_time).slice(0, 5)  // HH:MM
      if (g.course_name) cn[g.group_number] = g.course_name
      g.meeting_group_members?.forEach((m: any) => {
        const key = m.guest_id ? `g:${m.guest_id}` : m.user_id
        if (key) a[key] = g.group_number
      })
    })
    setAssign(a)
    setTeeTimes(tt)
    setCourseNames(cn)
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

  useEffect(() => {
    load()
    function onWake() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
    }
  }, [currentClubId])

  const meeting = useMemo(() => getRelevantMeeting(pattern, overrides), [pattern, overrides])

  useEffect(() => {
    if (!meeting) return
    loadRsvp(meeting.year, meeting.month)
    function onWake() {
      if (document.visibilityState === 'visible' && meeting) loadRsvp(meeting.year, meeting.month)
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
    }
  }, [meeting?.year, meeting?.month, currentClubId])

  // ── navigation-based display meeting ──────────────────────────────────────
  // navYM null = show current/upcoming meeting; non-null = show that specific month
  const displayMeeting = useMemo(() => {
    if (!navYM || !pattern) return meeting
    const ov = overrides.find((o: any) => o.year === navYM.year && o.month === navYM.month)
    let date: Date | null
    if (ov?.status === 'rescheduled' && ov.override_date) {
      date = new Date(ov.override_date + 'T00:00:00')
    } else {
      date = getNthWeekday(navYM.year, navYM.month, pattern.week_of_month, pattern.day_of_week)
    }
    return {
      year:   navYM.year,
      month:  navYM.month,
      date:   date ?? new Date(navYM.year, navYM.month - 1, 1),
      time:   ov?.override_time ?? pattern.start_time,
      venue:  pattern.venue,
      status: ov?.status ?? 'scheduled',
      reason: ov?.reason ?? null,
    }
  }, [navYM, pattern, overrides, meeting])

  // is the currently viewed month in the past?
  const nowDate     = new Date(); nowDate.setHours(0, 0, 0, 0)
  const viewY       = displayMeeting?.year  ?? nowDate.getFullYear()
  const viewM       = displayMeeting?.month ?? nowDate.getMonth() + 1
  const isPastView  = new Date(viewY, viewM - 1) < new Date(nowDate.getFullYear(), nowDate.getMonth())

  // navigate to prev/next month
  function navMonth(delta: number) {
    const base = navYM ?? (meeting ? { year: meeting.year, month: meeting.month } : { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 })
    let y = base.year, m = base.month + delta
    if (m > 12) { m = 1;  y++ }
    if (m < 1)  { m = 12; y-- }
    // limit: 24 months back, 2 months forward
    const targetDate = new Date(y, m - 1)
    if (targetDate < new Date(nowDate.getFullYear(), nowDate.getMonth() - 24)) return
    if (targetDate > new Date(nowDate.getFullYear(), nowDate.getMonth() + 2))  return
    const token = ++navLoadRef.current
    setNavYM({ year: y, month: m })
    loadRsvp(y, m).then(() => { if (navLoadRef.current !== token) {} })
  }

  function navReset() {
    setNavYM(null)
    if (meeting) loadRsvp(meeting.year, meeting.month)
  }

  const daysUntil   = meeting?.date ? getDaysUntil(meeting.date) : null
  // RSVP 창: D-14 ~ D-(-1) (과거 1일까지). 이전엔 비활성으로 노출.
  const isRsvpOpen  = !isPastView && daysUntil !== null && daysUntil <= 14 && daysUntil >= -1
  // RSVP 영역 자체는 D-30 이내 미래 모임에 모두 노출 (비활성 상태로라도)
  const showRsvpArea = !isPastView && displayMeeting?.status !== 'cancelled' && daysUntil !== null && daysUntil >= -1
  const isScoreOpen = isPastView || (daysUntil !== null && daysUntil <= 1)

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
  // 응답 변경 허용: API 는 upsert(onConflict) 로 항상 갱신 가능. 잘못 누른 회원이
  // 별도 취소 단계 없이 다시 눌러 번복할 수 있어야 함.
  async function rsvp(status: 'attending' | 'absent') {
    if (!meeting || !user) return
    if (myAtt?.status === status) return  // 이미 같은 응답이면 무시 (불필요한 호출 방지)

    // Optimistic update
    setAttendances(prev => {
      const without = prev.filter(a => a.user_id !== user.id)
      return [...without, { user_id: user.id, status, users: user }]
    })

    const res = await fetch('/api/meetings/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: currentClubId, year: meeting.year, month: meeting.month, status })
    })
    const data = await res.json()
    if (!res.ok) {
      // Revert optimistic
      setAttendances(prev => prev.filter(a => a.user_id !== user.id))
      setRsvpError(ko ? '저장에 실패했습니다. 잠시 후 다시 시도해주세요.' : 'Save failed. Please try again.')
      setTimeout(() => setRsvpError(null), 4000)
    } else {
      setRsvpError(null)
    }
    await loadRsvp(meeting.year, meeting.month)
  }

  // 회장·총무 대리 응답 — 타겟 회원의 RSVP 를 강제로 설정
  async function proxyRsvp(targetUserId: string, status: 'attending' | 'absent') {
    if (!meeting || !user || !canManage) {
      console.warn('[proxy-rsvp] blocked', { hasMeeting: !!meeting, hasUser: !!user, canManage })
      return
    }
    console.log('[proxy-rsvp] start', { targetUserId, status, year: meeting.year, month: meeting.month })
    setProxySaving(true)
    // Optimistic update
    setAttendances(prev => {
      const without = prev.filter(a => a.user_id !== targetUserId)
      const tgt = clubMembers.find(m => m.user_id === targetUserId)
      return [...without, { user_id: targetUserId, status, users: tgt?.users }]
    })
    let resBody = ''
    let ok = false
    try {
      const res = await fetch('/api/meetings/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: currentClubId, year: meeting.year, month: meeting.month,
          status, target_user_id: targetUserId,
        })
      })
      ok = res.ok
      resBody = await res.text()
      console.log('[proxy-rsvp] response', { status: res.status, body: resBody })
    } catch (e: any) {
      console.error('[proxy-rsvp] network error', e)
    }
    setProxySaving(false)
    if (!ok) {
      setRsvpError(ko ? `대리 응답 저장 실패: ${resBody}` : `Proxy RSVP failed: ${resBody}`)
      setTimeout(() => setRsvpError(null), 6000)
    }
    await loadRsvp(meeting.year, meeting.month)
    setProxyTarget(null)
  }

  // 회장·총무 대리 응답 취소
  async function proxyCancel(targetUserId: string) {
    if (!meeting || !user || !canManage) return
    setProxySaving(true)
    setAttendances(prev => prev.filter(a => a.user_id !== targetUserId))
    const res = await fetch('/api/meetings/rsvp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        club_id: currentClubId, year: meeting.year, month: meeting.month,
        target_user_id: targetUserId,
      })
    })
    setProxySaving(false)
    if (!res.ok) {
      setRsvpError(ko ? '취소 실패' : 'Cancel failed')
      setTimeout(() => setRsvpError(null), 4000)
    }
    await loadRsvp(meeting.year, meeting.month)
    setProxyTarget(null)
  }

  async function cancelRsvp() {
    if (!meeting || !user || !myAtt) return

    // Optimistic remove
    setAttendances(prev => prev.filter(a => a.user_id !== user.id))

    const res = await fetch('/api/meetings/rsvp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ club_id: currentClubId, year: meeting.year, month: meeting.month })
    })
    const data = await res.json()
    if (!res.ok) {
      await loadRsvp(meeting.year, meeting.month)
      setRsvpError(ko ? '취소에 실패했습니다. 잠시 후 다시 시도해주세요.' : 'Cancel failed. Please try again.')
      setTimeout(() => setRsvpError(null), 4000)
    } else {
      setRsvpError(null)
      await loadRsvp(meeting.year, meeting.month)
    }
  }

  // ── Guest 추천 ────────────────────────────────────────────────────────
  // ❗ 여러 명을 동시에 입력해도 자동으로 분리해서 1인 1행으로 등록 (조 편성·영문 명단에서 개별 처리되도록)
  async function recommendGuest() {
    if (!guestForm.full_name.trim() || !meeting || !currentClubId || !user) return
    setGuestSaving(true); setGuestError(null)
    const supabase = createClient()
    const hcNum = guestForm.handicap.trim() ? parseInt(guestForm.handicap, 10) : null

    // 구분자: 쉼표 / 슬래시 / 앰퍼샌드 / 미들닷 / 한국 / 일본 구두점
    const SEP = /\s*[,/&·、・]+\s*/
    const koNames = guestForm.full_name.split(SEP).map(s => s.trim()).filter(Boolean)
    const enNamesRaw = guestForm.full_name_en.split(SEP).map(s => s.trim()).filter(Boolean)
    if (koNames.length === 0) { setGuestSaving(false); return }

    // 영문이름 매칭 — 동수면 1:1, 아니면 그 외는 null (사용자 직접 입력 유도)
    function enFor(i: number): string | null {
      if (enNamesRaw.length === koNames.length) return enNamesRaw[i] || null
      if (koNames.length === 1 && enNamesRaw.length > 0) return enNamesRaw.join(' ') || null
      return null
    }

    const rows = koNames.map((name, i) => ({
      club_id: currentClubId,
      year: meeting.year,
      month: meeting.month,
      full_name: name,
      full_name_en: enFor(i),
      handicap: Number.isFinite(hcNum as number) ? hcNum : null,
      notes: guestForm.notes.trim() || null,
      recommended_by: user.id,
    }))

    const { error } = await supabase.from('meeting_guests').insert(rows)
    setGuestSaving(false)
    if (error) { setGuestError(error.message); return }
    setShowGuestModal(false)
    setGuestForm({ full_name: '', full_name_en: '', handicap: '', notes: '' })
    await loadRsvp(meeting.year, meeting.month)
  }

  async function approveGuest(g: any) {
    if (!user) return
    const supabase = createClient()
    const { error } = await supabase.from('meeting_guests').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', g.id)
    if (error) { alert(ko ? `승인 실패: ${error.message}` : `Failed: ${error.message}`); return }
    if (meeting) await loadRsvp(meeting.year, meeting.month)
  }
  async function rejectGuest(g: any) {
    if (!confirm(ko ? `'${g.full_name}' 추천을 거절(삭제) 하시겠습니까?` : `Reject guest '${g.full_name}'?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('meeting_guests').delete().eq('id', g.id)
    if (error) { alert(ko ? `거절 실패: ${error.message}` : `Failed: ${error.message}`); return }
    if (meeting) await loadRsvp(meeting.year, meeting.month)
  }

  // ── auto grouping ──────────────────────────────────────────────────────
  // method 'top4'  : 전달 핸디 상위순 → 상위 4명씩 순서대로 같은 조 배정
  // method 'random': 랜덤 셔플 후 4명씩 순서대로 배정
  async function buildAutoAssign(method: 'top4' | 'random') {
    // 회원 풀
    const memberPool = clubMembers
      .filter(m => attendances.find(a => a.user_id === m.user_id && a.status === 'attending'))
      .map(m => ({ key: m.user_id as string, handicap: m.club_handicap as number | null, isGuest: false }))
    // 승인된 게스트 풀 — 핸디 없으면 99
    const guestPool = guests
      .filter(g => g.approved)
      .map(g => ({ key: `g:${g.id}`, handicap: g.handicap as number | null, isGuest: true }))
    let ordered = [...memberPool, ...guestPool]

    if (method === 'random') {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]]
      }
    } else {
      // top4: 전달 round_scores.handicap_used 기준 (게스트는 자체 handicap 사용)
      setAutoGroupLoading(true)
      try {
        if (meeting) {
          const prevMonth = meeting.month === 1 ? 12 : meeting.month - 1
          const prevYear  = meeting.month === 1 ? meeting.year - 1 : meeting.year
          const supabase  = createClient()
          const { data: prevScores } = await supabase
            .from('round_scores')
            .select('user_id, handicap_used')
            .eq('club_id', currentClubId)
            .eq('year', prevYear)
            .eq('month', prevMonth)
          const scoreMap: Record<string, number> = {}
          prevScores?.forEach((s: any) => {
            if (s.handicap_used != null) scoreMap[s.user_id] = s.handicap_used
          })
          ordered.sort((a, b) => {
            const ha = a.isGuest ? (a.handicap ?? 99) : (scoreMap[a.key] ?? (a.handicap ?? 99))
            const hb = b.isGuest ? (b.handicap ?? 99) : (scoreMap[b.key] ?? (b.handicap ?? 99))
            return ha - hb
          })
        }
      } finally {
        setAutoGroupLoading(false)
      }
    }

    // 4명씩 끊어서 순서대로 조 배정 (1~4번 → 1조, 5~8번 → 2조, …)
    const a: Record<string, number> = {}
    ordered.forEach((m, i) => { a[m.key] = Math.floor(i / 4) + 1 })
    setAssign(a)
  }

  // ── save groups ────────────────────────────────────────────────────────
  // assign 키 형식: 일반 회원 = user_id (uuid) / 게스트 = 'g:<guest_id>' prefix
  // opts.keepOpen: 조 단위 저장 시 모달을 닫지 않고 다음 조 편성으로 이어감
  //
  // ⭐ 강력한 체인: 그룹 번호 union 으로 저장 — 회원 배정·시간·코스 중 하나라도
  //    값이 있으면 그 조를 살림. 그래야 paste 로 입력한 미래 조의 시간/코스가
  //    1조 저장 사이클에서 통째로 날아가지 않음.
  async function saveGroups(opts: { keepOpen?: boolean } = {}) {
    if (!meeting || !currentClubId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('meeting_groups').delete().eq('club_id', currentClubId).eq('year', meeting.year).eq('month', meeting.month)

    // 다중 트리 union: assign / teeTimes / courseNames 모두에서 그룹 번호 수집
    const allGroupNums = new Set<number>()
    Object.values(assign).forEach(n => { if (typeof n === 'number' && n > 0) allGroupNums.add(n) })
    Object.entries(teeTimes).forEach(([k, v]) => { const n = parseInt(k); if (!isNaN(n) && n > 0 && v) allGroupNums.add(n) })
    Object.entries(courseNames).forEach(([k, v]) => { const n = parseInt(k); if (!isNaN(n) && n > 0 && v?.trim()) allGroupNums.add(n) })
    const nums = [...allGroupNums].sort((a, b) => a - b)

    for (const gNum of nums) {
      const { data: g } = await supabase.from('meeting_groups').insert({
        club_id: currentClubId, year: meeting.year, month: meeting.month,
        group_number: gNum,
        tee_time: teeTimes[gNum] || null,
        course_name: courseNames[gNum]?.trim() || null,
      }).select().single()
      if (g) {
        const keys = Object.entries(assign).filter(([, n]) => n === gNum).map(([k]) => k)
        const rows = keys.map(k => k.startsWith('g:')
          ? { group_id: g.id, user_id: null, guest_id: k.slice(2) }
          : { group_id: g.id, user_id: k, guest_id: null }
        )
        if (rows.length) await supabase.from('meeting_group_members').insert(rows)
      }
    }
    setSaving(false)
    if (!opts.keepOpen) setShowGroupModal(false)
    await loadRsvp(meeting.year, meeting.month)
  }

  // ── 골프장 응답 파서 ────────────────────────────────────────────────
  // 처리 규칙:
  //   1. 시간이 없는 줄(인사말·헤더·이름)은 자동 무시.
  //   2. "7:38/7:45/7:52am Luna-Stella" → 3개 시간 × 같은 코스 = 3 그룹
  //   3. am/pm 이 마지막 시간에만 붙어도 같은 줄 전체에 적용.
  //   4. 조 번호는 발견 순서대로 1·2·3… 자동 부여.
  //   5. "1조 06:30 Stella-Sole" 같은 단일 그룹 형식도 그대로 작동.
  function parsePasteText(text: string): { group: number; time: string; course: string }[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const out: { group: number; time: string; course: string }[] = []
    let groupNum = 0

    for (const line of lines) {
      // 한 줄의 모든 시간 추출 (HH:MM 또는 H:MM, am/pm 선택)
      const timeMatches = [...line.matchAll(/(\d{1,2}):(\d{2})\s*(am|pm)?/gi)]
      if (timeMatches.length === 0) continue   // 시간 없는 줄 = 인사말/이름 → 무시

      // am/pm 폴백 — 마지막 시간에만 적힌 경우 같은 줄 전체에 적용
      const ampmFallback = (timeMatches.map(m => (m[3] ?? '').toLowerCase()).find(x => x) ?? '')

      // 코스 추출: 시간·조번호·구분 기호 제거
      let course = line
        .replace(/(\d{1,2}):(\d{2})\s*(am|pm)?/gi, '')
        .replace(/(\d+)\s*조/gi, '')
        .replace(/조\s*(\d+)/gi, '')
        .replace(/(?:Group|G|#)\s*\d+/gi, '')
        .replace(/[\/]+/g, ' ')                         // 시간 사이 슬래시만 제거 (Luna-Stella 의 하이픈은 보존)
        .replace(/^[\s\-:|,;.]+|[\s\-:|,;.]+$/g, '')   // 앞뒤 군더더기 punctuation 제거
        .replace(/\s+/g, ' ')
        .trim()
      if (/^\d+$/.test(course)) course = ''

      // 각 시간을 한 그룹으로
      for (const tm of timeMatches) {
        groupNum++
        let hour = parseInt(tm[1])
        const mm = tm[2]
        const ampm = ((tm[3] ?? '').toLowerCase() || ampmFallback)
        if (ampm === 'pm' && hour < 12) hour += 12
        if (ampm === 'am' && hour === 12) hour = 0
        const time = `${String(hour).padStart(2,'0')}:${mm}`
        out.push({ group: groupNum, time, course })
      }
    }
    return out
  }
  const pasteParsed = parsePasteText(pasteText)

  // 파싱 결과 적용 → state 세팅 후 조 편성 모달 열기
  function applyPaste() {
    const tt: Record<number, string> = {}
    const cn: Record<number, string> = {}
    pasteParsed.forEach(p => {
      if (p.time)   tt[p.group] = p.time
      if (p.course) cn[p.group] = p.course
    })
    setTeeTimes(prev => ({ ...prev, ...tt }))
    setCourseNames(prev => ({ ...prev, ...cn }))
    setCourseReplyMemo(pasteText.trim())
    setShowPasteModal(false)
    // 조 편성 모달 열어 회원 배정 단계로 이어짐
    setShowGroupModal(true)
  }

  // ── 영문 명단 — 시간/코스 포함하여 미리보기 모달 ──────────────────
  // 조 편성이 있으면 조별로 그룹화, 없으면 전체 명단 단순 번호 매김
  // ❗ 강제 영문 + 클럽 표준 포맷: "성 이름" (이름은 공백 없이 한 단어)
  function openRosterPreview() {
    const missing: string[] = []
    const enOf = (ko: string, en: string | null | undefined) => {
      const e = (en ?? '').trim()
      if (e && !hasHangul(e)) {
        // 영문 존재 — 표준 포맷으로 강제 정규화 ("Baik dae jun" → "Baik Daejun")
        return formatKoreanEnglishName(e)
      }
      // 영문 누락 (또는 영문 필드에 한글) → 한글 이름 로마자 변환 + 포맷
      missing.push(ko || e || '?')
      return formatKoreanEnglishName(ko || e || '')
    }
    // 조 편성이 있으면 (assign 에 값이 있고 그룹별 분리 가능)
    const numsInAssign = [...new Set(Object.values(assign) as number[])].sort()
    let text = ''
    if (pattern?.venue) text += `📍 ${pattern.venue}\n`
    if (meeting) text += `🗓️ ${meeting.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}\n\n`

    if (numsInAssign.length > 0) {
      // 그룹별 출력
      for (const gn of numsInAssign) {
        const tee = teeTimes[gn] ? teeTimes[gn] : ''
        const course = courseNames[gn]?.trim() ?? ''
        const header = [`Group ${gn}`, tee, course].filter(Boolean).join(' · ')
        text += `▶ ${header}\n`
        const items = Object.entries(assign).filter(([, n]) => n === gn).map(([k]) => k)
        items.forEach((k, i) => {
          if (k.startsWith('g:')) {
            const gId = k.slice(2)
            const g = guests.find(x => x.id === gId)
            if (g) {
              const en = enOf(g.full_name ?? '', g.full_name_en)
              text += `  ${i + 1}. ${en} (G)\n`
            }
          } else {
            const att = attending.find(a => a.user_id === k)
            const u = att?.users
            const en = enOf(u?.full_name ?? '', u?.full_name_en)
            text += `  ${i + 1}. ${en}\n`
          }
        })
        text += '\n'
      }
      text += `MGF Guest!\nThanks sir!`
    } else {
      // 조 편성 전 — 단순 명단
      const lines: string[] = []
      attending.forEach((a: any) => {
        lines.push(enOf(a.users?.full_name ?? '', a.users?.full_name_en))
      })
      guests.filter(g => g.approved).forEach(g => {
        lines.push(`${enOf(g.full_name ?? '', g.full_name_en)} (G)`)
      })
      text += lines.map((n, i) => `${i + 1}. ${n}`).join('\n')
    }

    setRosterText(text)
    setRosterMissing(missing)
    setShowRosterModal(true)
  }
  function copyRosterFromModal() {
    navigator.clipboard?.writeText(rosterText).then(() => {
      setRosterCopied(true)
      setTimeout(() => { setRosterCopied(false); setShowRosterModal(false) }, 1200)
    }).catch(() => {
      const t = document.createElement('textarea'); t.value = rosterText
      document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t)
      setRosterCopied(true)
      setTimeout(() => { setRosterCopied(false); setShowRosterModal(false) }, 1200)
    })
  }

  // ── export groups to CSV / Excel ─────────────────────────────────────────
  function exportGroupsCSV() {
    if (!groups.length || !meeting) return
    const BOM = '\uFEFF'
    const headers = ['티오프', '코스', '한글 이름', '영문 이름', '핸디', '결과', '비고']
    const rows: string[][] = []
    const sorted = [...groups].sort((a: any, b: any) => a.group_number - b.group_number)
    sorted.forEach((g: any) => {
      const tee = g.tee_time ? String(g.tee_time).slice(0, 5) : ''
      const tDisplay = tee ? (() => {
        const [hh, mm] = tee.split(':')
        return `${parseInt(hh,10)}시 ${mm}분`
      })() : `${g.group_number}조`
      const course = g.course_name ?? ''
      const mems = (g.meeting_group_members ?? [])
      mems.forEach((m: any, idx: number) => {
        let nameKo = '', nameEn = '', hc: number | null = null, isGuest = false
        if (m.guest_id) {
          isGuest = true
          const gst = Array.isArray(m.meeting_guests) ? m.meeting_guests[0] : m.meeting_guests
          nameKo = gst?.full_name ?? ''
          nameEn = gst?.full_name_en ?? gst?.full_name ?? ''
          hc = gst?.handicap ?? null
        } else {
          nameKo = m.users?.full_name ?? ''
          nameEn = m.users?.full_name_en ?? m.users?.full_name ?? ''
          hc = clubMembers.find(cm => cm.user_id === m.user_id)?.club_handicap ?? null
        }
        rows.push([
          idx === 0 ? tDisplay : '',
          idx === 0 ? course : '',
          nameKo + (isGuest ? '(G)' : ''),
          nameEn + (isGuest ? '(G)' : ''),
          hc != null ? String(hc) : '',
          '-',
          '',
        ])
      })
      rows.push(['', '', '', '', '', '', ''])  // 조 사이 빈 줄
    })
    const title = `${meeting.year}년 ${meeting.month}월 모임`
    const venue = pattern?.venue ? ` (${pattern.venue})` : ''
    const csv = BOM
      + `"${title}${venue}"\n\n`
      + [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `조편성_${meeting.year}년${meeting.month}월.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  // ── 2차 모임 저장/수정 ─────────────────────────────────────────────────────
  async function saveSecondMeeting() {
    if (!meeting || !currentClubId || !sForm.name.trim()) return
    setSavingSecond(true)
    const supabase = createClient()
    const { data: { user: au } } = await supabase.auth.getUser()
    if (!au) return
    const payload = {
      club_id:            currentClubId,
      year:               meeting.year,
      month:              meeting.month,
      restaurant_name:    sForm.name.trim(),
      restaurant_address: sForm.address.trim() || null,
      google_place_id:    sForm.placeId || null,
      lat:                sForm.lat ? parseFloat(sForm.lat) : null,
      lng:                sForm.lng ? parseFloat(sForm.lng) : null,
      time:               sForm.time || null,
      notes:              sForm.notes.trim() || null,
      confirmed_by:       au.id,
      updated_at:         new Date().toISOString(),
    }
    const { data } = await supabase.from('second_meetings')
      .upsert(payload, { onConflict: 'club_id,year,month' }).select().single()
    setSecondMeeting(data)
    setSavingSecond(false)
    setShowSecondModal(false)
    await loadRsvp(meeting.year, meeting.month)
  }

  async function deleteSecondMeeting() {
    if (!secondMeeting) return
    const supabase = createClient()
    await supabase.from('second_meetings').delete().eq('id', secondMeeting.id)
    setSecondMeeting(null)
    setSecondAtts([])
    setSForm(emptySecondForm)
  }

  // ── 2차 모임 RSVP ──────────────────────────────────────────────────────────
  async function rsvpSecond(status: 'attending' | 'absent') {
    if (!secondMeeting || !meeting || !user) return
    const supabase = createClient()
    await supabase.from('second_meeting_attendances').upsert(
      { club_id: currentClubId, year: meeting.year, month: meeting.month, second_meeting_id: secondMeeting.id, user_id: user.id, status, responded_at: new Date().toISOString() },
      { onConflict: 'second_meeting_id,user_id' }
    )
    await loadRsvp(meeting.year, meeting.month)
  }

  // ── Push 구독 토글 ──────────────────────────────────────────────────────────
  const checkPushStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setPushEnabled(!!sub)
  }, [])

  useEffect(() => { checkPushStatus() }, [checkPushStatus])

  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert(ko ? '이 브라우저는 알림을 지원하지 않습니다.' : 'Push not supported in this browser.')
      return
    }
    setPushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (pushEnabled) {
        // 구독 해제
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
          await sub.unsubscribe()
        }
        setPushEnabled(false)
      } else {
        // 권한 요청 & 구독
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          alert(ko ? '알림 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.' : 'Notification permission required.')
          return
        }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: arrayBufferToBase64(sub.getKey('p256dh')), auth: arrayBufferToBase64(sub.getKey('auth')) } }),
        })
        setPushEnabled(true)
      }
    } finally {
      setPushLoading(false)
    }
  }

  // ── 2차 모임 알림 발송 ──────────────────────────────────────────────────────
  async function sendSecondMeetingNotification() {
    if (!secondMeeting || !meeting || !currentClubId) return
    setSendingPush(true)
    setPushResult(null)
    try {
      const timeStr = secondMeeting.time ? ` ${secondMeeting.time}` : ''
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: currentClubId,
          title:   ko ? `🍽️ ${meeting.month}월 2차 모임 안내` : `🍽️ After-party ${meeting.date.toLocaleDateString('en-US', { month: 'short' })}`,
          body:    `📍 ${secondMeeting.restaurant_name}${timeStr}${secondMeeting.restaurant_address ? `\n${secondMeeting.restaurant_address}` : ''}`,
          url:     '/meetings',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPushResult(ko ? `${data.sent}명에게 알림 발송 완료` : `Sent to ${data.sent} members`)
    } catch (e: any) {
      setPushResult(ko ? `발송 실패: ${e.message}` : `Failed: ${e.message}`)
    } finally {
      setSendingPush(false)
    }
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

  // 미리보기·저장 대상 그룹 — assign / teeTimes / courseNames 어디 하나라도 값 있으면 포함
  const assignedGroupNums = (() => {
    const s = new Set<number>()
    Object.values(assign).forEach(n => { if (typeof n === 'number' && n > 0) s.add(n) })
    Object.entries(teeTimes).forEach(([k, v]) => { const n = parseInt(k); if (!isNaN(n) && n > 0 && v) s.add(n) })
    Object.entries(courseNames).forEach(([k, v]) => { const n = parseInt(k); if (!isNaN(n) && n > 0 && v?.trim()) s.add(n) })
    return [...s].sort((a, b) => a - b)
  })()

  // score summary for this meeting
  const thisMonthScores = scores.filter(s => parseInt(scoreInput[s.user_id] ?? '0') > 0 || s.gross_score > 0)
  const allGross = scores.map(s => s.gross_score).filter(Boolean)
  const avgGrossThis = allGross.length ? Math.round(allGross.reduce((a, b) => a + b, 0) / allGross.length) : null

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-4 pb-28 max-w-md mx-auto">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} style={{ color: 'var(--silver)' }} className="p-1"><ChevronLeft size={20} /></button>
        <CalendarDays size={18} style={{ color: 'var(--gold-l)' }} />
        <h1 className="text-base font-bold flex-1" style={{ color: 'var(--text)' }}>{ko ? '정기모임 일정' : 'Regular Meetings'}</h1>
        {canManage && (
          <button onClick={() => { loadCourses(); setShowPatternModal(true) }}
            className="flex items-center gap-1 text-xs rounded-full px-3 py-1.5"
            style={{ color: 'var(--gold-l)', border: '1px solid rgba(201,168,76,0.35)' }}>
            <Settings2 size={12} />{ko ? '패턴 설정' : 'Pattern'}
          </button>
        )}
      </div>

      {/* ── Month navigation ── */}
      {pattern && !loading && (
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => navMonth(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition flex-shrink-0">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-white font-bold text-sm">
              {ko ? `${viewY}년 ${viewM}월` : new Date(viewY, viewM - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </p>
            {isPastView ? (
              <button onClick={navReset} className="text-[10px] text-amber-400 underline decoration-dotted">
                📁 {ko ? '과거 기록 · 현재로 돌아가기' : 'Past record · Back to current'}
              </button>
            ) : (
              <p className="text-[10px]" style={{ color: 'var(--gold-l)' }}>{ko ? '현재 모임' : 'Current meeting'}</p>
            )}
          </div>
          <button onClick={() => navMonth(1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition flex-shrink-0">
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-16">{ko ? '로딩 중...' : 'Loading...'}</p>
      ) : !pattern ? (
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
          <CalendarDays size={36} className="text-gray-400" />
          <div>
            <p className="text-white font-semibold">{ko ? '정기 일정이 설정되지 않았습니다' : 'No recurring pattern set'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {ko ? '현재 클럽:' : 'Current club:'}{' '}
              <span className="text-amber-300 font-semibold">{currentClubName || '(미선택)'}</span>
            </p>
          </div>

          {/* 디버그 정보 — 어느 클럽 보고 있는지 정확히 표시 */}
          <div className="w-full text-left text-[10px] rounded-lg px-3 py-2 space-y-0.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-3)' }}>
            <p>club_id: <span className="font-mono">{currentClubId?.slice(0, 8) ?? '(없음)'}…</span></p>
            <p>가입 클럽 ({myClubs.length}개):</p>
            {myClubs.map(c => (
              <p key={c.id} className={c.id === currentClubId ? 'text-amber-300 ml-2' : 'ml-2'}>
                {c.id === currentClubId ? '▶ ' : '  '}{c.name} ({c.role})
              </p>
            ))}
          </div>

          {/* 가능 원인 안내 — 자정마다 자동 캐시 삭제되므로 stale 문제는 자동 해결 */}
          <div className="text-xs text-gray-400 space-y-1.5 max-w-sm">
            <p>{ko ? '다른 클럽 선택 중일 수 있습니다 — 상단 클럽명 탭하여 전환해 보세요.' : 'You may be viewing the wrong club — tap the club name at top to switch.'}</p>
          </div>

          {canManage && (
            <button onClick={() => { loadCourses(); setShowPatternModal(true) }}
              className="text-white text-sm px-5 py-2.5 rounded-xl font-semibold transition btn-primary mt-1">
              {ko ? '패턴 설정하기' : 'Set Pattern'}
            </button>
          )}
        </div>
      ) : !displayMeeting ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">{ko ? '예정된 모임이 없습니다.' : 'No upcoming meetings.'}</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── 과거 기록 배너 ── */}
          {isPastView && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-900/20 border border-amber-700/30">
              <span className="text-base">📁</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-300">{ko ? '과거 기록 보기' : 'Viewing past record'}</p>
                <p className="text-[10px] text-amber-500/70">{ko ? '저장된 기록을 열람 중입니다. 편집 기능은 비활성화됩니다.' : 'Browsing archived data. Editing is disabled.'}</p>
              </div>
              <button onClick={navReset} className="text-[10px] text-amber-400 border border-amber-700/40 rounded-lg px-2 py-1">
                {ko ? '현재로' : 'Current'}
              </button>
            </div>
          )}

          {/* ── Meeting card ── */}
          <div className={`glass-card rounded-2xl p-4 space-y-2 ${displayMeeting.status === 'cancelled' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400">{ko ? `${displayMeeting.year}년 ${displayMeeting.month}월 정기모임` : `${displayMeeting.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Meeting`}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white font-bold text-lg">{fmtDate(displayMeeting.date, ko)}</p>
                  {!isPastView && dDayBadge()}
                  {isPastView && <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{ko ? '완료' : 'Done'}</span>}
                </div>
              </div>
              {displayMeeting.status === 'cancelled'   && <XCircle size={20} className="text-red-400 flex-shrink-0 mt-1" />}
              {displayMeeting.status === 'rescheduled' && <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-1" />}
              {/* status === 'scheduled' 일 땐 별도 아이콘 표시 안 함
                  (사용자가 RSVP 완료로 오해하던 초록 체크 제거) */}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {displayMeeting.time  && <span className="flex items-center gap-1"><Clock size={12} />{fmtTime(displayMeeting.time.slice(0,5), ko)}</span>}
              {displayMeeting.venue && <span className="flex items-center gap-1"><MapPin size={12} />{displayMeeting.venue}</span>}
            </div>

            {/* ── 내 RSVP 상태 (명확한 배지) ──────────────────────────── */}
            {!isPastView && displayMeeting.status !== 'cancelled' && (
              <div className="pt-1">
                {myAtt?.status === 'attending' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.35)' }}>
                    <CheckCircle size={12} />{ko ? '내 응답: 참석' : 'My RSVP: Attending'}
                  </span>
                ) : myAtt?.status === 'absent' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}>
                    <XCircle size={12} />{ko ? '내 응답: 불참' : 'My RSVP: Absent'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.30)' }}>
                    <HelpCircle size={12} />{ko ? '아직 응답 전' : 'Not responded'}
                  </span>
                )}
              </div>
            )}
            {displayMeeting.reason && <p className="text-xs text-yellow-400">{displayMeeting.reason}</p>}
            {noticeSent && isRsvpOpen && (
              <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={11} />{ko ? '공지 자동 발송됨' : 'Notice sent'}</p>
            )}
            {!isPastView && canManage && displayMeeting.status !== 'cancelled' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => {
                  const ds = `${displayMeeting.date.getFullYear()}-${String(displayMeeting.date.getMonth()+1).padStart(2,'0')}-${String(displayMeeting.date.getDate()).padStart(2,'0')}`
                  setOForm({ status: 'cancelled', date: ds, time: '', reason: '' })
                  setShowOverrideModal(true)
                }} className="flex-1 text-xs border border-gray-700 rounded-lg py-2 text-gray-400 hover:border-yellow-700 hover:text-yellow-400 transition">
                  {ko ? '일정 조정' : 'Adjust'}
                </button>
                {displayMeeting.status !== 'scheduled' && (
                  <button onClick={removeOverride} className="flex-1 text-xs border border-gray-700 rounded-lg py-2 text-gray-400 transition" style={{ '--tw-border-opacity': 1 } as any} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,168,76,0.5)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold-l)' }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ''; (e.currentTarget as HTMLButtonElement).style.color = '' }}>
                    {ko ? '원복' : 'Reset'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RSVP ── */}
          {showRsvpArea && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ko ? '참석 여부' : 'RSVP'}</p>
                {/* Clickable count → opens attending members modal */}
                <button
                  onClick={() => setShowAttendingModal(true)}
                  className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg transition active:scale-95"
                  style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold-l)', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <Users size={11} />
                  {(() => {
                    const approvedGuestCount = guests.filter((g: any) => g.approved).length
                    const totalAtt = attending.length + approvedGuestCount
                    return (
                      <>
                        {ko ? `${totalAtt}명 참석` : `${totalAtt} attending`}
                        {approvedGuestCount > 0 && (
                          <span className="ml-0.5" style={{ color: '#c4b5fd' }}>
                            {ko ? ` (회원 ${attending.length}·게스트 ${approvedGuestCount})` : ` (members ${attending.length} + guests ${approvedGuestCount})`}
                          </span>
                        )}
                        {' · '}
                        {ko ? `${absent.length}명 불참` : `${absent.length} absent`}
                      </>
                    )
                  })()}
                </button>
              </div>

              {/* 인라인 에러 (alert 대신) */}
              {rsvpError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                  <span>⚠</span>{rsvpError}
                </div>
              )}

              {/* My response — 항상 두 버튼 노출, 현재 응답 강조. 잘못 누르면 다른 쪽 눌러서 즉시 번복. */}
              <div>
                <p className="text-xs mb-2 flex items-center justify-between" style={{ color: 'var(--text-3)' }}>
                  <span>{ko ? '내 응답' : 'My response'}</span>
                  {myAtt && isRsvpOpen && (
                    <button onClick={cancelRsvp}
                      className="text-[10px] underline decoration-dotted"
                      style={{ color: 'var(--text-3)' }}
                      title={ko ? '응답 취소 (미응답 상태로 되돌리기)' : 'Cancel response'}>
                      {ko ? '응답 삭제' : 'Clear response'}
                    </button>
                  )}
                </p>
                <div className="flex gap-2">
                  {(() => {
                    const attendingSel = myAtt?.status === 'attending'
                    const absentSel    = myAtt?.status === 'absent'
                    return (
                      <>
                        <button
                          onClick={() => rsvp('attending')}
                          disabled={!isRsvpOpen}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition active:scale-[0.97]"
                          style={
                            !isRsvpOpen
                              ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-3)', cursor: 'not-allowed' }
                              : attendingSel
                                ? { background: 'rgba(34,197,94,0.32)', border: '2px solid rgba(34,197,94,0.7)', color: '#bbf7d0', boxShadow: '0 0 0 1px rgba(34,197,94,0.4) inset' }
                                : { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: 'rgba(74,222,128,0.6)' }
                          }>
                          <Check size={15} />{ko ? '참석' : 'Attending'}{attendingSel && <span className="text-[10px] opacity-80">✓</span>}
                        </button>
                        <button
                          onClick={() => rsvp('absent')}
                          disabled={!isRsvpOpen}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition active:scale-[0.97]"
                          style={
                            !isRsvpOpen
                              ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-3)', cursor: 'not-allowed' }
                              : absentSel
                                ? { background: 'rgba(239,68,68,0.32)', border: '2px solid rgba(239,68,68,0.7)', color: '#fecaca', boxShadow: '0 0 0 1px rgba(239,68,68,0.4) inset' }
                                : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: 'rgba(248,113,113,0.6)' }
                          }>
                          <Ban size={15} />{ko ? '불참' : 'Absent'}{absentSel && <span className="text-[10px] opacity-80">✓</span>}
                        </button>
                      </>
                    )
                  })()}
                </div>
                {myAtt && isRsvpOpen && (
                  <p className="text-[10px] text-center mt-1.5" style={{ color: 'var(--text-3)' }}>
                    {ko ? '잘못 누르셨다면 다른 버튼을 다시 눌러 변경할 수 있습니다.' : 'Tap the other button to change your response.'}
                  </p>
                )}
                {/* 비활성 안내 (D-14 이전) */}
                {!myAtt && !isRsvpOpen && daysUntil !== null && daysUntil > 14 && (
                  <p className="text-[11px] text-center mt-2" style={{ color: 'var(--text-3)' }}>
                    {ko
                      ? `D-${daysUntil} · 모임 14일 전부터 응답할 수 있습니다`
                      : `D-${daysUntil} · RSVP opens 14 days before the meeting`}
                  </p>
                )}
              </div>

              {/* Attendance lists */}
              <div className="space-y-2.5">
                {attending.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#4ade80' }}>
                        <Check size={11} />
                        {(() => {
                          const gc = guests.filter((g: any) => g.approved).length
                          const total = attending.length + gc
                          return ko
                            ? `참석 (${total}명${gc>0 ? ` = 회원 ${attending.length} + 게스트 ${gc}` : ''})`
                            : `Attending (${total}${gc>0 ? ` = ${attending.length} + ${gc} G` : ''})`
                        })()}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {canManage && (
                          <button onClick={() => { setPasteText(courseReplyMemo); setShowPasteModal(true) }}
                            className="text-[10px] font-bold px-2 py-1 rounded-md active:scale-95"
                            style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac',
                                     border: '1px solid rgba(34,197,94,0.4)' }}>
                            {ko ? '🏌️ 골프장 응답 입력' : '🏌️ Paste tee times'}
                          </button>
                        )}
                        {canManage && (attending.length + guests.filter(g=>g.approved).length) > 0 && (
                          <button onClick={openRosterPreview}
                            className="text-[10px] font-bold px-2 py-1 rounded-md active:scale-95"
                            style={{ background: 'rgba(96,165,250,0.18)', color: '#93c5fd',
                                     border: '1px solid rgba(96,165,250,0.4)' }}>
                            {ko ? '📋 영문명단 미리보기' : '📋 Preview roster'}
                          </button>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <p className="text-[10px] mb-1.5" style={{ color: '#86efac' }}>
                        · {ko ? '이름을 탭하여 응답 수정' : 'tap a name to change response'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {attending.map((a: any) => {
                        const tgt = clubMembers.find((m: any) => m.user_id === a.user_id) ?? a
                        const display = (lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name))
                          + (a.users?.name_abbr ? ` (${a.users.name_abbr})` : '')
                        return canManage ? (
                          <button key={a.user_id} type="button"
                            onClick={() => setProxyTarget(tgt)}
                            className="text-xs px-2.5 py-1 rounded-full transition active:scale-95 hover:opacity-80"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.35)', cursor: 'pointer' }}>
                            {display}
                          </button>
                        ) : (
                          <span key={a.user_id} className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                            {display}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {absent.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: '#f87171' }}>
                      <Ban size={11} />{ko ? `불참 (${absent.length}명)` : `Absent (${absent.length})`}
                    </p>
                    {canManage && (
                      <p className="text-[10px] mb-1.5" style={{ color: '#fca5a5' }}>
                        · {ko ? '이름을 탭하여 응답 수정' : 'tap a name to change response'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {absent.map((a: any) => {
                        const tgt = clubMembers.find((m: any) => m.user_id === a.user_id) ?? a
                        const display = lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)
                        return canManage ? (
                          <button key={a.user_id} type="button"
                            onClick={() => setProxyTarget(tgt)}
                            className="text-xs px-2.5 py-1 rounded-full transition active:scale-95 hover:opacity-80"
                            style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer' }}>
                            {display}
                          </button>
                        ) : (
                          <span key={a.user_id} className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {display}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {notRespon.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                      <HelpCircle size={11} />{ko ? `미응답 (${notRespon.length}명)` : `No response (${notRespon.length})`}
                      {canManage && (
                        <span className="ml-1 text-[10px]" style={{ color: '#86efac' }}>
                          · {ko ? '탭하여 대리 응답' : 'tap to proxy-RSVP'}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {notRespon.map((m: any) => (
                        canManage ? (
                          <button key={m.user_id} type="button"
                            onClick={() => setProxyTarget(m)}
                            className="text-xs px-2.5 py-1 rounded-full transition active:scale-95 hover:opacity-80"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px dashed rgba(34,197,94,0.3)' }}>
                            {memberName(m)}
                          </button>
                        ) : (
                          <span key={m.user_id} className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                            {memberName(m)}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Guest 추천 섹션 ───────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#a78bfa' }}>
                      🎫 {ko ? `추천 게스트 (${guests.length}명)` : `Guests (${guests.length})`}
                    </p>
                    {!isPastView && isRsvpOpen && (
                      <button onClick={() => { setGuestForm({ full_name:'', full_name_en:'', handicap:'', notes:'' }); setGuestError(null); setShowGuestModal(true) }}
                        className="text-[10px] px-2 py-1 rounded-md font-bold active:scale-95"
                        style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.35)' }}>
                        + {ko ? '게스트 추천' : 'Recommend'}
                      </button>
                    )}
                  </div>
                  {guests.length === 0 ? (
                    <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                      {ko ? '추천된 게스트가 없습니다' : 'No guests recommended yet'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {guests.map((g: any) => {
                        const recName = Array.isArray(g.recommender) ? g.recommender[0]?.full_name : g.recommender?.full_name
                        const isMine = g.recommended_by === user?.id
                        return (
                          <div key={g.id} className="rounded-xl p-2.5 flex items-center gap-2"
                            style={{ background: g.approved ? 'rgba(34,197,94,0.10)' : 'rgba(167,139,250,0.08)', border: `1px solid ${g.approved ? 'rgba(34,197,94,0.3)' : 'rgba(167,139,250,0.25)'}` }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white">
                                {g.approved && '✓ '}
                                {lang === 'ko' ? g.full_name : (g.full_name_en || g.full_name)}
                                {g.handicap != null && (
                                  <span className="text-[11px] font-normal ml-1.5" style={{ color: 'var(--gold-l)' }}>HC {g.handicap}</span>
                                )}
                              </p>
                              <p className="text-[10px]" style={{ color: '#a78bfa' }}>
                                {recName ? `${ko ? '추천' : 'By'}: ${recName}` : ''}
                                {g.notes && <> · {g.notes}</>}
                              </p>
                            </div>
                            {canManage && !g.approved && !isPastView && (
                              <>
                                <button onClick={() => approveGuest(g)}
                                  className="text-[10px] px-2 py-1 rounded-md font-bold active:scale-95"
                                  style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.45)' }}>
                                  {ko ? '승인' : 'Approve'}
                                </button>
                                <button onClick={() => rejectGuest(g)}
                                  className="text-[10px] px-2 py-1 rounded-md font-bold active:scale-95"
                                  style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)' }}>
                                  {ko ? '거절' : 'Reject'}
                                </button>
                              </>
                            )}
                            {(isMine || canManage) && g.approved && !isPastView && (
                              <button onClick={() => rejectGuest(g)}
                                className="w-6 h-6 rounded flex items-center justify-center"
                                style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}
                                title={ko ? '취소' : 'Remove'}>
                                ×
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Groups ── */}
          {(groups.length > 0 || (canManage && !isPastView && isRsvpOpen && attending.length > 0)) && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Users size={15} style={{ color: 'var(--gold-l)' }} />{ko ? '조 편성' : 'Groups'}
                  {groups.length > 0 && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ color: 'var(--gold-l)', background: 'rgba(201,168,76,0.12)' }}>{groups.length}{ko ? '조' : ' groups'}</span>}
                </p>
                <div className="flex items-center gap-2">
                  {groups.length > 0 && (
                    <button onClick={exportGroupsCSV}
                      className="text-xs text-blue-400 border border-blue-800/60 rounded-full px-3 py-1.5 flex items-center gap-1 hover:bg-blue-900/20 transition"
                      title={ko ? 'CSV(엑셀)로 내보내기' : 'Export to CSV/Excel'}>
                      <FileDown size={11} />{ko ? '엑셀' : 'Export'}
                    </button>
                  )}
                  {canManage && !isPastView && (
                    <button onClick={() => {
                      setHiddenGroupNums(new Set())
                      setShowAllGroups(false)
                      setGroupSearch('')
                      setShowGroupModal(true)
                    }}
                      className="text-xs rounded-full px-3 py-1.5 flex items-center gap-1 transition font-semibold"
                      style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' }}>
                      <Edit2 size={11} />{ko ? (groups.length > 0 ? '편집' : '조편성') : (groups.length > 0 ? 'Edit' : 'Assign')}
                    </button>
                  )}
                </div>
              </div>
              {groups.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-gray-400">{ko ? '아직 조 편성이 없습니다.' : 'No groups yet.'}</p>
                  {canManage && !isPastView && (
                    <p className="text-[10px] text-gray-400 mt-1">{ko ? '위 "조편성" 버튼을 눌러 자동/수동으로 배정하세요.' : 'Use the "Assign" button above to set groups.'}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groups.map((g: any) => (
                    <div key={g.group_number}
                      className="rounded-xl p-3"
                      style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)' }}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-black rounded-lg px-2 py-0.5" style={{ color: 'var(--gold-l)', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                          {g.group_number}조
                        </span>
                        {/* 시간 — 미설정 시 점선 — 회장·총무가 편집해서 채울 수 있다는 힌트 */}
                        <span className="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded"
                          style={{ color: g.tee_time ? '#93c5fd' : '#6b7280',
                                   background: g.tee_time ? 'rgba(96,165,250,0.10)' : 'transparent',
                                   border: `1px ${g.tee_time ? 'solid' : 'dashed'} ${g.tee_time ? 'rgba(96,165,250,0.30)' : 'rgba(107,114,128,0.4)'}` }}>
                          <Clock size={10} />
                          {g.tee_time ? String(g.tee_time).slice(0, 5) : (ko ? '시간 미정' : 'No time')}
                        </span>
                        {/* 코스 — 미설정 시 점선 */}
                        <span className="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded"
                          style={{ color: g.course_name ? '#c4b5fd' : '#6b7280',
                                   background: g.course_name ? 'rgba(167,139,250,0.10)' : 'transparent',
                                   border: `1px ${g.course_name ? 'solid' : 'dashed'} ${g.course_name ? 'rgba(167,139,250,0.30)' : 'rgba(107,114,128,0.4)'}` }}>
                          <MapPin size={10} />
                          {g.course_name || (ko ? '코스 미정' : 'No course')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(g.meeting_group_members ?? []).map((m: any, idx: number) => {
                          const isGuest = !!m.guest_id
                          const gst = Array.isArray(m.meeting_guests) ? m.meeting_guests[0] : m.meeting_guests
                          const nm = isGuest
                            ? (lang === 'ko' ? gst?.full_name : (gst?.full_name_en || gst?.full_name))
                            : (lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name))
                          const isMe = m.user_id === user?.id
                          return (
                            <span key={m.user_id ?? m.guest_id ?? idx}
                              className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={
                                isGuest ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }
                                : isMe ? { background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' }
                                : { background: 'rgba(255,255,255,0.07)', color: 'var(--text-2)' }
                              }>
                              {isGuest && '🎫 '}{nm}{isMe ? (ko ? ' (나)' : ' (me)') : ''}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Score Section ── */}
          {isScoreOpen && displayMeeting.status !== 'cancelled' && attending.length > 0 && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <BarChart2 size={15} className="text-yellow-400" />
                  {ko ? `${displayMeeting.month}월 스코어` : `${displayMeeting.date.toLocaleDateString('en-US',{month:'short'})} Scores`}
                  {isPastView && <span className="text-[10px] text-gray-400 font-normal">{ko ? '(기록)' : '(archived)'}</span>}
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
                  const canEdit = !isPastView && (canManage || att.user_id === user?.id)
                  const existing = scores.find(s => s.user_id === att.user_id)
                  const hcInfo = clubMembers.find(m => m.user_id === att.user_id)?.club_handicap
                  return (
                    <div key={att.user_id} className="flex items-center gap-3 bg-gray-800/60 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{name}{abbr ? ` (${abbr})` : ''}</p>
                        {hcInfo != null && <p className="text-xs text-gray-400">HC {hcInfo}</p>}
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
                        <span className={`text-sm font-bold flex-shrink-0 ${existing ? 'text-yellow-300' : 'text-gray-400'}`}>
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

          {/* ── 2차 모임 ── */}
          {displayMeeting.status !== 'cancelled' && (daysUntil !== null && daysUntil >= -3 && daysUntil <= 14) && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.07),rgba(6,13,6,0.98))', border: '1px solid rgba(251,146,60,0.2)' }}>
              {/* 헤더 */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid rgba(251,146,60,0.12)' }}>
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={14} style={{ color: '#fb923c' }} />
                  <span className="text-sm font-bold text-white">
                    {ko ? `${displayMeeting.month}월 2차 모임` : `After-party`}
                  </span>
                  {secondMeeting && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                      {ko ? '확정' : 'Set'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* 알림 구독 토글 */}
                  <button
                    onClick={togglePush}
                    disabled={pushLoading}
                    title={ko ? (pushEnabled ? '알림 해제' : '알림 받기') : (pushEnabled ? 'Unsubscribe' : 'Get notified')}
                    className="p-1.5 rounded-lg transition"
                    style={{ background: pushEnabled ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.04)' }}>
                    {pushEnabled
                      ? <Bell size={13} style={{ color: '#fb923c' }} />
                      : <BellOff size={13} style={{ color: '#9aae9a' }} />}
                  </button>
                  {canManage && (
                    <button onClick={() => { setSForm(secondMeeting ? { name: secondMeeting.restaurant_name, address: secondMeeting.restaurant_address ?? '', placeId: secondMeeting.google_place_id ?? '', lat: secondMeeting.lat ? String(secondMeeting.lat) : '', lng: secondMeeting.lng ? String(secondMeeting.lng) : '', time: secondMeeting.time ?? '19:00', notes: secondMeeting.notes ?? '' } : emptySecondForm); setShowSecondModal(true) }}
                      className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1 transition"
                      style={{ background: secondMeeting ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
                      {secondMeeting ? <Edit2 size={11} /> : <Plus size={11} />}
                      {secondMeeting ? (ko ? '수정' : 'Edit') : (ko ? '등록' : 'Add')}
                    </button>
                  )}
                </div>
              </div>

              {/* 내용 */}
              {!secondMeeting ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm" style={{ color: '#9aae9a' }}>
                    {canManage
                      ? (ko ? '2차 모임 장소를 등록해 주세요' : 'Add an after-party venue')
                      : (ko ? '2차 모임 장소가 아직 미정입니다' : 'After-party venue TBD')}
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {/* 장소 정보 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(251,146,60,0.15)' }}>
                      <UtensilsCrossed size={14} style={{ color: '#fb923c' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{secondMeeting.restaurant_name}</p>
                      {secondMeeting.time && (
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#fb923c' }}>
                          <Clock size={10} />{secondMeeting.time.slice(0, 5)}
                        </p>
                      )}
                      {secondMeeting.restaurant_address && (
                        <p className="text-xs mt-0.5" style={{ color: '#9aae9a' }}>{secondMeeting.restaurant_address}</p>
                      )}
                    </div>
                    {(secondMeeting.lat && secondMeeting.lng) && (
                      <a href={`https://www.google.com/maps?q=${secondMeeting.lat},${secondMeeting.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0"
                        style={{ background: 'rgba(200,200,222,0.1)', color: 'var(--silver-l)', border: '1px solid rgba(200,200,222,0.2)' }}>
                        <Navigation size={11} />
                        {ko ? '길찾기' : 'Directions'}
                      </a>
                    )}
                  </div>

                  {/* 지도 */}
                  {(secondMeeting.lat || secondMeeting.google_place_id || secondMeeting.restaurant_address) && (
                    <MapEmbed
                      name={secondMeeting.restaurant_name}
                      address={secondMeeting.restaurant_address}
                      lat={secondMeeting.lat}
                      lng={secondMeeting.lng}
                      placeId={secondMeeting.google_place_id}
                      height={180}
                      className="w-full"
                    />
                  )}

                  {/* RSVP */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold" style={{ color: '#fb923c' }}>
                        {ko ? '2차 참석 여부' : '2nd RSVP'}
                      </p>
                      <span className="text-xs" style={{ color: '#9aae9a' }}>
                        {secondAtts.filter((a: any) => a.status === 'attending').length}{ko ? '명 참석' : ' going'}
                      </span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      {(['attending', 'absent'] as const).map(s => {
                        const myAtt2 = secondAtts.find((a: any) => a.user_id === user?.id)
                        const active = myAtt2?.status === s
                        return (
                          <button key={s} onClick={() => rsvpSecond(s)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition ${active ? (s === 'attending' ? 'bg-orange-700 text-white' : 'bg-red-800 text-white') : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                            {s === 'attending' ? <Check size={14} /> : <Ban size={14} />}
                            {s === 'attending' ? (ko ? '참석' : 'Going') : (ko ? '불참' : 'Skip')}
                          </button>
                        )
                      })}
                    </div>
                    {secondAtts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {secondAtts.filter((a: any) => a.status === 'attending').map((a: any) => (
                          <span key={a.user_id} className="text-xs px-2.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}>
                            {ko ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 알림 발송 */}
                  {canManage && (
                    <div className="pt-1">
                      <button onClick={sendSecondMeetingNotification} disabled={sendingPush}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.25),rgba(251,146,60,0.1))', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
                        <Bell size={14} />
                        {sendingPush ? (ko ? '발송 중...' : 'Sending...') : (ko ? '전 회원 알림 발송' : 'Notify All Members')}
                      </button>
                      {pushResult && (
                        <p className="text-center text-xs mt-1.5" style={{ color: pushResult.includes('실패') || pushResult.includes('Failed') ? '#f87171' : '#22c55e' }}>
                          {pushResult}
                        </p>
                      )}
                    </div>
                  )}
                  {secondMeeting.notes && (
                    <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}>
                      {secondMeeting.notes}
                    </p>
                  )}
                </div>
              )}
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
            <button onClick={savePattern} disabled={saving} className="flex-1 py-3 rounded-xl disabled:opacity-50 text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)' }}>{saving ? '...' : (ko ? '저장' : 'Save')}</button>
          </div>
        }
      >
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '몇 번째 주' : 'Week of Month'}</label>
          <div className="grid grid-cols-5 gap-1.5">
            {[1,2,3,4,5].map(w => (
              <button key={w} type="button" onClick={() => setPForm(f => ({ ...f, week: w }))}
                style={pForm.week === w ? { background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' } : undefined}
                className={`py-2.5 rounded-xl text-sm font-medium transition ${pForm.week === w ? '' : 'bg-gray-800 text-gray-400'}`}>
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
                style={pForm.dow === d ? { background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' } : undefined}
                className={`py-2.5 rounded-xl text-xs font-medium transition ${pForm.dow === d ? '' : 'bg-gray-800 text-gray-400'}`}>
                {ko ? DOW_KO[d] : DOW_EN[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--gold-l)' }}>
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
              className="flex-1 py-3 rounded-xl disabled:opacity-50 text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)' }}>{saving ? '...' : (ko ? '저장' : 'Save')}</button>
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
            <button onClick={() => saveGroups()} disabled={saving || assignedGroupNums.length === 0}
              className="flex-1 py-3 rounded-xl disabled:opacity-50 text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)' }}>{saving ? '...' : (ko ? '전체 저장 + 닫기' : 'Save All & Close')}</button>
          </div>
        }
      >
        {/* 1단계: 골프장 응답 입력 (참고용) */}
        <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <p className="text-xs font-bold mb-1.5" style={{ color: '#93c5fd' }}>
            1️⃣ {ko ? '골프장 응답 임시 메모' : 'Golf course reply memo'}
          </p>
          <p className="text-[10px] mb-2" style={{ color: '#94a3b8' }}>
            💡 {ko ? '예: TWINDOVES | Apr 19th, 7:38 Stella-Sole — 시간/코스 참고용. 아래에서 조별로 직접 입력' : 'Paste raw text for reference'}
          </p>
          <textarea
            value={courseReplyMemo}
            onChange={e => setCourseReplyMemo(e.target.value)}
            rows={3}
            placeholder={ko ? '골프장에서 받은 메시지 붙여넣기 (선택)' : 'Paste reply from course (optional)'}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">2️⃣ {ko ? '조 편성 방법 (3가지 중 선택)' : 'Group assignment (3 methods)'}</label>
          <p className="text-[10px] text-gray-400 mb-2">
            {ko ? '4명씩 한 조 · 편성 후에도 자유롭게 수정 가능' : 'Groups of 4 · always editable after'}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => buildAutoAssign('top4')} disabled={autoGroupLoading}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/40 text-emerald-300 text-sm font-medium transition disabled:opacity-50">
              {autoGroupLoading
                ? <span className="animate-spin text-base">⏳</span>
                : <ListOrdered size={16} />}
              <span className="text-[11px] font-bold">{ko ? '🏆 전달핸디' : 'HC'}</span>
              <span className="text-[9px] text-emerald-500/80 leading-tight">{ko ? '핸디 상위순' : 'sorted'}</span>
            </button>
            <button onClick={() => buildAutoAssign('random')} disabled={autoGroupLoading}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-violet-900/40 hover:bg-violet-800/40 border border-violet-700/40 text-violet-300 text-sm font-medium transition disabled:opacity-50">
              <Shuffle size={16} />
              <span className="text-[11px] font-bold">{ko ? '🎲 랜덤' : 'Random'}</span>
              <span className="text-[9px] text-violet-400/80 leading-tight">{ko ? '무작위 배정' : 'shuffle'}</span>
            </button>
            <button onClick={() => setAssign({})}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-gray-200 text-sm font-medium transition">
              <Edit2 size={16} />
              <span className="text-[11px] font-bold">{ko ? '✏️ 수동' : 'Manual'}</span>
              <span className="text-[9px] text-gray-400 leading-tight">{ko ? '리셋·직접' : 'reset & pick'}</span>
            </button>
          </div>
        </div>
        {(() => {
          // 회원 + 승인된 게스트를 합친 풀
          const memberParticipants = attending.map((a: any) => ({
            key: a.user_id as string,
            name: lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name),
            handicap: clubMembers.find(cm => cm.user_id === a.user_id)?.club_handicap as number | null,
            isGuest: false,
          }))
          const guestParticipants = guests.filter(g => g.approved).map((g: any) => ({
            key: `g:${g.id}`,
            name: lang === 'ko' ? g.full_name : (g.full_name_en || g.full_name),
            handicap: g.handicap as number | null,
            isGuest: true,
          }))
          const participants = [...memberParticipants, ...guestParticipants]
          const unassignedCount = participants.filter(p => assign[p.key] == null).length

          // 검색어로 필터링 — 한 글자만 쳐도 일치하는 회원이 좁혀짐 (대소문자 무시, 한글·영문 모두)
          const q = groupSearch.trim().toLowerCase()
          // ⭐ 기본 정책: 이미 어느 조에든 배정된 회원은 수동 지정 영역에서 자동 숨김.
          //    "✏️ 다시 편집" 누르면 그 조의 배정이 풀려서 다시 미배정으로 보임.
          //    showAllGroups=true 일 때만 전체 표시.
          const visibleParticipants = participants.filter(p => {
            if (q && !(p.name ?? '').toLowerCase().includes(q)) return false
            if (!showAllGroups && assign[p.key] != null) return false
            return true
          })
          // 조별 인원 수 — 4명이 찬 조는 "Full" 처리 (그 조 버튼은 나머지 미배정 회원들 행에서 사라짐)
          const groupCounts: Record<number, number> = {}
          Object.values(assign).forEach(n => {
            if (typeof n === 'number') groupCounts[n] = (groupCounts[n] ?? 0) + 1
          })
          return (<>
            {participants.length > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <label className="text-xs text-gray-400">
                    {ko
                      ? `수동 조 지정 (${q ? `${visibleParticipants.length}/` : ''}총 ${participants.length}명)`
                      : `Manual assignment (${q ? `${visibleParticipants.length}/` : ''}${participants.length} total)`}
                  </label>
                </div>
                {/* 이름 검색창 */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9aae9a' }} />
                  <input
                    type="text"
                    value={groupSearch}
                    onChange={e => setGroupSearch(e.target.value)}
                    placeholder={ko ? '이름 검색 (한 글자만 쳐도 OK)' : 'Search by name'}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-8 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                    autoComplete="off"
                  />
                  {groupSearch && (
                    <button type="button" onClick={() => setGroupSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {q && visibleParticipants.length === 0 && (
                  <p className="text-[11px] text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 mb-2">
                    🔍 {ko ? `"${groupSearch}" 일치하는 이름이 없습니다` : `No match for "${groupSearch}"`}
                  </p>
                )}
                {/* 미배정 회원이 0명일 때 — 전체 배정 완료 안내 */}
                {!q && visibleParticipants.length === 0 && unassignedCount === 0 && (
                  <p className="text-[12px] text-center py-3 rounded-lg mb-2"
                    style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', color: '#86efac' }}>
                    ✅ {ko ? '모든 회원이 조에 배정되었습니다 — 아래에서 시간·코스 입력 후 저장' : 'All members assigned — set time/course below and save'}
                  </p>
                )}
                <div className="space-y-2">
                  {visibleParticipants.map((p) => {
                    const cur = assign[p.key]
                    const maxGroup = Math.max(0, ...(Object.values(assign) as number[]))
                    const numButtons = Math.min(6, Math.max(maxGroup + 1, (cur ?? 0) + 1, 4))
                    return (
                      <div key={p.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                        style={p.isGuest
                          ? { background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.3)' }
                          : { background: 'rgb(31,41,55)' }}>
                        <div className="flex-1 min-w-0">
                          {/* 게스트는 이름을 보라색으로 표시 (별도 배지 없음 — 이름 자체가 색상으로 구분됨) */}
                          <span className="text-sm block truncate"
                            style={{ color: p.isGuest ? '#c4b5fd' : '#fff' }}>
                            {p.name}
                          </span>
                          {p.handicap != null && <span className="text-[10px] text-gray-400">HC {p.handicap}</span>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0 items-center">
                          {cur == null && <span className="text-[10px] text-amber-500 mr-1">미배정</span>}
                          {Array.from({ length: numButtons }, (_, i) => i + 1)
                            // 4명 찬 조 버튼은 미배정 회원들 화면에서 제거 (본인이 이미 들어가있는 조는 유지)
                            .filter(n => cur === n || (groupCounts[n] ?? 0) < 4)
                            .map(n => (
                            <button key={n}
                              onClick={() => setAssign(prev => ({ ...prev, [p.key]: n }))}
                              style={cur === n ? { background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' } : undefined}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition ${cur === n ? '' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                              {n}조
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">{ko ? '참석자가 없습니다.' : 'No attendees yet.'}</p>
            )}
            {unassignedCount > 0 && (
              <p className="text-[11px] text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 mt-2">
                ⚠️ {ko ? `미배정 ${unassignedCount}명이 있습니다` : `${unassignedCount} not yet assigned`}
              </p>
            )}
            {assignedGroupNums.length > 0 && (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs text-gray-400">
                    3️⃣ {ko ? '편성 미리보기' : 'Preview'}
                  </label>
                  {(hiddenGroupNums.size > 0 || assignedGroupNums.length > 0) && (
                    <button type="button"
                      onClick={() => setShowAllGroups(s => !s)}
                      className="text-[10px] px-2 py-1 rounded-md font-bold transition"
                      style={{
                        background: showAllGroups ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)',
                        color: showAllGroups ? '#93c5fd' : '#9ca3af',
                        border: `1px solid ${showAllGroups ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                      {showAllGroups
                        ? (ko ? '👁 배정된 회원도 표시 중' : '👁 Showing assigned')
                        : (ko ? '🙈 배정된 회원 숨김' : '🙈 Hiding assigned')}
                    </button>
                  )}
                </div>
                <p className="text-[10px]" style={{ color: '#fbbf24' }}>
                  💡 {ko ? '조 편성 후 "이 조 저장" 누르면 다음 조 편성에 집중할 수 있습니다 (모달 닫혔다 열어도 저장 상태 유지)' : 'Save each group as you complete it to focus on the next'}
                </p>
                {assignedGroupNums
                  .filter(gn => showAllGroups || !hiddenGroupNums.has(gn))
                  .map(gn => {
                  const gMembers = participants.filter(p => assign[p.key] === gn)
                  const isSaved = hiddenGroupNums.has(gn)
                  return (
                    <div key={gn} className="rounded-xl px-3 py-2.5 space-y-2"
                      style={isSaved
                        ? { background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', opacity: 0.85 }
                        : { background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
                      {/* 1행: 조 라벨 + 저장/편집 버튼 */}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-extrabold flex-shrink-0" style={{ color: isSaved ? '#86efac' : 'var(--gold-l)' }}>
                          {isSaved && '✅ '}{gn}조 <span className="text-[10px] font-normal opacity-70">({gMembers.length}{ko ? '명' : ''})</span>
                        </p>
                        {!isSaved && (
                          <button
                            type="button"
                            onClick={async () => {
                              setSavingGroupNum(gn)
                              await saveGroups({ keepOpen: true })
                              setHiddenGroupNums(prev => { const s = new Set(prev); s.add(gn); return s })
                              setSavingGroupNum(null)
                            }}
                            disabled={savingGroupNum !== null}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md active:scale-95 disabled:opacity-50 flex-shrink-0"
                            style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' }}>
                            {savingGroupNum === gn
                              ? (ko ? '저장 중...' : 'Saving…')
                              : (ko ? `💾 ${gn}조 저장` : `💾 Save ${gn}`)}
                          </button>
                        )}
                        {isSaved && (
                          <button
                            type="button"
                            onClick={() => {
                              setHiddenGroupNums(prev => { const s = new Set(prev); s.delete(gn); return s })
                              setAssign(prev => {
                                const next = { ...prev }
                                Object.entries(next).forEach(([key, num]) => { if (num === gn) delete next[key] })
                                return next
                              })
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-md active:scale-95 flex-shrink-0"
                            style={{ background: 'rgba(96,165,250,0.18)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.4)' }}
                            title={ko ? '이 조의 배정을 해제하고 다시 편성' : 'Unassign and re-edit this group'}>
                            {ko ? '✏️ 다시 편집' : '✏️ Edit'}
                          </button>
                        )}
                      </div>
                      {/* 2행: 시간 + 코스 (좁은 화면에서도 항상 한 줄로 보이도록 단독 행) */}
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={teeTimes[gn] ?? ''}
                          onChange={e => setTeeTimes(prev => ({ ...prev, [gn]: e.target.value }))}
                          className="text-xs px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-white flex-shrink-0"
                          style={{ width: 100 }}
                          title={ko ? '티오프 시간' : 'Tee time'}
                        />
                        <input
                          type="text"
                          value={courseNames[gn] ?? ''}
                          onChange={e => setCourseNames(prev => ({ ...prev, [gn]: e.target.value }))}
                          placeholder={ko ? '코스명 (예: Luna-Stella)' : 'Course'}
                          className="text-xs px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-white flex-1 min-w-0"
                          title={ko ? '코스 이름' : 'Course name'}
                        />
                      </div>
                      {/* 조원 이름 — 탭하면 그 조에서 빠지고 미배정으로 이동 (잘못된 배정 즉시 정정) */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 leading-relaxed">
                        {gMembers.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setAssign(prev => { const n = { ...prev }; delete n[p.key]; return n })}
                            title={ko ? '이 조에서 빼기 (미배정으로 이동)' : 'Remove from this group'}
                            className="text-[13px] px-2 py-0.5 rounded-md transition active:scale-95 hover:opacity-80"
                            style={p.isGuest
                              ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd' }
                              : { background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--text)' }}>
                            {p.isGuest && '🎫 '}{p.name}
                            {p.handicap != null && (
                              <span className="ml-1 text-[10px]" style={{ color: 'var(--gold)' }}>HC{p.handicap}</span>
                            )}
                            <span className="ml-1 text-[10px] opacity-60">✕</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>)
        })()}
      </BottomSheet>

      {/* ── 영문 명단 미리보기 모달 (Portal — stacking context 무시) ── */}
      {showRosterModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowRosterModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full rounded-t-2xl flex flex-col"
            style={{
              background: '#0f172a',
              border: '1px solid rgba(59,130,246,0.3)',
              borderBottom: 'none',
              maxHeight: '92dvh',
              maxWidth: 600,
            }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
              <h3 className="text-base font-bold text-white">
                📋 {ko ? '영문 명단 (골프장 예약용)' : 'Roster (for golf course)'}
              </h3>
              <button onClick={() => setShowRosterModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* 본문 (스크롤) */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {rosterMissing.length > 0 && (
                <div className="rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#fbbf24' }}>
                    ⚠️ {ko ? `영문 이름 자동 변환 ${rosterMissing.length}명` : `${rosterMissing.length} auto-romanized`}
                  </p>
                  <p className="text-[11px]" style={{ color: '#fcd34d' }}>
                    {rosterMissing.join(', ')}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: '#fcd34d' }}>
                    💡 {ko ? '자동 변환된 표기가 어색하면 아래에서 직접 고치세요' : 'Tweak the auto-romanization below if needed'}
                  </p>
                </div>
              )}

              {/* 한글 잔여 — 자동 변환 후에도 한글이 남아있다면 강조 표시 */}
              {(() => {
                const linesWithHangul = rosterText.split('\n')
                  .map((l, i) => ({ i, l }))
                  .filter(x => hasHangul(x.l))
                if (linesWithHangul.length === 0) return null
                return (
                  <div className="rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.5)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#fca5a5' }}>
                      🛑 {ko ? '아직 한글이 남아있습니다 — 골프장 전송 전 영문으로 고쳐주세요' : 'Korean still present — fix before sending'}
                    </p>
                    <div className="space-y-0.5">
                      {linesWithHangul.map(x => (
                        <p key={x.i} className="text-[10px] font-mono" style={{ color: '#fecaca' }}>
                          L{x.i + 1}: {x.l}
                        </p>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const fixed = rosterText.split('\n').map(l => {
                          if (!hasHangul(l)) return l
                          // 한글이 포함된 토큰만 변환 (번호·기호는 유지)
                          return l.replace(/[가-힣]+/g, m => romanizeKoreanName(m))
                        }).join('\n')
                        setRosterText(fixed)
                      }}
                      className="mt-1.5 text-[11px] font-bold px-3 py-1 rounded-md active:scale-95"
                      style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.6)' }}>
                      🔁 {ko ? '한글 자동 변환 다시 실행' : 'Re-romanize Korean'}
                    </button>
                  </div>
                )
              })()}

              <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                {ko ? '아래 내용을 확인·수정 후 복사 → 골프장에 전달' : 'Review and copy → send to course'}
              </p>
              <textarea
                value={rosterText}
                onChange={e => setRosterText(e.target.value)}
                rows={Math.min(20, Math.max(8, rosterText.split('\n').length + 1))}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                style={{ minHeight: 200 }}
                spellCheck={false}
              />
            </div>

            {/* 푸터 */}
            <div className="flex gap-2 px-5 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(59,130,246,0.2)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => setShowRosterModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">
                {ko ? '닫기' : 'Close'}
              </button>
              <button onClick={copyRosterFromModal}
                className="flex-1 py-3 rounded-xl text-white text-sm font-bold active:scale-95"
                style={{ background: rosterCopied ? 'rgba(34,197,94,0.7)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                {rosterCopied ? (ko ? '✓ 복사됨' : '✓ Copied') : (ko ? '📋 복사' : '📋 Copy')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Guest 추천 모달 ── */}
      <BottomSheet
        open={showGuestModal}
        onClose={() => { setShowGuestModal(false); setGuestError(null) }}
        title={ko ? '🎫 게스트 추천' : 'Recommend Guest'}
        footer={
          <div className="flex gap-2">
            <button onClick={() => { setShowGuestModal(false); setGuestError(null) }}
              className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">
              {ko ? '취소' : 'Cancel'}
            </button>
            <button onClick={recommendGuest} disabled={guestSaving || !guestForm.full_name.trim()}
              className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}>
              {guestSaving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '추천하기' : 'Recommend')}
            </button>
          </div>
        }
      >
        <p className="text-[11px] mb-3" style={{ color: '#c4b5fd' }}>
          💡 {ko ? '추천한 게스트는 회장·총무 승인 후 조 편성에 포함됩니다' : 'Guests are added to grouping after officer approval'}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#86efac' }}>{ko ? '한글 이름' : 'Korean Name'} *</label>
            <input type="text" value={guestForm.full_name}
              onChange={e => setGuestForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder={ko ? '예: 홍길동' : 'e.g. Hong Gildong'}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#86efac' }}>{ko ? '영문 이름 (선택)' : 'English Name (optional)'}</label>
            <input type="text" value={guestForm.full_name_en}
              onChange={e => setGuestForm(f => ({ ...f, full_name_en: e.target.value }))}
              placeholder="Hong Gildong"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#86efac' }}>{ko ? '핸디 (선택)' : 'Handicap (optional)'}</label>
            <input type="number" inputMode="numeric" value={guestForm.handicap}
              onChange={e => setGuestForm(f => ({ ...f, handicap: e.target.value }))}
              placeholder={ko ? '모르면 비워두세요' : 'Leave blank if unknown'}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#86efac' }}>{ko ? '메모 (선택)' : 'Note (optional)'}</label>
            <input type="text" value={guestForm.notes}
              onChange={e => setGuestForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={ko ? '예: 친구, 동료, 가족' : 'e.g. Friend, colleague'}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          {guestError && <p className="text-xs text-red-400">⚠ {guestError}</p>}
        </div>
      </BottomSheet>

      {/* ── Attending Members Modal ── */}
      <BottomSheet
        open={showAttendingModal}
        onClose={() => setShowAttendingModal(false)}
        title={ko ? `참석 현황 (${attending.length}명)` : `Attendance (${attending.length})`}
        footer={
          <button onClick={() => setShowAttendingModal(false)}
            className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">
            {ko ? '닫기' : 'Close'}
          </button>
        }
      >
        {/* 참석 */}
        {attending.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#4ade80' }}>
              <Check size={12} />{ko ? `참석 ${attending.length}명` : `Attending · ${attending.length}`}
            </p>
            <div className="space-y-1.5">
              {attending.map((a: any) => {
                const nm   = lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)
                const abbr = a.users?.name_abbr
                const hc   = clubMembers.find(cm => cm.user_id === a.user_id)?.club_handicap
                const grpNum = groups.find((g: any) => g.meeting_group_members?.some((gm: any) => gm.user_id === a.user_id))?.group_number
                return (
                  <div key={a.user_id} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <div>
                      <span className="text-sm text-white font-medium">{nm}</span>
                      {abbr && <span className="text-xs text-gray-400 ml-1.5">({abbr})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {hc != null && <span className="text-[11px] text-gray-400">HC {hc}</span>}
                      {grpNum != null && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--gold-l)', border: '1px solid rgba(201,168,76,0.3)' }}>
                          {grpNum}조
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 불참 */}
        {absent.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#f87171' }}>
              <Ban size={12} />{ko ? `불참 ${absent.length}명` : `Absent · ${absent.length}`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {absent.map((a: any) => {
                const nm = lang === 'ko' ? a.users?.full_name : (a.users?.full_name_en || a.users?.full_name)
                return (
                  <span key={a.user_id} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {nm}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* 미응답 — 회장·총무는 탭하여 대리 응답 입력 */}
        {notRespon.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
              <HelpCircle size={12} />{ko ? `미응답 ${notRespon.length}명` : `No response · ${notRespon.length}`}
              {canManage && (
                <span className="ml-1 text-[10px]" style={{ color: '#86efac' }}>
                  · {ko ? '탭하여 대리 응답' : 'tap to proxy-RSVP'}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {notRespon.map((m: any) => (
                canManage ? (
                  <button key={m.user_id} type="button"
                    onClick={() => setProxyTarget(m)}
                    className="text-xs px-2.5 py-1 rounded-full transition active:scale-95 hover:opacity-80"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px dashed rgba(34,197,94,0.3)' }}>
                    {memberName(m)}
                  </button>
                ) : (
                  <span key={m.user_id} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                    {memberName(m)}
                  </span>
                )
              ))}
            </div>
          </div>
        )}

        {attending.length === 0 && absent.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">{ko ? '아직 응답이 없습니다.' : 'No responses yet.'}</p>
        )}
      </BottomSheet>

      {/* ━━ 골프장 응답 붙여넣기 모달 (회장·총무) — createPortal ━━━━━━━━━━ */}
      {showPasteModal && canManage && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowPasteModal(false)}>
          <div className="w-full max-w-md rounded-t-2xl overflow-hidden flex flex-col"
            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', maxHeight: '92dvh' }}
            onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-base font-bold text-white">
                  {ko ? '🏌️ 골프장 응답 붙여넣기' : 'Paste Golf Course Reply'}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>
                  {ko ? '시간·코스를 한 번에 입력 → 자동으로 분리됩니다' : 'Auto-parses times & courses'}
                </p>
              </div>
              <button onClick={() => setShowPasteModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* 본문 (스크롤) */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
              {/* 입력 */}
              <div>
                <label className="text-[11px] font-semibold block mb-1.5" style={{ color: '#9ca3af' }}>
                  {ko ? '골프장 답변 텍스트 (한 줄에 한 조)' : 'Reply text (one group per line)'}
                </label>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={ko
                    ? `예시 (어떤 포맷이든 OK):\n1조 06:30 Stella-Sole\n2조 06:42 Luna-Stella\n3조 06:54 Stella-Luna`
                    : `Example (any format):\n1조 06:30 Stella-Sole\nGroup 2 06:42 Luna-Stella\n#3 06:54 Stella-Luna`}
                  rows={7}
                  autoFocus
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-green-500"
                />
                <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>
                  {ko
                    ? '※ 조 번호가 없으면 줄 순서대로 1·2·3… 자동 부여'
                    : 'Tip: missing group numbers auto-fill as 1, 2, 3…'}
                </p>
              </div>

              {/* 파싱 결과 미리보기 */}
              {pasteParsed.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#86efac' }}>
                    ✓ {ko ? '파싱 결과' : 'Parsed'} ({pasteParsed.length}{ko ? '조' : ' groups'})
                  </p>
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="grid grid-cols-[40px_70px_1fr] text-[10px] font-bold px-2 py-1.5"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#9ca3af' }}>
                      <span>{ko ? '조' : 'Grp'}</span>
                      <span>{ko ? '시간' : 'Time'}</span>
                      <span>{ko ? '코스' : 'Course'}</span>
                    </div>
                    {pasteParsed.map(p => (
                      <div key={p.group}
                        className="grid grid-cols-[40px_70px_1fr] text-xs px-2 py-1.5"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className="font-bold text-white">{p.group}{ko ? '조' : ''}</span>
                        <span style={{ color: p.time ? '#93c5fd' : '#6b7280' }}>
                          {p.time || (ko ? '미인식' : '—')}
                        </span>
                        <span style={{ color: p.course ? '#c4b5fd' : '#6b7280' }}>
                          {p.course || (ko ? '미인식' : '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="flex gap-2 px-5 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => setShowPasteModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={applyPaste}
                disabled={pasteParsed.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#86efac' }}>
                {ko ? '저장 → 조 편성' : 'Save → Assign'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ━━ 대리 응답 시트 (회장·총무 전용) — createPortal 로 body 직속 렌더 ━ */}
      {proxyTarget && canManage && typeof window !== 'undefined' && createPortal((() => {
        const tName = memberName(proxyTarget)
        const cur = attendances.find(a => a.user_id === proxyTarget.user_id)?.status
        return (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setProxyTarget(null)}>
            <div className="w-full max-w-md rounded-t-2xl overflow-hidden"
              style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-4 pb-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-base font-bold text-white">
                  {ko ? `${tName} 대리 응답` : `Proxy RSVP — ${tName}`}
                </p>
                <p className="text-[11px] mt-1" style={{ color: '#9ca3af' }}>
                  {ko
                    ? `${meeting?.year}년 ${meeting?.month}월 정기모임 · 회장·총무 권한`
                    : `${meeting?.year}-${meeting?.month} meeting · officer override`}
                </p>
                {cur && (
                  <p className="text-[11px] mt-1" style={{ color: '#fbbf24' }}>
                    {ko ? '현재 응답' : 'Current'}: <span className="font-bold">
                      {cur === 'attending' ? (ko ? '참석' : 'Attending') : (ko ? '불참' : 'Absent')}
                    </span>
                  </p>
                )}
              </div>
              <div className="px-5 py-4 space-y-2"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                <button onClick={() => proxyRsvp(proxyTarget.user_id, 'attending')}
                  disabled={proxySaving}
                  className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.5)', color: '#86efac' }}>
                  <Check size={16} />{ko ? '참석으로 표시' : 'Mark Attending'}
                </button>
                <button onClick={() => proxyRsvp(proxyTarget.user_id, 'absent')}
                  disabled={proxySaving}
                  className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }}>
                  <Ban size={16} />{ko ? '불참으로 표시' : 'Mark Absent'}
                </button>
                {cur && (
                  <button onClick={() => proxyCancel(proxyTarget.user_id)}
                    disabled={proxySaving}
                    className="w-full py-2.5 rounded-xl text-xs font-medium disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                    {ko ? '응답 취소 (미응답으로 되돌리기)' : 'Clear response'}
                  </button>
                )}
                <button onClick={() => setProxyTarget(null)}
                  className="w-full py-2.5 rounded-xl text-xs"
                  style={{ color: '#94a3b8' }}>
                  {ko ? '닫기' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )
      })(), document.body)}

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
          <p className="text-center text-gray-400 py-8">{ko ? '분석 중...' : 'Analyzing...'}</p>
        ) : yearlyByUser.length === 0 ? (
          <p className="text-center text-gray-400 py-8">{ko ? '올해 등록된 스코어가 없습니다.' : 'No scores recorded this year.'}</p>
        ) : (
          <>
            <p className="text-xs text-gray-400">
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
                        <p className="text-[10px] text-gray-400">{ko ? '라운드' : 'Rounds'}</p>
                        <p className="text-sm font-bold text-white">{u.rounds}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-400">{ko ? '평균' : 'Avg'}</p>
                        <p className="text-sm font-bold text-yellow-300">{u.avg.toFixed(1)}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-400">{ko ? '최저' : 'Best'}</p>
                        <p className="text-sm font-bold text-green-300">{u.min}</p>
                      </div>
                      <div className="bg-gray-900/60 rounded-lg py-1.5">
                        <p className="text-[10px] text-gray-400">{ko ? '평균-파' : 'Avg-Par'}</p>
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
              <p className="text-xs text-gray-400 text-center">
                {ko ? '* 핸디 실제 변경은 회원 관리에서 수동으로 적용하세요' : '* Apply HC changes manually in Members page'}
              </p>
            )}
          </>
        )}
      </BottomSheet>

      {/* ── 2차 모임 등록/수정 Modal ── */}
      <BottomSheet
        open={showSecondModal}
        onClose={() => setShowSecondModal(false)}
        title={secondMeeting ? (ko ? '2차 모임 수정' : 'Edit After-party') : (ko ? '2차 모임 등록' : 'Add After-party')}
        footer={
          <div className="flex gap-3">
            {secondMeeting && canManage && (
              <button onClick={() => { deleteSecondMeeting(); setShowSecondModal(false) }}
                className="p-3 rounded-xl text-red-400 hover:bg-red-900/30 transition">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={() => setShowSecondModal(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">
              {ko ? '취소' : 'Cancel'}
            </button>
            <button onClick={saveSecondMeeting} disabled={savingSecond || !sForm.name.trim()}
              className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition"
              style={{ background: 'linear-gradient(135deg,#fb923c,#ea580c)', color: '#fff' }}>
              {savingSecond ? '...' : (ko ? '저장' : 'Save')}
            </button>
          </div>
        }
      >
        {/* 레스토랑 검색 */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: '#9ca3af' }}>
            {ko ? '🍽️ 레스토랑 / 장소 검색' : '🍽️ Search Restaurant / Venue'}
          </label>
          <PlaceSearchInput
            value={sForm.name}
            onChange={v => setSForm(f => ({ ...f, name: v }))}
            onSelect={p => setSForm(f => ({
              ...f,
              name:    p.name,
              address: p.address ?? f.address,
              placeId: p.place_id ?? f.placeId,
              lat:     p.lat != null ? String(p.lat) : f.lat,
              lng:     p.lng != null ? String(p.lng) : f.lng,
            }))}
            placeholder={ko ? '레스토랑 이름 검색...' : 'Search restaurant name...'}
            useFixed
          />
        </div>

        {/* 주소 */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: '#9ca3af' }}>
            {ko ? '📍 주소' : '📍 Address'}
          </label>
          <input
            value={sForm.address}
            onChange={e => setSForm(f => ({ ...f, address: e.target.value }))}
            placeholder={ko ? '주소 (레스토랑 검색 시 자동 입력)' : 'Address (auto-filled from search)'}
            className="input-field text-sm w-full"
          />
        </div>

        {/* 지도 미리보기 */}
        {(sForm.lat || sForm.placeId || sForm.address) && (
          <MapEmbed
            name={sForm.name}
            address={sForm.address}
            lat={sForm.lat ? parseFloat(sForm.lat) : null}
            lng={sForm.lng ? parseFloat(sForm.lng) : null}
            placeId={sForm.placeId}
            height={160}
            className="w-full"
          />
        )}

        {/* 시간 */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: '#9ca3af' }}>
            {ko ? '🕐 시간' : '🕐 Time'}
          </label>
          <input
            type="time"
            value={sForm.time}
            onChange={e => setSForm(f => ({ ...f, time: e.target.value }))}
            className="input-field text-sm w-full"
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: '#9ca3af' }}>
            {ko ? '📝 메모 (선택)' : '📝 Notes (optional)'}
          </label>
          <textarea
            rows={2}
            value={sForm.notes}
            onChange={e => setSForm(f => ({ ...f, notes: e.target.value }))}
            placeholder={ko ? '복장규정, 주차정보 등...' : 'Dress code, parking info...'}
            className="input-field text-sm w-full resize-none"
          />
        </div>

        {/* 알림 발송 안내 */}
        <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
          style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}>
          <Bell size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#fb923c' }} />
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {ko
              ? '저장 후 "전 회원 알림 발송" 버튼으로 푸시 알림을 보낼 수 있습니다.'
              : 'After saving, use "Notify All Members" to send push notifications.'}
          </p>
        </div>
      </BottomSheet>

    </div>
  )
}
