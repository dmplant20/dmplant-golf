'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Trophy, Plus, Camera, Users, ChevronLeft,
  ChevronDown, ChevronUp, Gift, Award, MapPin,
  Calendar, X, Save, Trash2, ScanLine, Swords,
} from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'
import CourseSearchInput from '@/components/ui/CourseSearchInput'

// ── 대회 유형 ────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { value: 'first_half',  emoji: '🌸', ko: '상반기',  en: '1st Half',   color: '#34d399', rgb: '52,211,153'   },
  { value: 'second_half', emoji: '🍂', ko: '하반기',  en: '2nd Half',   color: '#fb923c', rgb: '251,146,60'   },
  { value: 'year_end',    emoji: '🏆', ko: '연말',    en: 'Year-End',   color: '#fbbf24', rgb: '251,191,36'   },
  { value: 'special',     emoji: '⭐', ko: '특별',    en: 'Special',    color: '#a78bfa', rgb: '167,139,250'  },
]
const getET = (v: string) => EVENT_TYPES.find(t => t.value === v) ?? EVENT_TYPES[3]

// ── 상품 유형 ────────────────────────────────────────────────────────────────
const PRIZE_TYPES = [
  { value: 'place',         ko: '순위상',    en: 'Place',        icon: '🏅' },
  { value: 'nearest_pin',   ko: '니어핀',    en: 'Nearest Pin',  icon: '📍' },
  { value: 'longest_drive', ko: '롱기스트',  en: 'Longest',      icon: '💨' },
  { value: 'best_gross',    ko: '베스트',    en: 'Best Gross',   icon: '⛳' },
  { value: 'most_improved', ko: '향상상',    en: 'Most Improved',icon: '📈' },
  { value: 'special',       ko: '특별상',    en: 'Special',      icon: '🎁' },
]
const getPT = (v: string) => PRIZE_TYPES.find(t => t.value === v) ?? PRIZE_TYPES[0]

