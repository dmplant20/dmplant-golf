'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { CalendarDays, Settings2, X, ChevronLeft, AlertTriangle, CheckCircle, XCircle, Clock, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' })
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? '오전' : '오후'
  const hh = h % 12 || 12
  return `${ap} ${hh}:${String(m).padStart(2, '0')}`
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_KO = ['1째', '2째', '3째', '4째', '5째']
const WEEK_EN = ['1st', '2nd', '3rd', '4th', '5th']

function getMonthRange() {
  const now = new Date()
  const months: { year: number; month: number }[] = []
  for (let i = -2; i <= 10; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return months
}

// ── Bottom Sheet Modal ────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70" />
      {/* sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 p-1"><X size={18} /></button>
        </div>
        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-8 space-y-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── main page ──────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const router = useRouter()
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [pattern, setPattern] = useState<any>(null)
  const [overrides, setOverrides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showPatternModal, setShowPatternModal] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState<{ year: number; month: number } | null>(null)

  const [pForm, setPForm] = useState({ week: 3, dow: 0, time: '07:00', venue: '', notes: '' })
  const [oForm, setOForm] = useState({ status: 'cancelled', date: '', time: '', reason: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: pat }, { data: ovr }] = await Promise.all([
      supabase.from('recurring_meetings').select('*').eq('club_id', currentClubId).single(),
      supabase.from('meeting_overrides').select('*').eq('club_id', currentClubId),
    ])
    setPattern(pat ?? null)
    setOverrides(ovr ?? [])
    if (pat) setPForm({
      week: pat.week_of_month, dow: pat.day_of_week,
      time: pat.start_time?.slice(0, 5) ?? '07:00',
      venue: pat.venue ?? '', notes: pat.notes ?? '',
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  async function savePattern() {
    if (!currentClubId || !canManage) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('recurring_meetings').upsert({
      club_id: currentClubId,
      week_of_month: pForm.week, day_of_week: pForm.dow,
      start_time: pForm.time, venue: pForm.venue || null,
      notes: pForm.notes || null, is_active: true,
      created_by: user!.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'club_id' })
    setSaving(false)
    setShowPatternModal(false)
    load()
  }

  async function saveOverride() {
    if (!currentClubId || !showOverrideModal) return
    setSaving(true)
    const supabase = createClient()
    const { year, month } = showOverrideModal
    await supabase.from('meeting_overrides').upsert({
      club_id: currentClubId, year, month,
      status: oForm.status,
      override_date: oForm.status === 'rescheduled' ? oForm.date : null,
      override_time: oForm.status === 'rescheduled' && oForm.time ? oForm.time : null,
      reason: oForm.reason || null, created_by: user!.id,
    }, { onConflict: 'club_id,year,month' })
    setSaving(false)
    setShowOverrideModal(null)
    load()
  }

  async function removeOverride(year: number, month: number) {
    if (!currentClubId) return
    const supabase = createClient()
    await supabase.from('meeting_overrides').delete()
      .eq('club_id', currentClubId).eq('year', year).eq('month', month)
    load()
  }

  const months = getMonthRange()
  const now = new Date()

  function getMonthInfo(year: number, month: number) {
    const ov = overrides.find((o) => o.year === year && o.month === month)
    if (ov?.status === 'cancelled') return { status: 'cancelled' as const, date: null, time: null, reason: ov.reason }
    if (ov?.status === 'rescheduled') return {
      status: 'rescheduled' as const,
      date: ov.override_date ? new Date(ov.override_date + 'T00:00:00') : null,
      time: ov.override_time ?? pattern?.start_time, reason: ov.reason,
    }
    if (!pattern) return { status: 'no_pattern' as const, date: null, time: null, reason: null }
    return {
      status: 'scheduled' as const,
      date: getNthWeekday(year, month, pattern.week_of_month, pattern.day_of_week),
      time: pattern.start_time, reason: null,
    }
  }

  const isPast = (y: number, m: number) =>
    y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)

  const patternLabel = pattern
    ? (ko
      ? `매월 ${WEEK_KO[pattern.week_of_month - 1]}주 ${DOW_KO[pattern.day_of_week]}요일`
      : `Every ${WEEK_EN[pattern.week_of_month - 1]} ${DOW_EN[pattern.day_of_week]}`)
    : (ko ? '패턴 미설정' : 'Not set')

  // next occurrence preview
  function nextOccurrence(w: number, d: number) {
    for (let i = 0; i < 3; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const nd = getNthWeekday(dt.getFullYear(), dt.getMonth() + 1, w, d)
      if (nd && nd >= now) return nd
    }
    return null
  }

  return (
    <div className="px-4 py-4 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="text-gray-400 p-1">
          <ChevronLeft size={20} />
        </button>
        <CalendarDays size={18} className="text-green-400" />
        <h1 className="text-base font-bold text-white flex-1">{ko ? '정기모임 일정' : 'Regular Meetings'}</h1>
        {canManage && (
          <button
            onClick={() => setShowPatternModal(true)}
            className="flex items-center gap-1 text-xs text-green-400 border border-green-800 rounded-full px-3 py-1.5">
            <Settings2 size={12} />
            {ko ? '패턴 설정' : 'Pattern'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-16">{ko ? '로딩 중...' : 'Loading...'}</p>
      ) : (
        <>
          {/* Pattern summary */}
          <div className="bg-gray-900 rounded-xl p-3 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarDays size={18} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{patternLabel}</p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {pattern?.start_time && (
                  <span className="text-green-400 text-xs flex items-center gap-1">
                    <Clock size={11} />{fmtTime(pattern.start_time.slice(0, 5))}
                  </span>
                )}
                {pattern?.venue && (
                  <span className="text-gray-400 text-xs flex items-center gap-1 truncate">
                    <MapPin size={11} />{pattern.venue}
                  </span>
                )}
              </div>
            </div>
            {!pattern && canManage && (
              <span className="text-yellow-400 text-xs">⚠ {ko ? '미설정' : 'Not set'}</span>
            )}
          </div>

          {/* Month list */}
          <div className="space-y-2">
            {months.map(({ year, month }) => {
              const info = getMonthInfo(year, month)
              const past = isPast(year, month)
              const isNow = year === now.getFullYear() && month === now.getMonth() + 1

              return (
                <div key={`${year}-${month}`}
                  className={`rounded-xl px-3 py-2.5 flex items-center gap-3 ${
                    isNow ? 'bg-green-900/20 border border-green-700/50' : 'bg-gray-900'
                  }`}>

                  {/* Status icon */}
                  <div className="flex-shrink-0 w-7 flex justify-center">
                    {info.status === 'cancelled' && <XCircle size={18} className="text-red-400" />}
                    {info.status === 'rescheduled' && <AlertTriangle size={18} className="text-yellow-400" />}
                    {info.status === 'scheduled' && <CheckCircle size={18} className={past ? 'text-gray-700' : 'text-green-500'} />}
                    {info.status === 'no_pattern' && <CalendarDays size={18} className="text-gray-700" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isNow ? 'text-green-300' : past ? 'text-gray-600' : 'text-white'}`}>
                        {ko ? `${year}년 ${month}월` : `${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                      </span>
                      {isNow && (
                        <span className="text-[10px] bg-green-700 text-white px-1.5 py-0.5 rounded-full">
                          {ko ? '이번달' : 'Now'}
                        </span>
                      )}
                    </div>

                    {info.status === 'cancelled' && (
                      <p className="text-xs text-red-400 mt-0.5">
                        {ko ? '취소됨' : 'Cancelled'}{info.reason ? ` · ${info.reason}` : ''}
                      </p>
                    )}
                    {info.status === 'rescheduled' && info.date && (
                      <p className="text-xs text-yellow-300 mt-0.5">
                        {fmtDate(info.date, ko)}{info.time ? ` · ${fmtTime(info.time.slice(0, 5))}` : ''}
                        {info.reason ? ` (${info.reason})` : ''}
                      </p>
                    )}
                    {info.status === 'scheduled' && info.date && (
                      <p className={`text-xs mt-0.5 ${past ? 'text-gray-700' : 'text-gray-400'}`}>
                        {fmtDate(info.date, ko)}{info.time ? ` · ${fmtTime(info.time.slice(0, 5))}` : ''}
                      </p>
                    )}
                    {info.status === 'no_pattern' && (
                      <p className="text-xs text-gray-700 mt-0.5">{ko ? '패턴 미설정' : '—'}</p>
                    )}
                  </div>

                  {/* Action button */}
                  {canManage && !past && info.status !== 'no_pattern' && (
                    info.status === 'scheduled' ? (
                      <button
                        onClick={() => {
                          const cd = info.date
                          const ds = cd ? `${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2,'0')}-${String(cd.getDate()).padStart(2,'0')}` : ''
                          setOForm({ status: 'cancelled', date: ds, time: '', reason: '' })
                          setShowOverrideModal({ year, month })
                        }}
                        className="flex-shrink-0 text-xs text-gray-500 border border-gray-700 rounded-lg px-2.5 py-1.5 hover:border-yellow-700 hover:text-yellow-400 transition">
                        {ko ? '조정' : 'Edit'}
                      </button>
                    ) : (
                      <button
                        onClick={() => removeOverride(year, month)}
                        className="flex-shrink-0 text-xs text-gray-500 border border-gray-700 rounded-lg px-2.5 py-1.5 hover:border-green-800 hover:text-green-400 transition">
                        {ko ? '원복' : 'Reset'}
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Pattern Bottom Sheet ──────────────────────────────────────────── */}
      <BottomSheet
        open={showPatternModal}
        onClose={() => setShowPatternModal(false)}
        title={ko ? '정기 일정 패턴 설정' : 'Set Meeting Pattern'}
      >
        {/* Week */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '몇 번째 주' : 'Week of Month'}</label>
          <div className="grid grid-cols-5 gap-1.5">
            {[1,2,3,4,5].map((w) => (
              <button key={w} type="button" onClick={() => setPForm((f) => ({ ...f, week: w }))}
                className={`py-2.5 rounded-xl text-sm font-medium transition ${pForm.week === w ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {ko ? WEEK_KO[w-1] : WEEK_EN[w-1]}
              </button>
            ))}
          </div>
        </div>

        {/* Day of week */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '요일' : 'Day of Week'}</label>
          <div className="grid grid-cols-7 gap-1">
            {[0,1,2,3,4,5,6].map((d) => (
              <button key={d} type="button" onClick={() => setPForm((f) => ({ ...f, dow: d }))}
                className={`py-2.5 rounded-xl text-xs font-medium transition ${pForm.dow === d ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {ko ? DOW_KO[d] : DOW_EN[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {(() => {
          const next = nextOccurrence(pForm.week, pForm.dow)
          return (
            <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
              <p className="text-green-300 text-sm font-semibold">
                {ko ? `매월 ${WEEK_KO[pForm.week-1]}주 ${DOW_KO[pForm.dow]}요일` : `Every ${WEEK_EN[pForm.week-1]} ${DOW_EN[pForm.dow]}`}
              </p>
              {next && <p className="text-green-500 text-xs mt-1">{ko ? '다음: ' : 'Next: '}{fmtDate(next, ko)}</p>}
            </div>
          )
        })()}

        {/* Time */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '모임 시간' : 'Meeting Time'}</label>
          <input type="time" value={pForm.time} onChange={(e) => setPForm((f) => ({ ...f, time: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        </div>

        {/* Venue */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '장소 (선택)' : 'Venue (optional)'}</label>
          <input value={pForm.venue} onChange={(e) => setPForm((f) => ({ ...f, venue: e.target.value }))}
            placeholder={ko ? '예: OO 골프장' : 'e.g. OO Golf Club'}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '메모 (선택)' : 'Notes (optional)'}</label>
          <textarea rows={2} value={pForm.notes} onChange={(e) => setPForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm resize-none" />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button onClick={() => setShowPatternModal(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
            {ko ? '취소' : 'Cancel'}
          </button>
          <button onClick={savePattern} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-semibold text-sm">
            {saving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
          </button>
        </div>
      </BottomSheet>

      {/* ── Override Bottom Sheet ─────────────────────────────────────────── */}
      <BottomSheet
        open={!!showOverrideModal}
        onClose={() => setShowOverrideModal(null)}
        title={showOverrideModal
          ? (ko ? `${showOverrideModal.year}년 ${showOverrideModal.month}월 조정` : `Adjust ${new Date(showOverrideModal.year, showOverrideModal.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`)
          : ''}
      >
        {/* Action type */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">{ko ? '처리 방식' : 'Action'}</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOForm((f) => ({ ...f, status: 'cancelled' }))}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 ${oForm.status === 'cancelled' ? 'bg-red-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
              <XCircle size={15} /> {ko ? '이달 취소' : 'Cancel'}
            </button>
            <button type="button" onClick={() => setOForm((f) => ({ ...f, status: 'rescheduled' }))}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 ${oForm.status === 'rescheduled' ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
              <AlertTriangle size={15} /> {ko ? '날짜 변경' : 'Reschedule'}
            </button>
          </div>
        </div>

        {oForm.status === 'rescheduled' && (
          <>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '변경 날짜 *' : 'New Date *'}</label>
              <input type="date" value={oForm.date} onChange={(e) => setOForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '변경 시간 (선택)' : 'New Time (optional)'}</label>
              <input type="time" value={oForm.time} onChange={(e) => setOForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
              <p className="text-xs text-gray-600 mt-1">{ko ? '비워두면 기존 시간 유지' : 'Leave empty to keep original time'}</p>
            </div>
          </>
        )}

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">{ko ? '사유 (선택)' : 'Reason (optional)'}</label>
          <input value={oForm.reason} onChange={(e) => setOForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder={ko ? '예: 설날, 폭설' : 'e.g. Holiday, Weather'}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => setShowOverrideModal(null)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
            {ko ? '취소' : 'Cancel'}
          </button>
          <button
            onClick={saveOverride}
            disabled={saving || (oForm.status === 'rescheduled' && !oForm.date)}
            className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-semibold text-sm">
            {saving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
