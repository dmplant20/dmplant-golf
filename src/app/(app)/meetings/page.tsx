'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { CalendarDays, Settings2, X, ChevronLeft, AlertTriangle, CheckCircle, XCircle, Clock, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── helpers ────────────────────────────────────────────────────────────────
/** Returns the date of the Nth occurrence of dayOfWeek in the given year/month.
 *  dayOfWeek: 0=Sun … 6=Sat   week: 1‑5 */
function getNthWeekday(year: number, month: number, week: number, dow: number): Date | null {
  const first = new Date(year, month - 1, 1)
  let diff = dow - first.getDay()
  if (diff < 0) diff += 7
  const day = 1 + diff + (week - 1) * 7
  if (day > new Date(year, month, 0).getDate()) return null // 5th week doesn't exist
  return new Date(year, month - 1, day)
}

function fmtDate(d: Date, ko: boolean) {
  return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' })
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? '오전' : '오후'
  const hh = h % 12 || 12
  return `${ap} ${hh}:${String(m).padStart(2, '0')}`
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_KO = ['첫째', '둘째', '셋째', '넷째', '다섯째']
const WEEK_EN = ['1st', '2nd', '3rd', '4th', '5th']

// Build list: past 2 months + next 10 months
function getMonthRange() {
  const now = new Date()
  const months: { year: number; month: number }[] = []
  for (let i = -2; i <= 10; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return months
}

// ── component ──────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const router = useRouter()
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [pattern, setPattern] = useState<any>(null)
  const [overrides, setOverrides] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // modal states
  const [showPatternModal, setShowPatternModal] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState<{ year: number; month: number } | null>(null)

  // pattern form
  const [pForm, setPForm] = useState({ week: 3, dow: 0, time: '07:00', venue: '', notes: '' })

  // override form
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
    if (pat) {
      setPForm({ week: pat.week_of_month, dow: pat.day_of_week, time: pat.start_time?.slice(0, 5) ?? '07:00', venue: pat.venue ?? '', notes: pat.notes ?? '' })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  // ── save pattern ─────────────────────────────────────────────────────────
  async function savePattern() {
    if (!currentClubId || !canManage) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('recurring_meetings').upsert({
      club_id: currentClubId,
      week_of_month: pForm.week,
      day_of_week: pForm.dow,
      start_time: pForm.time,
      venue: pForm.venue || null,
      notes: pForm.notes || null,
      is_active: true,
      created_by: user!.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'club_id' })
    setSaving(false)
    setShowPatternModal(false)
    load()
  }

  // ── save override ─────────────────────────────────────────────────────────
  async function saveOverride() {
    if (!currentClubId || !showOverrideModal) return
    setSaving(true)
    const supabase = createClient()
    const { year, month } = showOverrideModal
    await supabase.from('meeting_overrides').upsert({
      club_id: currentClubId,
      year, month,
      status: oForm.status,
      override_date: oForm.status === 'rescheduled' ? oForm.date : null,
      override_time: oForm.status === 'rescheduled' && oForm.time ? oForm.time : null,
      reason: oForm.reason || null,
      created_by: user!.id,
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

  // ── derived list ─────────────────────────────────────────────────────────
  const months = getMonthRange()
  const now = new Date()

  function getMonthInfo(year: number, month: number) {
    const override = overrides.find((o) => o.year === year && o.month === month)
    if (override?.status === 'cancelled') {
      return { status: 'cancelled' as const, date: null, time: null, reason: override.reason }
    }
    if (override?.status === 'rescheduled') {
      return {
        status: 'rescheduled' as const,
        date: override.override_date ? new Date(override.override_date + 'T00:00:00') : null,
        time: override.override_time ?? pattern?.start_time,
        reason: override.reason,
      }
    }
    if (!pattern) return { status: 'no_pattern' as const, date: null, time: null, reason: null }
    const d = getNthWeekday(year, month, pattern.week_of_month, pattern.day_of_week)
    return { status: 'scheduled' as const, date: d, time: pattern.start_time, reason: null }
  }

  const isPast = (year: number, month: number) =>
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)

  const patternLabel = pattern
    ? (ko
      ? `매월 ${WEEK_KO[pattern.week_of_month - 1]}째주 ${DOW_KO[pattern.day_of_week]}요일`
      : `Every ${WEEK_EN[pattern.week_of_month - 1]} ${DOW_EN[pattern.day_of_week]} of the month`)
    : (ko ? '미설정' : 'Not configured')

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <CalendarDays size={20} className="text-green-400" />
          <h1 className="text-lg font-bold text-white">{ko ? '정기모임' : 'Regular Meetings'}</h1>
        </div>
        {canManage && (
          <button
            onClick={() => { setPForm(pattern ? { week: pattern.week_of_month, dow: pattern.day_of_week, time: pattern.start_time?.slice(0, 5) ?? '07:00', venue: pattern.venue ?? '', notes: pattern.notes ?? '' } : { week: 3, dow: 0, time: '07:00', venue: '', notes: '' }); setShowPatternModal(true) }}
            className="flex items-center gap-1 text-xs text-green-400 border border-green-800 rounded-full px-3 py-1.5 hover:bg-green-900/30 transition">
            <Settings2 size={13} />
            {ko ? '패턴 설정' : 'Set Pattern'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">{ko ? '로딩 중...' : 'Loading...'}</div>
      ) : (
        <>
          {/* Pattern summary card */}
          <div className="glass-card rounded-2xl p-4 mb-5">
            <p className="text-xs text-gray-500 mb-1">{ko ? '반복 일정' : 'Recurring Schedule'}</p>
            <p className="text-white font-semibold text-base">{patternLabel}</p>
            {pattern?.start_time && (
              <div className="flex items-center gap-1 mt-1 text-green-400 text-sm">
                <Clock size={13} />
                <span>{fmtTime(pattern.start_time.slice(0, 5))}</span>
              </div>
            )}
            {pattern?.venue && (
              <div className="flex items-center gap-1 mt-0.5 text-gray-400 text-xs">
                <MapPin size={12} />
                <span>{pattern.venue}</span>
              </div>
            )}
            {!pattern && canManage && (
              <p className="text-yellow-400 text-xs mt-2">
                {ko ? '⚠ 패턴을 설정해 주세요.' : '⚠ Please configure a meeting pattern.'}
              </p>
            )}
          </div>

          {/* Month list */}
          <div className="space-y-2">
            {months.map(({ year, month }) => {
              const info = getMonthInfo(year, month)
              const past = isPast(year, month)
              const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1
              const monthLabel = ko
                ? `${year}년 ${month}월`
                : new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

              return (
                <div key={`${year}-${month}`}
                  className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 ${isThisMonth ? 'border border-green-700/60' : ''}`}>
                  {/* Status icon */}
                  {info.status === 'cancelled' && <XCircle size={20} className="text-red-400 flex-shrink-0" />}
                  {info.status === 'rescheduled' && <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0" />}
                  {info.status === 'scheduled' && <CheckCircle size={20} className={`flex-shrink-0 ${past ? 'text-gray-600' : 'text-green-400'}`} />}
                  {info.status === 'no_pattern' && <CalendarDays size={20} className="text-gray-600 flex-shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isThisMonth ? 'text-green-300' : past ? 'text-gray-500' : 'text-white'}`}>
                        {monthLabel}
                      </span>
                      {isThisMonth && <span className="text-[10px] bg-green-700 text-white px-2 py-0.5 rounded-full">{ko ? '이번달' : 'This Month'}</span>}
                    </div>

                    {info.status === 'cancelled' && (
                      <div>
                        <p className="text-red-400 text-xs">{ko ? '모임 취소' : 'Meeting Cancelled'}</p>
                        {info.reason && <p className="text-gray-500 text-xs">({info.reason})</p>}
                      </div>
                    )}
                    {info.status === 'rescheduled' && info.date && (
                      <div>
                        <p className="text-yellow-300 text-xs">
                          {ko ? '날짜 변경: ' : 'Rescheduled: '}{fmtDate(info.date, ko)}
                          {info.time && ` · ${fmtTime(info.time.slice(0, 5))}`}
                        </p>
                        {info.reason && <p className="text-gray-500 text-xs">({info.reason})</p>}
                      </div>
                    )}
                    {info.status === 'scheduled' && info.date && (
                      <p className={`text-xs ${past ? 'text-gray-600' : 'text-gray-400'}`}>
                        {fmtDate(info.date, ko)}
                        {info.time && ` · ${fmtTime(info.time.slice(0, 5))}`}
                      </p>
                    )}
                    {info.status === 'no_pattern' && (
                      <p className="text-gray-600 text-xs">{ko ? '패턴 미설정' : 'Pattern not set'}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && !past && info.status !== 'no_pattern' && (
                    <div className="flex-shrink-0">
                      {info.status === 'scheduled' ? (
                        <button
                          onClick={() => {
                            const calcDate = info.date
                            const dateStr = calcDate ? `${calcDate.getFullYear()}-${String(calcDate.getMonth()+1).padStart(2,'0')}-${String(calcDate.getDate()).padStart(2,'0')}` : ''
                            setOForm({ status: 'cancelled', date: dateStr, time: '', reason: '' })
                            setShowOverrideModal({ year, month })
                          }}
                          className="text-xs text-gray-400 hover:text-yellow-400 border border-gray-700 hover:border-yellow-700 px-3 py-1.5 rounded-lg transition">
                          {ko ? '조정' : 'Adjust'}
                        </button>
                      ) : (
                        <button
                          onClick={() => removeOverride(year, month)}
                          className="text-xs text-gray-500 hover:text-green-400 border border-gray-700 hover:border-green-800 px-3 py-1.5 rounded-lg transition">
                          {ko ? '원복' : 'Restore'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Pattern Modal ─────────────────────────────────────────────────── */}
      {showPatternModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowPatternModal(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{ko ? '정기 일정 패턴 설정' : 'Set Recurring Pattern'}</h3>
              <button onClick={() => setShowPatternModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Week of month */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">{ko ? '몇 번째 주' : 'Week of Month'}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((w) => (
                  <button key={w} type="button" onClick={() => setPForm((f) => ({ ...f, week: w }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm transition ${pForm.week === w ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    {ko ? WEEK_KO[w - 1] : WEEK_EN[w - 1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Day of week */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">{ko ? '요일' : 'Day of Week'}</label>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <button key={d} type="button" onClick={() => setPForm((f) => ({ ...f, dow: d }))}
                    className={`flex-1 py-2.5 rounded-xl text-xs transition ${pForm.dow === d ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    {ko ? DOW_KO[d] : DOW_EN[d]}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
              <p className="text-green-300 text-sm font-medium">
                {ko
                  ? `매월 ${WEEK_KO[pForm.week - 1]}째주 ${DOW_KO[pForm.dow]}요일`
                  : `Every ${WEEK_EN[pForm.week - 1]} ${DOW_EN[pForm.dow]} of the month`}
              </p>
              {/* Show next occurrence */}
              {(() => {
                const n = new Date()
                for (let i = 0; i < 3; i++) {
                  const y = n.getFullYear(), m = n.getMonth() + 1 + i
                  const adj = m > 12 ? { y: y + 1, m: m - 12 } : { y, m }
                  const d = getNthWeekday(adj.y, adj.m, pForm.week, pForm.dow)
                  if (d && d >= n) {
                    return <p className="text-green-400 text-xs mt-1">{ko ? '다음: ' : 'Next: '}{fmtDate(d, ko)}</p>
                  }
                }
                return null
              })()}
            </div>

            {/* Time */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '모임 시간' : 'Meeting Time'}</label>
              <input type="time" value={pForm.time} onChange={(e) => setPForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>

            {/* Venue */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '장소 (선택)' : 'Venue (optional)'}</label>
              <input value={pForm.venue} onChange={(e) => setPForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder={ko ? '예: OO 골프장' : 'e.g. OO Golf Club'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '메모 (선택)' : 'Notes (optional)'}</label>
              <textarea rows={2} value={pForm.notes} onChange={(e) => setPForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowPatternModal(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={savePattern} disabled={saving} className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-semibold">
                {saving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Override Modal ────────────────────────────────────────────────── */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowOverrideModal(null)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {ko
                  ? `${showOverrideModal.year}년 ${showOverrideModal.month}월 모임 조정`
                  : `Adjust ${new Date(showOverrideModal.year, showOverrideModal.month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`}
              </h3>
              <button onClick={() => setShowOverrideModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">{ko ? '처리 방식' : 'Action'}</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOForm((f) => ({ ...f, status: 'cancelled' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1 ${oForm.status === 'cancelled' ? 'bg-red-800 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  <XCircle size={15} /> {ko ? '모임 취소' : 'Cancel'}
                </button>
                <button type="button" onClick={() => setOForm((f) => ({ ...f, status: 'rescheduled' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1 ${oForm.status === 'rescheduled' ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  <AlertTriangle size={15} /> {ko ? '날짜 변경' : 'Reschedule'}
                </button>
              </div>
            </div>

            {oForm.status === 'rescheduled' && (
              <>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">{ko ? '변경 날짜' : 'New Date'}</label>
                  <input type="date" value={oForm.date} onChange={(e) => setOForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">{ko ? '변경 시간 (선택)' : 'New Time (optional)'}</label>
                  <input type="time" value={oForm.time} onChange={(e) => setOForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
                  <p className="text-xs text-gray-600 mt-1">{ko ? '비워두면 기존 시간 유지' : 'Leave empty to keep original time'}</p>
                </div>
              </>
            )}

            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '사유 (선택)' : 'Reason (optional)'}</label>
              <input value={oForm.reason} onChange={(e) => setOForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={ko ? '예: 설날, 폭설로 인한 취소' : 'e.g. Public holiday, Weather'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowOverrideModal(null)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button
                onClick={saveOverride}
                disabled={saving || (oForm.status === 'rescheduled' && !oForm.date)}
                className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-semibold">
                {saving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