const MEDALS = [
  { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', tc: '#000', emoji: '🥇', label: '1위' },
  { bg: 'linear-gradient(135deg,#9ca3af,#6b7280)', tc: '#fff', emoji: '🥈', label: '2위' },
  { bg: 'linear-gradient(135deg,#cd7f32,#a16207)', tc: '#fff', emoji: '🥉', label: '3위' },
]

const CURRENCY_SYM: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp' }

interface Tournament {
  id: string; name: string; name_en?: string; event_type: string
  date: string; venue?: string; status: string
  is_official: boolean; grouping_method: string
}

// ── 상태 뱃지 ────────────────────────────────────────────────────────────────
function StatusPill({ status, ko }: { status: string; ko: boolean }) {
  const cfg: Record<string, { label: [string,string]; dot: string }> = {
    upcoming:  { label: ['예정','Upcoming'],  dot: '#60a5fa' },
    ongoing:   { label: ['진행중','Ongoing'], dot: '#fbbf24' },
    completed: { label: ['완료','Completed'], dot: '#22c55e' },
  }
  const c = cfg[status] ?? cfg.upcoming
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${c.dot}18`, color: c.dot, border: `1px solid ${c.dot}30` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {ko ? c.label[0] : c.label[1]}
    </span>
  )
}

// ── 구분선 ────────────────────────────────────────────────────────────────────
const Divider = () => (
  <div className="h-px my-1" style={{ background: 'linear-gradient(90deg,transparent,rgba(34,197,94,0.15),transparent)' }} />
)

export default function ChampionshipPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const canManage = OFFICER_ROLES.includes(myRole)

  const thisYear = new Date().getFullYear()
  const years    = Array.from({ length: 5 }, (_, i) => thisYear - i)

  const [selectedYear,   setSelectedYear]   = useState(thisYear)
  const [tab,            setTab]            = useState<'list' | 'records'>('list')
  const [view,           setView]           = useState<'list' | 'detail'>('list')
  const [events,         setEvents]         = useState<Tournament[]>([])
  const [allEvents,      setAllEvents]      = useState<Tournament[]>([])
  const [selectedEvent,  setSelectedEvent]  = useState<Tournament | null>(null)
  const [groups,         setGroups]         = useState<any[]>([])
  const [prizes,         setPrizes]         = useState<any[]>([])
  const [members,        setMembers]        = useState<any[]>([])
  const [currency,       setCurrency]       = useState('KRW')
  const [loading,        setLoading]        = useState(true)
  const [ocrLoading,     setOcrLoading]     = useState(false)
  const [showPrizePanel, setShowPrizePanel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const emptyForm  = { name: '', nameEn: '', date: '', venue: '', eventType: 'special', groupingMethod: 'auto_handicap' }
  const emptyPrize = { prize_rank: 1, prize_type: 'place', user_id: '', member_name: '', gross_score: '', net_score: '', prize_description: '' }
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(emptyForm)
  const [prizeForm,  setPrizeForm]  = useState(emptyPrize)

  // ── data ──────────────────────────────────────────────────────────────────
  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: evs }, { data: mems }, { data: club }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('club_id', currentClubId).order('date', { ascending: false }),
      supabase.from('club_memberships').select('user_id, users(full_name, full_name_en, name_abbr)').eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
    ])
    setAllEvents(evs ?? [])
    setMembers(mems ?? [])
    if (club?.currency) setCurrency(club.currency)
    setLoading(false)
  }

  useEffect(() => { setEvents(allEvents.filter(e => new Date(e.date).getFullYear() === selectedYear)) }, [allEvents, selectedYear])
  useEffect(() => { load() }, [currentClubId])

  async function loadEventDetail(ev: Tournament) {
    setSelectedEvent(ev); setView('detail')
    const supabase = createClient()
    const [{ data: grps }, { data: prz }] = await Promise.all([
      supabase.from('tournament_groups').select('*, tournament_group_members(*, users(full_name, full_name_en, name_abbr))').eq('tournament_id', ev.id).order('group_number'),
      supabase.from('tournament_prizes').select('*, users(full_name, full_name_en)').eq('tournament_id', ev.id).order('prize_rank'),
    ])
    setGroups(grps ?? [])
    setPrizes(prz ?? [])
  }

  async function createEvent() {
    if (!form.name || !form.date || !currentClubId) return
    const supabase = createClient()
    const { data } = await supabase.from('tournaments').insert({
      club_id: currentClubId, name: form.name, name_en: form.nameEn || null,
      date: form.date, venue: form.venue || null, event_type: form.eventType,
      is_official: true, grouping_method: form.groupingMethod, created_by: user!.id, status: 'upcoming',
    }).select().single()
    setShowCreate(false); setForm(emptyForm)
    if (data && form.groupingMethod !== 'manual') await autoGroup(data.id, form.groupingMethod)
    load()
  }

  async function autoGroup(tournamentId: string, method: string) {
    const supabase = createClient()
    const { data: mems } = await supabase.from('club_memberships').select('user_id, club_handicap').eq('club_id', currentClubId).eq('status', 'approved')
    if (!mems?.length) return
    let sorted = [...mems]
    if (method === 'auto_handicap') sorted.sort((a, b) => (a.club_handicap ?? 99) - (b.club_handicap ?? 99))
    else sorted.sort(() => Math.random() - 0.5)
    for (let g = 0; g < Math.ceil(sorted.length / 4); g++) {
      const { data: grp } = await supabase.from('tournament_groups').insert({ tournament_id: tournamentId, group_number: g + 1 }).select().single()
      if (!grp) continue
      await supabase.from('tournament_group_members').insert(sorted.slice(g * 4, (g + 1) * 4).map(m => ({ group_id: grp.id, user_id: m.user_id, handicap_used: m.club_handicap })))
    }
  }

  async function updateScore(memberId: string, score: number, hc: number) {
    await createClient().from('tournament_group_members').update({ score, net_score: score - hc }).eq('id', memberId)
    if (selectedEvent) loadEventDetail(selectedEvent)
  }

  async function handleScorecardScan(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedEvent) return
    const file = e.target.files?.[0]; if (!file) return
    setOcrLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const res = await fetch('/api/ocr/scorecard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, members: members.map((m: any) => ({ ...m.users, user_id: m.user_id })), lang }) })
      const data = await res.json()
      const supabase = createClient()
      const allGMs = groups.flatMap(g => g.tournament_group_members)
      for (const s of (data.scores ?? [])) {
        if (s.user_id && s.score) {
          const gm = allGMs.find((m: any) => m.user_id === s.user_id)
          if (gm) await supabase.from('tournament_group_members').update({ score: s.score, net_score: s.score - (gm.handicap_used ?? 0) }).eq('id', gm.id)
        }
      }
      loadEventDetail(selectedEvent); setOcrLoading(false)
    }
    reader.readAsDataURL(file)
  }

  async function savePrize() {
    if (!selectedEvent || (!prizeForm.member_name && !prizeForm.user_id)) return
    const supabase = createClient()
    const memberName = prizeForm.user_id ? (members.find(m => m.user_id === prizeForm.user_id)?.users?.full_name ?? prizeForm.member_name) : prizeForm.member_name
    const { data } = await supabase.from('tournament_prizes').insert({
      tournament_id: selectedEvent.id, prize_rank: prizeForm.prize_type === 'place' ? prizeForm.prize_rank : null,
      prize_type: prizeForm.prize_type, user_id: prizeForm.user_id || null, member_name: memberName,
      gross_score: prizeForm.gross_score ? parseInt(prizeForm.gross_score) : null,
      net_score: prizeForm.net_score ? parseInt(prizeForm.net_score) : null,
      prize_description: prizeForm.prize_description.trim() || null, created_by: user!.id,
    }).select().single()
    if (data) setPrizes(p => [...p, data].sort((a, b) => (a.prize_rank ?? 99) - (b.prize_rank ?? 99)))
    setPrizeForm(emptyPrize)
    if (prizeForm.prize_type === 'place' && prizeForm.prize_rank === 1) {
      await supabase.from('tournaments').update({ status: 'completed' }).eq('id', selectedEvent.id)
      load()
    }
  }

  async function deletePrize(id: string) {
    await createClient().from('tournament_prizes').delete().eq('id', id)
    setPrizes(p => p.filter(x => x.id !== id))
  }

  function calcRanking() {
    return groups.flatMap(g => g.tournament_group_members ?? [])
      .filter(m => m.net_score != null || m.score != null)
      .sort((a, b) => (a.net_score ?? a.score ?? 999) - (b.net_score ?? b.score ?? 999))
      .slice(0, 10)
  }

  const sym = CURRENCY_SYM[currency] ?? '₩'
  const name = (ev: Tournament) => ko ? ev.name : (ev.name_en || ev.name)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="pb-8 animate-fade-in">

      {/* ══ 헤더 ══════════════════════════════════════════════════════════════ */}
      {view === 'detail' && selectedEvent ? (
        /* 상세 헤더 */
        <div className="px-4 pt-4 pb-3">
          <button
            onClick={() => { setView('list'); setSelectedEvent(null); setShowPrizePanel(false) }}
            className="flex items-center gap-1.5 text-xs font-medium mb-3 -ml-0.5"
            style={{ color: '#5a7a5a' }}>
            <ChevronLeft size={14} />
            {ko ? '대회 목록' : 'All Events'}
          </button>
          {(() => {
            const et = getET(selectedEvent.event_type)
            return (
              <div className="rounded-2xl p-4"
                style={{ background: `linear-gradient(135deg, rgba(${et.rgb},0.14) 0%, rgba(6,13,6,0.98) 100%)`, border: `1px solid rgba(${et.rgb},0.22)` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg leading-none">{et.emoji}</span>
                      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: et.color }}>
                        {ko ? et.ko : et.en} · {ko ? '클럽 대회' : 'Championship'}
                      </span>
                    </div>
                    <h1 className="text-lg font-bold text-white leading-tight">{name(selectedEvent)}</h1>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} style={{ color: et.color }} />
                        <span className="text-xs" style={{ color: '#a3b8a3' }}>
                          {new Date(selectedEvent.date).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { year:'numeric', month:'long', day:'numeric', weekday:'short' })}
                        </span>
                      </div>
                      {selectedEvent.venue && (
                        <div className="flex items-center gap-1">
                          <MapPin size={11} style={{ color: et.color }} />
                          <span className="text-xs" style={{ color: '#a3b8a3' }}>{selectedEvent.venue}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <StatusPill status={selectedEvent.status} ko={ko} />
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        /* 목록 헤더 */
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,rgba(22,163,74,0.2),rgba(22,163,74,0.08))', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Swords size={15} style={{ color: '#22c55e' }} />
              </div>
              <h1 className="text-base font-bold text-white">{ko ? '클럽 대회' : 'Club Championship'}</h1>
            </div>
            <p className="text-[11px] mt-1 ml-10" style={{ color: '#3a5a3a' }}>
              {ko ? '상반기 · 하반기 · 연말 · 특별 대회' : '1st Half · 2nd Half · Year-End · Special'}
            </p>
          </div>
          {canManage && view === 'list' && tab === 'list' && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 14px rgba(22,163,74,0.35)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <Plus size={14} strokeWidth={2.5} />
              {ko ? '대회 생성' : 'New Event'}
            </button>
          )}
        </div>
      )}

      {/* ══ 탭 ══════════════════════════════════════════════════════════════ */}
      {view === 'list' && (
        <div className="px-4 mb-3">
          <div className="flex gap-1 p-1 rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(34,197,94,0.08)' }}>
            {([['list', ko ? '대회 목록' : 'Events', '🏆'], ['records', ko ? '역대 기록' : 'Records', '📜']] as const).map(([t, label, ic]) => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={tab === t
                  ? { background: 'linear-gradient(135deg,rgba(22,163,74,0.22),rgba(14,53,29,0.5))', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', boxShadow: 'inset 0 1px 0 rgba(34,197,94,0.1)' }
                  : { color: '#3a5a3a' }}>
                <span>{ic}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ 콘텐츠 ══════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(34,197,94,0.2)', borderTopColor: '#22c55e' }} />
          <p className="text-xs" style={{ color: '#3a5a3a' }}>{ko ? '불러오는 중...' : 'Loading...'}</p>
        </div>

      ) : view === 'detail' && selectedEvent ? (
        /* ── 대회 상세 ─────────────────────────────────────────────────── */
        <div className="px-4 space-y-3">

          {/* 임원 액션 버튼 */}
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={ocrLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: '#4ade80' }}>
                <ScanLine size={14} />
                {ocrLoading ? (ko ? '분석 중...' : 'Scanning…') : (ko ? '스코어카드 스캔' : 'Scan Scorecard')}
              </button>
              <button onClick={() => setShowPrizePanel(v => !v)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap"
                style={showPrizePanel
                  ? { background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }
                  : { background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}>
                <Gift size={13} />
                {ko ? '시상 등록' : 'Prizes'}
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScorecardScan} />

          {/* 시상 등록 패널 */}
          {canManage && showPrizePanel && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(6,13,6,0.95)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(251,191,36,0.1)' }}>
                <span className="text-xs font-bold tracking-wide" style={{ color: '#fbbf24' }}>
                  🎖 {ko ? '시상 등록' : 'Add Prize'}
                </span>
                <button onClick={() => { setShowPrizePanel(false); setPrizeForm(emptyPrize) }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a7a5a' }}>
                  <X size={13} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {/* 상품 유형 */}
                <div className="grid grid-cols-3 gap-1.5">
                  {PRIZE_TYPES.map(pt => (
                    <button key={pt.value} onClick={() => setPrizeForm(f => ({ ...f, prize_type: pt.value }))}
                      className="py-2 rounded-xl text-[11px] font-semibold transition flex flex-col items-center gap-0.5"
                      style={prizeForm.prize_type === pt.value
                        ? { background: 'rgba(251,191,36,0.16)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }
                        : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#5a7a5a' }}>
                      <span className="text-base leading-none">{pt.icon}</span>
                      {ko ? pt.ko : pt.en}
                    </button>
                  ))}
                </div>

                {/* 순위 선택 (place) */}
                {prizeForm.prize_type === 'place' && (
                  <div className="flex gap-2">
                    {MEDALS.map((m, i) => (
                      <button key={i} onClick={() => setPrizeForm(f => ({ ...f, prize_rank: i + 1 }))}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5"
                        style={prizeForm.prize_rank === i + 1
                          ? { background: m.bg, color: m.tc, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }
                          : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', color: '#3a5a3a' }}>
                        <span>{m.emoji}</span> {ko ? m.label : `${i + 1}${['st','nd','rd'][i]}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* 회원 선택 */}
                <select value={prizeForm.user_id} onChange={e => setPrizeForm(f => ({ ...f, user_id: e.target.value, member_name: '' }))}
                  className="input-field text-sm">
                  <option value="">{ko ? '— 회원 선택 —' : '— Select member —'}</option>
                  {members.map((m: any) => (
                    <option key={m.user_id} value={m.user_id}>
                      {ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                    </option>
                  ))}
                </select>
                {!prizeForm.user_id && (
                  <input value={prizeForm.member_name} onChange={e => setPrizeForm(f => ({ ...f, member_name: e.target.value }))}
                    placeholder={ko ? '이름 직접 입력' : 'Or type name'} className="input-field text-sm" />
                )}

                {/* 스코어 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: '#5a7a5a' }}>{ko ? 'GROSS' : 'GROSS'}</label>
                    <input type="number" value={prizeForm.gross_score} onChange={e => setPrizeForm(f => ({ ...f, gross_score: e.target.value }))} placeholder="78" className="input-field text-sm text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold block mb-1" style={{ color: '#5a7a5a' }}>{ko ? 'NET' : 'NET'}</label>
                    <input type="number" value={prizeForm.net_score} onChange={e => setPrizeForm(f => ({ ...f, net_score: e.target.value }))} placeholder="66" className="input-field text-sm text-center" />
                  </div>
                </div>

                {/* 상품 내용 */}
                <input value={prizeForm.prize_description} onChange={e => setPrizeForm(f => ({ ...f, prize_description: e.target.value }))}
                  placeholder={ko ? '예: 트로피 + ₫2,000,000 / 캐디백' : 'e.g. Trophy + ₫2,000,000 / Golf bag'}
                  className="input-field text-sm" />

                <button onClick={savePrize} disabled={!prizeForm.member_name && !prizeForm.user_id}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)', color: '#fff', boxShadow: '0 4px 16px rgba(217,119,6,0.3)' }}>
                  <Save size={14} /> {ko ? '시상 등록' : 'Save Prize'}
                </button>
              </div>
            </div>
          )}

          {/* 현재 순위 */}
          {calcRanking().length > 0 && (
            <div className="rounded-2xl overflow-hidden glass-card">
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(34,197,94,0.08)' }}>
                <Trophy size={13} style={{ color: '#22c55e' }} />
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#22c55e' }}>
                  {ko ? '현재 순위 · 넷 스코어 기준' : 'Rankings · Net Score'}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(34,197,94,0.05)' }}>
                {calcRanking().map((m, i) => {
                  const mName = ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)
                  const medal = MEDALS[i]
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3"
                      style={{ background: i < 3 ? `rgba(${['251,191,36','156,163,175','180,83,9'][i]},0.04)` : 'transparent' }}>
                      {medal ? (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: medal.bg }}>
                          {medal.emoji}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(255,255,255,0.04)', color: '#5a7a5a' }}>
                          {i + 1}
                        </div>
                      )}
                      <span className="text-sm text-white flex-1 truncate font-medium">{mName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {m.handicap_used != null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: 'rgba(34,197,94,0.08)', color: '#5a7a5a' }}>
                            HC{m.handicap_used}
                          </span>
                        )}
                        <span className="text-base font-bold tabular-nums"
                          style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : '#a3b8a3' }}>
                          {m.net_score ?? m.score}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 시상 결과 */}
          {prizes.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(160deg,rgba(251,191,36,0.07),rgba(6,13,6,0.98))', border: '1px solid rgba(251,191,36,0.18)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(251,191,36,0.1)' }}>
                <Award size={13} style={{ color: '#fbbf24' }} />
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#fbbf24' }}>
                  {ko ? '시상 결과' : 'Prize Results'}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                {prizes.map((p) => {
                  const pt = getPT(p.prize_type)
                  const mName = ko ? (p.users?.full_name ?? p.member_name) : (p.users?.full_name_en || p.users?.full_name || p.member_name)
                  const medalIdx = p.prize_type === 'place' ? (p.prize_rank ?? 4) - 1 : -1
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.08)' }}>
                      <span className="text-xl flex-shrink-0 leading-none">
                        {medalIdx >= 0 && medalIdx < 3 ? MEDALS[medalIdx].emoji : pt.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                            {ko ? pt.ko : pt.en}{p.prize_type === 'place' && p.prize_rank ? ` ${p.prize_rank}위` : ''}
                          </span>
                          <span className="text-sm font-bold text-white">{mName}</span>
                        </div>
                        {(p.gross_score || p.net_score) && (
                          <p className="text-[11px] mt-0.5" style={{ color: '#a3b8a3' }}>
                            {[p.gross_score && `${ko ? '그로스' : 'Gross'} ${p.gross_score}`, p.net_score && `Net ${p.net_score}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {p.prize_description && <p className="text-[11px] mt-0.5 font-medium" style={{ color: '#fde68a' }}>{p.prize_description}</p>}
                      </div>
                      {canManage && (
                        <button onClick={() => deletePrize(p.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 조 편성 & 스코어 */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2.5 flex items-center gap-2" style={{ color: '#3a5a3a' }}>
              <Users size={11} />
              {ko ? '조 편성 및 스코어' : 'Groups & Scores'}
            </p>
            <div className="space-y-2">
              {groups.map(g => (
                <div key={g.id} className="rounded-2xl overflow-hidden glass-card">
                  <div className="px-4 py-2.5 flex items-center gap-2"
                    style={{ borderBottom: '1px solid rgba(34,197,94,0.06)', background: 'rgba(34,197,94,0.03)' }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      {g.group_number}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
                      {ko ? `${g.group_number}조` : `Group ${g.group_number}`}
                    </span>
                    {g.tee_time && <span className="text-[11px] ml-auto" style={{ color: '#5a7a5a' }}>{g.tee_time}</span>}
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(34,197,94,0.04)' }}>
                    {g.tournament_group_members?.map((m: any) => {
                      const mName = ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-sm text-white flex-1 truncate">{mName}</span>
                          {m.handicap_used != null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                              style={{ background: 'rgba(34,197,94,0.07)', color: '#5a7a5a' }}>
                              HC{m.handicap_used}
                            </span>
                          )}
                          {canManage ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <input type="number" defaultValue={m.score ?? ''}
                                onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) updateScore(m.id, v, m.handicap_used ?? 0) }}
                                className="w-14 rounded-lg text-center text-sm font-bold py-1.5 tabular-nums"
                                style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', color: '#fff', outline: 'none' }}
                                placeholder="—" />
                              {m.net_score != null && (
                                <span className="text-[11px] w-10 text-right tabular-nums" style={{ color: '#5a7a5a' }}>
                                  {m.net_score}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm font-bold tabular-nums flex-shrink-0"
                              style={{ color: m.score ? '#22c55e' : '#3a5a3a' }}>
                              {m.score ?? '—'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="rounded-2xl py-10 flex flex-col items-center gap-2" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(34,197,94,0.1)' }}>
                  <Users size={28} style={{ color: '#1a3a1a' }} />
                  <p className="text-xs" style={{ color: '#2a4a2a' }}>{ko ? '조편성이 없습니다' : 'No groups formed'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      ) : tab === 'list' ? (
        /* ── 대회 목록 ─────────────────────────────────────────────────── */
        <div className="px-4 space-y-4">
          {/* 연도 필터 */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scroll-hide">
            {years.map(y => (
              <button key={y} onClick={() => setSelectedYear(y)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                style={y === selectedYear
                  ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 2px 10px rgba(22,163,74,0.35)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.1)', color: '#3a5a3a' }}>
                {y}{ko ? '년' : ''}
              </button>
            ))}
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.04)', border: '1px dashed rgba(34,197,94,0.12)' }}>
                <Trophy size={28} style={{ color: '#1a3a1a' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: '#2a4a2a' }}>
                  {ko ? `${selectedYear}년 대회가 없습니다` : `No events in ${selectedYear}`}
                </p>
                {canManage && (
                  <button onClick={() => setShowCreate(true)} className="text-xs mt-2 font-semibold" style={{ color: '#16a34a' }}>
                    + {ko ? '첫 대회 만들기' : 'Create first event'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {events.map(ev => {
                const et = getET(ev.event_type)
                const dt = new Date(ev.date)
                return (
                  <button key={ev.id} onClick={() => loadEventDetail(ev)}
                    className="w-full text-left rounded-2xl transition-all active:scale-[0.985]"
                    style={{ background: `linear-gradient(135deg, rgba(${et.rgb},0.1) 0%, rgba(6,13,6,0.97) 55%)`, border: `1px solid rgba(${et.rgb},0.18)` }}>
                    <div className="p-4">
                      {/* Top row: type badge + status */}
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full"
                          style={{ background: `rgba(${et.rgb},0.12)`, color: et.color, border: `1px solid rgba(${et.rgb},0.2)` }}>
                          <span>{et.emoji}</span>
                          {ko ? `${et.ko} 대회` : `${et.en} Championship`}
                        </span>
                        <StatusPill status={ev.status} ko={ko} />
                      </div>
                      {/* Event name */}
                      <p className="text-base font-bold text-white leading-snug">{name(ev)}</p>
                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar size={10} style={{ color: `rgba(${et.rgb},0.7)` }} />
                          <span className="text-[11px]" style={{ color: '#a3b8a3' }}>
                            {dt.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month:'short', day:'numeric', weekday:'short' })}
                          </span>
                        </div>
                        {ev.venue && (
                          <>
                            <span style={{ color: '#2a4a2a' }}>·</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <MapPin size={10} style={{ color: `rgba(${et.rgb},0.7)` }} />
                              <span className="text-[11px] truncate" style={{ color: '#a3b8a3', maxWidth: 140 }}>{ev.venue}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <Divider />
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: '#2a4a2a' }}>
                        {ko ? '탭하여 상세 보기' : 'Tap to view details'}
                      </span>
                      <ChevronDown size={12} style={{ color: '#2a4a2a', transform: 'rotate(-90deg)' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

      ) : (
        /* ── 역대 기록 ─────────────────────────────────────────────────── */
        <RecordsTab allEvents={allEvents} years={years} ko={ko} lang={lang} sym={sym} clubId={currentClubId!} />
      )}

      {/* ══ 대회 생성 모달 ══════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-[200] flex items-end" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCreate(false)}>
          <div className="w-full rounded-t-3xl animate-slide-up overflow-y-auto"
            style={{ background: 'linear-gradient(160deg,#0b180b,#060d06)', border: '1px solid rgba(34,197,94,0.15)', borderBottom: 'none', maxHeight: '92dvh' }}
            onClick={e => e.stopPropagation()}>
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-9 h-1 rounded-full" style={{ background: '#1a3a1a' }} />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pb-4" style={{ borderBottom: '1px solid rgba(34,197,94,0.08)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <Trophy size={15} style={{ color: '#22c55e' }} />
                </div>
                <div>
                  <p className="text-base font-bold text-white">{ko ? '대회 생성' : 'Create Event'}</p>
                  <p className="text-[10px]" style={{ color: '#3a5a3a' }}>{ko ? '새 클럽 대회를 등록합니다' : 'Register a new championship'}</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#3a5a3a' }}>
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* 대회 유형 */}
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase block mb-2.5" style={{ color: '#3a5a3a' }}>
                  {ko ? '대회 유형' : 'EVENT TYPE'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {EVENT_TYPES.map(et => (
                    <button key={et.value} onClick={() => setForm(f => ({ ...f, eventType: et.value }))}
                      className="py-3 rounded-xl flex flex-col items-center gap-1 transition-all"
                      style={form.eventType === et.value
                        ? { background: `rgba(${et.rgb},0.16)`, border: `1.5px solid rgba(${et.rgb},0.4)`, boxShadow: `0 4px 16px rgba(${et.rgb},0.15)` }
                        : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-2xl leading-none">{et.emoji}</span>
                      <span className="text-[10px] font-semibold mt-0.5"
                        style={{ color: form.eventType === et.value ? et.color : '#3a5a3a' }}>
                        {ko ? et.ko : et.en}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Divider />

              {/* 대회명 */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase block mb-2" style={{ color: '#3a5a3a' }}>
                    {ko ? '대회명 *' : 'EVENT NAME *'}
                  </label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={
                      form.eventType === 'first_half'  ? (ko ? '2025 상반기 클럽 대회' : '2025 1st Half Championship') :
                      form.eventType === 'second_half' ? (ko ? '2025 하반기 클럽 대회' : '2025 2nd Half Championship') :
                      form.eventType === 'year_end'    ? (ko ? '2025 연말 클럽 대회'   : '2025 Year-End Championship') :
                      (ko ? '2025 창립기념 특별 대회' : '2025 Anniversary Special')
                    }
                    className="input-field" autoFocus />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase block mb-2" style={{ color: '#3a5a3a' }}>
                    {ko ? '대회명 영문 (선택)' : 'NAME (KO, OPTIONAL)'}
                  </label>
                  <input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} className="input-field" />
                </div>
              </div>

              <Divider />

              {/* 날짜 + 골프장 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase block mb-2" style={{ color: '#3a5a3a' }}>
                    {ko ? '날짜 *' : 'DATE *'}
                  </label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase block mb-2" style={{ color: '#3a5a3a' }}>
                    {ko ? '골프장' : 'VENUE'}
                  </label>
                  <CourseSearchInput value={form.venue} onChange={v => setForm(f => ({ ...f, venue: v }))} onSelect={c => setForm(f => ({ ...f, venue: c.name }))} placeholder={ko ? '골프장' : 'Course'} className="text-sm" />
                </div>
              </div>

              <Divider />

              {/* 조편성 */}
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase block mb-2.5" style={{ color: '#3a5a3a' }}>
                  {ko ? '조편성 방식' : 'GROUPING'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'auto_handicap', ko: '핸디 순', en: 'By HC',   icon: '📊' },
                    { v: 'auto_random',   ko: '랜덤',    en: 'Random',  icon: '🎲' },
                    { v: 'manual',        ko: '수동',    en: 'Manual',  icon: '✋' },
                  ].map(m => (
                    <button key={m.v} onClick={() => setForm(f => ({ ...f, groupingMethod: m.v }))}
                      className="py-2.5 rounded-xl text-xs font-semibold transition flex flex-col items-center gap-1"
                      style={form.groupingMethod === m.v
                        ? { background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80' }
                        : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#3a5a3a' }}>
                      <span className="text-base leading-none">{m.icon}</span>
                      {ko ? m.ko : m.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2.5 pb-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)', color: '#4a7a4a' }}>
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button onClick={createEvent} disabled={!form.name.trim() || !form.date}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}>
                  <Trophy size={14} /> {ko ? '대회 생성' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 역대 기록 탭 ──────────────────────────────────────────────────────────────
function RecordsTab({ allEvents, years, ko, lang, sym, clubId }: {
  allEvents: any[]; years: number[]; ko: boolean; lang: string; sym: string; clubId: string
}) {
  const [selYear,    setSelYear]    = useState(years[0])
  const [prizes,     setPrizes]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const yearEvents = allEvents.filter(e => new Date(e.date).getFullYear() === selYear)

  useEffect(() => {
    if (!clubId) return
    setLoading(true)
    const supabase = createClient()
    supabase.from('tournament_prizes')
      .select('*, users(full_name, full_name_en), tournaments!inner(id, club_id, name, name_en, date, event_type, status)')
      .eq('tournaments.club_id', clubId)
      .then(({ data }) => { setPrizes(data ?? []); setLoading(false) })
  }, [clubId])

  const getPrizesForEvent = (id: string) => prizes.filter(p => p.tournament_id === id).sort((a, b) => (a.prize_rank ?? 99) - (b.prize_rank ?? 99))
  const getChampion = (id: string) => prizes.find(p => p.tournament_id === id && p.prize_type === 'place' && p.prize_rank === 1)

  const yearChampions = (() => {
    const counts: Record<string, { name: string; wins: number }> = {}
    allEvents.filter(e => new Date(e.date).getFullYear() === selYear && e.status === 'completed').forEach(ev => {
      const champ = getChampion(ev.id)
      if (champ) {
        const n = ko ? champ.member_name : (champ.users?.full_name_en || champ.member_name)
        if (!counts[champ.member_name]) counts[champ.member_name] = { name: n, wins: 0 }
        counts[champ.member_name].wins++
      }
    })
    return Object.values(counts).sort((a, b) => b.wins - a.wins).slice(0, 3)
  })()

  return (
    <div className="px-4 space-y-4">
      {/* 연도 */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scroll-hide">
        {years.map(y => (
          <button key={y} onClick={() => setSelYear(y)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap"
            style={y === selYear
              ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 2px 10px rgba(22,163,74,0.35)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.1)', color: '#3a5a3a' }}>
            {y}{ko ? '년' : ''}
          </button>
        ))}
      </div>

      {/* 연도 챔피언 집계 */}
      {yearChampions.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(6,13,6,0.98))', border: '1px solid rgba(251,191,36,0.2)' }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(251,191,36,0.1)' }}>
            <Trophy size={13} style={{ color: '#fbbf24' }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#fbbf24' }}>
              {selYear}{ko ? '년 우승 집계' : ' CHAMPION SUMMARY'}
            </span>
          </div>
          <div className="p-3 space-y-1.5">
            {yearChampions.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(251,191,36,0.05)' }}>
                <span className="text-2xl leading-none flex-shrink-0">{MEDALS[i]?.emoji ?? '🎖'}</span>
                <span className="text-sm font-bold text-white flex-1">{c.name}</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                  {c.wins}{ko ? '회 우승' : ' win' + (c.wins > 1 ? 's' : '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 대회별 결과 */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(34,197,94,0.15)', borderTopColor: '#22c55e' }} />
        </div>
      ) : yearEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Trophy size={32} style={{ color: '#1a3a1a' }} />
          <p className="text-xs" style={{ color: '#2a4a2a' }}>{ko ? `${selYear}년 기록이 없습니다` : `No records for ${selYear}`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {yearEvents.map(ev => {
            const et       = getET(ev.event_type)
            const evPrizes = getPrizesForEvent(ev.id)
            const champ    = evPrizes.find(p => p.prize_type === 'place' && p.prize_rank === 1)
            const isOpen   = expandedId === ev.id
            return (
              <div key={ev.id} className="rounded-2xl overflow-hidden"
                style={{ background: `linear-gradient(135deg,rgba(${et.rgb},0.08),rgba(6,13,6,0.98))`, border: `1px solid rgba(${et.rgb},0.16)` }}>
                <div className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{et.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold" style={{ color: et.color }}>
                          {ko ? `${et.ko} 대회` : `${et.en} Championship`}
                        </span>
                        <span className="text-[10px]" style={{ color: '#2a4a2a' }}>
                          {new Date(ev.date).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white">{ko ? ev.name : (ev.name_en || ev.name)}</p>
                      {champ && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span>🥇</span>
                          <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>
                            {ko ? champ.member_name : (champ.users?.full_name_en || champ.member_name)}
                          </span>
                          {champ.net_score && <span className="text-[11px]" style={{ color: '#5a7a5a' }}>· net {champ.net_score}</span>}
                        </div>
                      )}
                      {!champ && ev.status !== 'completed' && (
                        <span className="text-[11px] mt-1 inline-block" style={{ color: '#3a5a3a' }}>
                          {ev.status === 'upcoming' ? (ko ? '대회 예정' : 'Upcoming') : (ko ? '진행중' : 'In progress')}
                        </span>
                      )}
                    </div>
                    {evPrizes.length > 1 && (
                      <button onClick={() => setExpandedId(isOpen ? null : ev.id)}
                        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition"
                        style={{ background: `rgba(${et.rgb},0.1)`, color: et.color }}>
                        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && evPrizes.length > 0 && (
                  <div className="px-4 pb-4 space-y-1.5" style={{ borderTop: `1px solid rgba(${et.rgb},0.12)` }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase mt-3 mb-2" style={{ color: et.color }}>
                      {ko ? '전체 시상' : 'FULL RESULTS'}
                    </p>
                    {evPrizes.map(p => {
                      const pt = getPT(p.prize_type)
                      const medalIdx = p.prize_type === 'place' ? (p.prize_rank ?? 4) - 1 : -1
                      return (
                        <div key={p.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                          style={{ background: 'rgba(0,0,0,0.25)' }}>
                          <span className="text-lg leading-none flex-shrink-0">
                            {medalIdx >= 0 && medalIdx < 3 ? MEDALS[medalIdx].emoji : pt.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                style={{ background: `rgba(${et.rgb},0.1)`, color: et.color }}>
                                {ko ? pt.ko : pt.en}{p.prize_type === 'place' && p.prize_rank ? ` ${p.prize_rank}위` : ''}
                              </span>
                              <span className="text-sm font-bold text-white">
                                {ko ? p.member_name : (p.users?.full_name_en || p.member_name)}
                              </span>
                            </div>
                            {p.prize_description && <p className="text-[11px] mt-0.5" style={{ color: '#fde68a' }}>{p.prize_description}</p>}
                          </div>
                          {(p.net_score || p.gross_score) && (
                            <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: '#5a7a5a' }}>
                              {p.net_score ? `net ${p.net_score}` : `${p.gross_score}`}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
