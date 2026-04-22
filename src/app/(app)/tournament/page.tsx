'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Trophy, Plus, Camera, Users, ChevronLeft, Star,
  ChevronDown, ChevronUp, Gift, Award, MapPin,
  Calendar, X, Save, Trash2,
} from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'

// ── 대회 유형 정의 ──────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { value: 'first_half',  emoji: '🌸', ko: '상반기 대회', en: '1st Half Championship', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)'  },
  { value: 'second_half', emoji: '🍂', ko: '하반기 대회', en: '2nd Half Championship', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.25)'  },
  { value: 'year_end',    emoji: '🏆', ko: '연말 대회',   en: 'Year-End Championship', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.28)'  },
  { value: 'special',     emoji: '⭐', ko: '특별 대회',   en: 'Special Event',         color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
]
const getET = (v: string) => EVENT_TYPES.find(t => t.value === v) ?? EVENT_TYPES[3]

// 상품 유형
const PRIZE_TYPES = [
  { value: 'place',         ko: '순위상',        en: 'Place Award'      },
  { value: 'nearest_pin',   ko: '니어리스트',     en: 'Nearest Pin'      },
  { value: 'longest_drive', ko: '롱기스트 드라이브', en: 'Longest Drive'  },
  { value: 'best_gross',    ko: '베스트 그로스',  en: 'Best Gross'       },
  { value: 'most_improved', ko: '최다 향상',      en: 'Most Improved'    },
  { value: 'special',       ko: '특별상',         en: 'Special Award'    },
]
const getPT = (v: string) => PRIZE_TYPES.find(t => t.value === v) ?? PRIZE_TYPES[0]

const MEDAL_BG = ['#f59e0b','#9ca3af','#b45309','rgba(31,41,55,0.8)']
const MEDAL_TC = ['#000','#000','#fff','#9ca3af']
const MEDAL_EMOJI = ['🥇','🥈','🥉','']

const CURRENCY_SYM: Record<string,string> = { KRW:'₩', VND:'₫', IDR:'Rp' }

interface Tournament {
  id: string; name: string; name_en?: string; event_type: string
  date: string; venue?: string; status: string
  is_official: boolean; grouping_method: string
}

export default function ChampionshipPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const canManage = OFFICER_ROLES.includes(myRole)

  const thisYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(thisYear)
  const [tab,          setTab]          = useState<'list' | 'records'>('list')
  const [view,         setView]         = useState<'list' | 'detail'>('list')

  const [events,       setEvents]       = useState<Tournament[]>([])
  const [allEvents,    setAllEvents]    = useState<Tournament[]>([])   // for records tab
  const [selectedEvent,setSelectedEvent]= useState<Tournament | null>(null)
  const [groups,       setGroups]       = useState<any[]>([])
  const [prizes,       setPrizes]       = useState<any[]>([])
  const [members,      setMembers]      = useState<any[]>([])
  const [currency,     setCurrency]     = useState('KRW')
  const [loading,      setLoading]      = useState(true)
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [showPrizePanel,setShowPrizePanel]= useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── 대회 생성 폼 ───────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const emptyForm = {
    name: '', nameEn: '', date: '', venue: '',
    eventType: 'special', groupingMethod: 'auto_handicap',
  }
  const [form, setForm] = useState(emptyForm)

  // ── 상품 등록 폼 ───────────────────────────────────────────────────────
  const emptyPrize = {
    prize_rank: 1, prize_type: 'place',
    user_id: '', member_name: '',
    gross_score: '', net_score: '',
    prize_description: '',
  }
  const [prizeForm, setPrizeForm] = useState(emptyPrize)

  // ── 연도 목록 ──────────────────────────────────────────────────────────
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i)

  // ── 로드 ───────────────────────────────────────────────────────────────
  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: evs }, { data: mems }, { data: club }] = await Promise.all([
      supabase.from('tournaments')
        .select('*').eq('club_id', currentClubId)
        .order('date', { ascending: false }),
      supabase.from('club_memberships')
        .select('user_id, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
    ])
    setAllEvents(evs ?? [])
    setMembers(mems ?? [])
    if (club?.currency) setCurrency(club.currency)
    setLoading(false)
  }

  // 연도별 필터
  useEffect(() => {
    setEvents(allEvents.filter(e => new Date(e.date).getFullYear() === selectedYear))
  }, [allEvents, selectedYear])

  useEffect(() => { load() }, [currentClubId])

  async function loadEventDetail(ev: Tournament) {
    setSelectedEvent(ev)
    setView('detail')
    const supabase = createClient()
    const [{ data: grps }, { data: prz }] = await Promise.all([
      supabase.from('tournament_groups')
        .select('*, tournament_group_members(*, users(full_name, full_name_en, name_abbr))')
        .eq('tournament_id', ev.id).order('group_number'),
      supabase.from('tournament_prizes')
        .select('*, users(full_name, full_name_en)')
        .eq('tournament_id', ev.id).order('prize_rank'),
    ])
    setGroups(grps ?? [])
    setPrizes(prz ?? [])
  }

  // ── 대회 생성 ──────────────────────────────────────────────────────────
  async function createEvent() {
    if (!form.name || !form.date || !currentClubId) return
    const supabase = createClient()
    const { data } = await supabase.from('tournaments').insert({
      club_id: currentClubId, name: form.name, name_en: form.nameEn || null,
      date: form.date, venue: form.venue || null,
      event_type: form.eventType, is_official: true,
      grouping_method: form.groupingMethod, created_by: user!.id,
      status: 'upcoming',
    }).select().single()
    setShowCreate(false); setForm(emptyForm)
    if (data && form.groupingMethod !== 'manual') await autoGroup(data.id, form.groupingMethod)
    load()
  }

  // ── 자동 조편성 ────────────────────────────────────────────────────────
  async function autoGroup(tournamentId: string, method: string) {
    const supabase = createClient()
    const { data: mems } = await supabase.from('club_memberships')
      .select('user_id, club_handicap').eq('club_id', currentClubId).eq('status', 'approved')
    if (!mems?.length) return
    let sorted = [...mems]
    if (method === 'auto_handicap') sorted.sort((a, b) => (a.club_handicap ?? 99) - (b.club_handicap ?? 99))
    else sorted.sort(() => Math.random() - 0.5)
    const groupSize = 4
    for (let g = 0; g < Math.ceil(sorted.length / groupSize); g++) {
      const { data: grp } = await supabase.from('tournament_groups')
        .insert({ tournament_id: tournamentId, group_number: g + 1 }).select().single()
      if (!grp) continue
      await supabase.from('tournament_group_members').insert(
        sorted.slice(g * groupSize, (g + 1) * groupSize)
          .map(m => ({ group_id: grp.id, user_id: m.user_id, handicap_used: m.club_handicap }))
      )
    }
  }

  // ── 스코어 업데이트 ────────────────────────────────────────────────────
  async function updateScore(memberId: string, score: number, hc: number) {
    const supabase = createClient()
    await supabase.from('tournament_group_members')
      .update({ score, net_score: score - hc }).eq('id', memberId)
    if (selectedEvent) loadEventDetail(selectedEvent)
  }

  // ── 스코어카드 OCR ─────────────────────────────────────────────────────
  async function handleScorecardScan(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedEvent) return
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const res = await fetch('/api/ocr/scorecard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, members: members.map((m: any) => ({ ...m.users, user_id: m.user_id })), lang }),
      })
      const data = await res.json()
      const supabase = createClient()
      const allGMs = groups.flatMap(g => g.tournament_group_members)
      for (const s of (data.scores ?? [])) {
        if (s.user_id && s.score) {
          const gm = allGMs.find((m: any) => m.user_id === s.user_id)
          if (gm) await supabase.from('tournament_group_members')
            .update({ score: s.score, net_score: s.score - (gm.handicap_used ?? 0) }).eq('id', gm.id)
        }
      }
      loadEventDetail(selectedEvent)
      setOcrLoading(false)
    }
    reader.readAsDataURL(file)
  }

  // ── 상품 등록 ──────────────────────────────────────────────────────────
  async function savePrize() {
    if (!selectedEvent || !prizeForm.member_name) return
    const supabase = createClient()
    const memberName = prizeForm.user_id
      ? (members.find(m => m.user_id === prizeForm.user_id)?.users?.full_name ?? prizeForm.member_name)
      : prizeForm.member_name
    const { data } = await supabase.from('tournament_prizes').insert({
      tournament_id:     selectedEvent.id,
      prize_rank:        prizeForm.prize_type === 'place' ? prizeForm.prize_rank : null,
      prize_type:        prizeForm.prize_type,
      user_id:           prizeForm.user_id || null,
      member_name:       memberName,
      gross_score:       prizeForm.gross_score ? parseInt(prizeForm.gross_score) : null,
      net_score:         prizeForm.net_score   ? parseInt(prizeForm.net_score)   : null,
      prize_description: prizeForm.prize_description.trim() || null,
      created_by:        user!.id,
    }).select().single()
    if (data) setPrizes(p => [...p, data].sort((a, b) => (a.prize_rank ?? 99) - (b.prize_rank ?? 99)))
    setPrizeForm(emptyPrize)

    // 1위 등록시 대회 status → completed
    if (prizeForm.prize_type === 'place' && prizeForm.prize_rank === 1) {
      await supabase.from('tournaments').update({ status: 'completed' }).eq('id', selectedEvent.id)
      load()
    }
  }

  async function deletePrize(id: string) {
    await createClient().from('tournament_prizes').delete().eq('id', id)
    setPrizes(p => p.filter(x => x.id !== id))
  }

  // ── 순위 계산 (스코어 기준) ─────────────────────────────────────────────
  function calcRanking() {
    const all = groups.flatMap(g => g.tournament_group_members ?? [])
    const scored = all.filter(m => m.net_score != null || m.score != null)
    return scored
      .sort((a, b) => (a.net_score ?? a.score ?? 999) - (b.net_score ?? b.score ?? 999))
      .slice(0, 10)
  }

  // ── 역대 기록에서 이벤트의 1위 가져오기 ────────────────────────────────
  async function loadAllPrizesForRecords() {
    if (!currentClubId) return
    const supabase = createClient()
    const { data } = await supabase.from('tournament_prizes')
      .select('*, tournaments!inner(club_id, name, name_en, date, event_type, status)')
      .eq('tournaments.club_id', currentClubId)
      .eq('prize_type', 'place').eq('prize_rank', 1)
    return data ?? []
  }

  const sym = CURRENCY_SYM[currency] ?? '₩'

  const statusLabel = (s: string) => ({ upcoming: ['예정','Upcoming'], ongoing: ['진행중','Ongoing'], completed: ['완료','Completed'] }[s] ?? ['—','—'])[ko ? 0 : 1]
  const statusColor = (s: string) => ({ upcoming: '#60a5fa', ongoing: '#fbbf24', completed: '#22c55e' }[s] ?? '#5a7a5a')

  // ── 렌더 ───────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">

      {/* ── 헤더 ── */}
      {view === 'detail' && selectedEvent ? (
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setSelectedEvent(null); setShowPrizePanel(false) }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              {ko ? selectedEvent.name : (selectedEvent.name_en || selectedEvent.name)}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {(() => { const et = getET(selectedEvent.event_type); return (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: et.bg, color: et.color, border: `1px solid ${et.border}` }}>
                  {et.emoji} {ko ? et.ko : et.en}
                </span>
              )})()}
              <span className="text-xs" style={{ color: statusColor(selectedEvent.status) }}>
                {statusLabel(selectedEvent.status)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              {ko ? '🏌️ 클럽 대회' : '🏌️ Club Championship'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#5a7a5a' }}>
              {ko ? '상반기 · 하반기 · 연말 · 특별 대회 기록' : 'Semi-annual · Year-end · Special events'}
            </p>
          </div>
          {canManage && view === 'list' && tab === 'list' && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-xl"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
              <Plus size={15} /> {ko ? '대회 생성' : 'New Event'}
            </button>
          )}
        </div>
      )}

      {/* ── 탭 (list/records) — 상세 보기에서는 숨김 ── */}
      {view === 'list' && (
        <div className="flex gap-1.5 p-1 rounded-2xl"
          style={{ background: 'rgba(6,13,6,0.8)', border: '1px solid rgba(34,197,94,0.1)' }}>
          {([['list', ko ? '🏆 대회 목록' : '🏆 Events'], ['records', ko ? '📜 역대 기록' : '📜 Records']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition"
              style={tab === t
                ? { background: 'linear-gradient(135deg,rgba(22,163,74,0.28),rgba(14,53,29,0.6))', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }
                : { color: '#5a7a5a' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
        </div>

      ) : view === 'detail' && selectedEvent ? (
        /* ══════════════════════════════════════════════════════════════
             대회 상세 뷰
        ══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {/* 대회 정보 카드 */}
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: (() => { const et=getET(selectedEvent.event_type); return `linear-gradient(135deg,${et.bg},rgba(6,13,6,0.97))` })(),
              border: `1px solid ${getET(selectedEvent.event_type).border}` }}>
            <div className="flex items-center gap-2">
              <Calendar size={13} style={{ color: getET(selectedEvent.event_type).color }} />
              <span className="text-sm text-white">{new Date(selectedEvent.date).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { year:'numeric', month:'long', day:'numeric', weekday:'short' })}</span>
            </div>
            {selectedEvent.venue && (
              <div className="flex items-center gap-2">
                <MapPin size={13} style={{ color: getET(selectedEvent.event_type).color }} />
                <span className="text-sm" style={{ color: '#c0d0c0' }}>{selectedEvent.venue}</span>
              </div>
            )}
          </div>

          {/* 스코어 입력 버튼 (임원) */}
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={ocrLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                <Camera size={15} />
                {ocrLoading ? (ko ? '분석 중...' : 'Scanning...') : (ko ? '스코어카드 촬영' : 'Scan Scorecard')}
              </button>
              <button onClick={() => setShowPrizePanel(v => !v)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: showPrizePanel ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                <Gift size={15} />
                {ko ? '상품 등록' : 'Prizes'}
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScorecardScan} />

          {/* ── 순위표 (스코어 있으면 표시) ── */}
          {calcRanking().length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#22c55e' }}>
                {ko ? '📊 현재 순위 (넷 스코어 기준)' : '📊 Current Rankings (Net Score)'}
              </p>
              <div className="space-y-2">
                {calcRanking().map((m, i) => {
                  const name = ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{ background: i < 3 ? `rgba(${i===0?'251,191,36':i===1?'156,163,175':'180,83,9'},0.1)` : 'rgba(255,255,255,0.02)' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: MEDAL_BG[Math.min(i,3)], color: MEDAL_TC[Math.min(i,3)] }}>
                        {MEDAL_EMOJI[i] || i + 1}
                      </div>
                      <span className="text-white text-sm flex-1 truncate">{name}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold" style={{ color: i===0?'#fbbf24':i===1?'#9ca3af':i===2?'#b45309':'#a3b8a3' }}>
                          {m.net_score ?? m.score}
                        </span>
                        {m.handicap_used != null && (
                          <span className="text-xs ml-1.5" style={{ color: '#5a7a5a' }}>HC{m.handicap_used}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 상품/시상 ── */}
          {prizes.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(6,13,6,0.97))', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#fbbf24' }}>
                🎖 {ko ? '시상 결과' : 'Prize Results'}
              </p>
              {prizes.map((p, i) => {
                const pt = getPT(p.prize_type)
                const memberName = ko ? p.users?.full_name ?? p.member_name : (p.users?.full_name_en || p.users?.full_name || p.member_name)
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)' }}>
                    {p.prize_type === 'place' && p.prize_rank <= 3 ? (
                      <span className="text-xl flex-shrink-0">{MEDAL_EMOJI[p.prize_rank - 1]}</span>
                    ) : (
                      <Award size={18} style={{ color: '#fbbf24' }} className="flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                          {ko ? pt.ko : pt.en}
                          {p.prize_type === 'place' && p.prize_rank ? ` ${p.prize_rank}위` : ''}
                        </span>
                        <span className="text-white text-sm font-semibold">{memberName}</span>
                      </div>
                      {(p.gross_score || p.net_score) && (
                        <p className="text-xs mt-0.5" style={{ color: '#a3b8a3' }}>
                          {p.gross_score && `그로스 ${p.gross_score}`}
                          {p.gross_score && p.net_score && ' · '}
                          {p.net_score && `넷 ${p.net_score}`}
                        </p>
                      )}
                      {p.prize_description && (
                        <p className="text-xs mt-0.5 font-medium" style={{ color: '#fde68a' }}>{p.prize_description}</p>
                      )}
                    </div>
                    {canManage && (
                      <button onClick={() => deletePrize(p.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 상품 등록 패널 ── */}
          {canManage && showPrizePanel && (
            <div className="rounded-2xl p-4 space-y-3"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                {ko ? '+ 시상 등록' : '+ Add Prize'}
              </p>
              {/* 상품 유형 */}
              <div className="grid grid-cols-3 gap-1.5">
                {PRIZE_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => setPrizeForm(f => ({ ...f, prize_type: pt.value }))}
                    className="py-1.5 rounded-lg text-xs font-medium transition"
                    style={prizeForm.prize_type === pt.value
                      ? { background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#5a7a5a' }}>
                    {ko ? pt.ko : pt.en}
                  </button>
                ))}
              </div>
              {/* 순위 (place 유형만) */}
              {prizeForm.prize_type === 'place' && (
                <div className="flex gap-2">
                  {[1,2,3].map(r => (
                    <button key={r} onClick={() => setPrizeForm(f => ({ ...f, prize_rank: r }))}
                      className="flex-1 py-2 rounded-xl text-sm font-bold transition"
                      style={prizeForm.prize_rank === r
                        ? { background: MEDAL_BG[r-1], color: MEDAL_TC[r-1] }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#5a7a5a' }}>
                      {MEDAL_EMOJI[r-1]} {r}{ko ? '위' : 'st/nd/rd'[r-1] ?? ''}
                    </button>
                  ))}
                </div>
              )}
              {/* 회원 선택 */}
              <select value={prizeForm.user_id}
                onChange={e => setPrizeForm(f => ({ ...f, user_id: e.target.value, member_name: '' }))}
                className="input-field text-sm">
                <option value="">{ko ? '— 회원 선택 —' : '— Select member —'}</option>
                {members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>
                    {ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                  </option>
                ))}
              </select>
              {!prizeForm.user_id && (
                <input value={prizeForm.member_name}
                  onChange={e => setPrizeForm(f => ({ ...f, member_name: e.target.value }))}
                  placeholder={ko ? '이름 직접 입력' : 'Type name directly'}
                  className="input-field text-sm" />
              )}
              {/* 스코어 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#5a7a5a' }}>{ko ? '그로스 스코어' : 'Gross'}</label>
                  <input type="number" value={prizeForm.gross_score}
                    onChange={e => setPrizeForm(f => ({ ...f, gross_score: e.target.value }))}
                    placeholder="78" className="input-field text-sm" />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#5a7a5a' }}>{ko ? '넷 스코어' : 'Net'}</label>
                  <input type="number" value={prizeForm.net_score}
                    onChange={e => setPrizeForm(f => ({ ...f, net_score: e.target.value }))}
                    placeholder="66" className="input-field text-sm" />
                </div>
              </div>
              {/* 상품 내용 */}
              <input value={prizeForm.prize_description}
                onChange={e => setPrizeForm(f => ({ ...f, prize_description: e.target.value }))}
                placeholder={ko ? '예: 트로피 + ₫2,000,000 / 캐디백 1점' : 'e.g. Trophy + ₫2,000,000 / Golf bag'}
                className="input-field text-sm" />
              <div className="flex gap-2">
                <button onClick={() => { setShowPrizePanel(false); setPrizeForm(emptyPrize) }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', color: '#86efac' }}>
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button onClick={savePrize} disabled={!prizeForm.member_name && !prizeForm.user_id}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.8),rgba(217,119,6,0.9))', color: '#000' }}>
                  <Save size={13} /> {ko ? '등록' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* ── 조편성 & 스코어 ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#5a7a5a' }}>
              {ko ? '조 편성 및 스코어' : 'Groups & Scores'}
            </p>
            <div className="space-y-3">
              {groups.map(g => (
                <div key={g.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} style={{ color: '#22c55e' }} />
                    <span className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                      {ko ? `${g.group_number}조` : `Group ${g.group_number}`}
                    </span>
                    {g.tee_time && <span className="text-xs ml-1" style={{ color: '#5a7a5a' }}>{g.tee_time}</span>}
                  </div>
                  <div className="space-y-2">
                    {g.tournament_group_members?.map((m: any) => {
                      const name = ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)
                      return (
                        <div key={m.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <span className="text-white text-sm flex-1 truncate">{name}</span>
                          {m.handicap_used != null && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                              HC {m.handicap_used}
                            </span>
                          )}
                          {canManage ? (
                            <div className="flex items-center gap-1.5">
                              <input type="number" defaultValue={m.score ?? ''}
                                onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) updateScore(m.id, v, m.handicap_used ?? 0) }}
                                className="w-16 rounded-lg text-center text-sm text-white font-bold py-1.5"
                                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                                placeholder="—" />
                              {m.net_score != null && (
                                <span className="text-xs w-10 text-center" style={{ color: '#a3b8a3' }}>
                                  net {m.net_score}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm font-bold w-12 text-right" style={{ color: '#22c55e' }}>
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
                <div className="glass-card rounded-xl py-8 text-center" style={{ color: '#3a5a3a' }}>
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{ko ? '조편성이 없습니다' : 'No groups formed'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      ) : tab === 'list' ? (
        /* ══════════════════════════════════════════════════════════════
             대회 목록 탭
        ══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {/* 연도 선택 */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {years.map(y => (
              <button key={y} onClick={() => setSelectedYear(y)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition"
                style={y === selectedYear
                  ? { background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,197,94,0.12)', color: '#5a7a5a' }}>
                {y}{ko ? '년' : ''}
              </button>
            ))}
          </div>

          {/* 이벤트 유형 범례 */}
          <div className="flex gap-2 flex-wrap">
            {EVENT_TYPES.map(et => (
              <span key={et.value} className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: et.bg, color: et.color, border: `1px solid ${et.border}` }}>
                {et.emoji} {ko ? et.ko : et.en}
              </span>
            ))}
          </div>

          {/* 대회 목록 */}
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
              <Trophy size={44} className="mb-3 opacity-30" />
              <p className="text-sm">{ko ? `${selectedYear}년 등록된 대회가 없습니다` : `No events in ${selectedYear}`}</p>
              {canManage && (
                <button onClick={() => setShowCreate(true)} className="mt-4 text-sm" style={{ color: '#22c55e' }}>
                  {ko ? '첫 대회 생성하기' : 'Create first event'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const et = getET(ev.event_type)
                return (
                  <button key={ev.id} onClick={() => loadEventDetail(ev)}
                    className="w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg,${et.bg},rgba(6,13,6,0.96))`, border: `1px solid ${et.border}` }}>
                    <div className="flex items-start gap-3">
                      <span className="text-3xl leading-none flex-shrink-0 mt-0.5">{et.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: et.bg, color: et.color, border: `1px solid ${et.border}` }}>
                            {ko ? et.ko : et.en}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.3)', color: statusColor(ev.status) }}>
                            {statusLabel(ev.status)}
                          </span>
                        </div>
                        <p className="text-white font-bold text-base mt-1.5">
                          {ko ? ev.name : (ev.name_en || ev.name)}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar size={11} style={{ color: '#5a7a5a' }} />
                            <span className="text-xs" style={{ color: '#a3b8a3' }}>
                              {new Date(ev.date).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month:'short', day:'numeric', weekday:'short' })}
                            </span>
                          </div>
                          {ev.venue && (
                            <div className="flex items-center gap-1">
                              <MapPin size={11} style={{ color: '#5a7a5a' }} />
                              <span className="text-xs truncate max-w-[120px]" style={{ color: '#a3b8a3' }}>{ev.venue}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: et.bg, color: et.color }}>
                        <Star size={14} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

      ) : (
        /* ══════════════════════════════════════════════════════════════
             역대 기록 탭
        ══════════════════════════════════════════════════════════════ */
        <RecordsTab
          allEvents={allEvents} years={years} ko={ko} lang={lang}
          sym={sym} clubId={currentClubId!} />
      )}

      {/* ════ 대회 생성 모달 ════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 flex items-end z-[200]" style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={() => setShowCreate(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 animate-slide-up overflow-y-auto"
            style={{ background: '#0a140a', border: '1px solid rgba(34,197,94,0.2)', borderBottom: 'none', maxHeight: '92dvh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center -mt-1"><div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} /></div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">🏆 {ko ? '대회 생성' : 'Create Event'}</h3>
              <button onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#5a7a5a' }}>
                <X size={16} />
              </button>
            </div>

            {/* 대회 유형 */}
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: '#5a7a5a' }}>
                {ko ? '대회 유형 *' : 'Event Type *'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_TYPES.map(et => (
                  <button key={et.value} onClick={() => setForm(f => ({ ...f, eventType: et.value }))}
                    className="py-3 rounded-xl flex flex-col items-center gap-1.5 text-sm font-medium transition"
                    style={form.eventType === et.value
                      ? { background: et.bg, border: `1.5px solid ${et.border}`, color: et.color }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#5a7a5a' }}>
                    <span className="text-2xl">{et.emoji}</span>
                    <span className="text-xs">{ko ? et.ko : et.en}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 대회명 */}
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                {ko ? '대회명 *' : 'Event Name *'}
              </label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={
                  form.eventType === 'first_half'  ? (ko ? '예: 2025 상반기 클럽 대회'  : '2025 1st Half Championship') :
                  form.eventType === 'second_half' ? (ko ? '예: 2025 하반기 클럽 대회'  : '2025 2nd Half Championship') :
                  form.eventType === 'year_end'    ? (ko ? '예: 2025 연말 클럽 대회'    : '2025 Year-End Championship') :
                  ko ? '예: 2025 창립기념 특별 대회' : '2025 Anniversary Special'
                }
                className="input-field" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                {ko ? '대회명 (영문, 선택)' : 'Name (Korean, optional)'}
              </label>
              <input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                className="input-field" />
            </div>

            {/* 날짜 + 장소 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '날짜 *' : 'Date *'}</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '골프장' : 'Venue'}</label>
                <input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder={ko ? '골프장명' : 'Course name'} className="input-field" />
              </div>
            </div>

            {/* 조편성 방식 */}
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                {ko ? '조편성 방식' : 'Grouping Method'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'auto_handicap', ko: '핸디 순', en: 'By HC' },
                  { v: 'auto_random',   ko: '랜덤',    en: 'Random' },
                  { v: 'manual',        ko: '수동',    en: 'Manual' },
                ].map(m => (
                  <button key={m.v} onClick={() => setForm(f => ({ ...f, groupingMethod: m.v }))}
                    className="py-2 rounded-xl text-xs font-medium transition"
                    style={form.groupingMethod === m.v
                      ? { background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#5a7a5a' }}>
                    {ko ? m.ko : m.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pb-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.12)', color: '#86efac' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={createEvent} disabled={!form.name.trim() || !form.date}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold btn-primary disabled:opacity-50">
                {ko ? '대회 생성' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 역대 기록 탭 컴포넌트 ─────────────────────────────────────────────────
function RecordsTab({ allEvents, years, ko, lang, sym, clubId }: {
  allEvents: any[]; years: number[]; ko: boolean; lang: string; sym: string; clubId: string
}) {
  const [selYear,     setSelYear]     = useState(years[0])
  const [prizes,      setPrizes]      = useState<any[]>([])
  const [loading,     setLoading]     = useState(false)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

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

  function getPrizesForEvent(eventId: string) {
    return prizes.filter(p => p.tournament_id === eventId)
      .sort((a, b) => (a.prize_rank ?? 99) - (b.prize_rank ?? 99))
  }

  function getChampion(eventId: string) {
    return prizes.find(p => p.tournament_id === eventId && p.prize_type === 'place' && p.prize_rank === 1)
  }

  // 연도별 챔피언 집계 (1위 가장 많은 사람)
  const yearChampions = (() => {
    const yEvs = allEvents.filter(e => new Date(e.date).getFullYear() === selYear && e.status === 'completed')
    const counts: Record<string, { name: string; wins: number }> = {}
    yEvs.forEach(ev => {
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
    <div className="space-y-4">
      {/* 연도 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {years.map(y => (
          <button key={y} onClick={() => setSelYear(y)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={y === selYear
              ? { background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,197,94,0.12)', color: '#5a7a5a' }}>
            {y}{ko ? '년' : ''}
          </button>
        ))}
      </div>

      {/* 연도 챔피언 요약 */}
      {yearChampions.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(6,13,6,0.97))', border: '1px solid rgba(251,191,36,0.25)' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: '#fbbf24' }}>
            🏆 {selYear}{ko ? '년 우승 집계' : ' Championship Summary'}
          </p>
          <div className="space-y-2">
            {yearChampions.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ background: 'rgba(251,191,36,0.06)' }}>
                <span className="text-xl flex-shrink-0">{MEDAL_EMOJI[i] || '🎖'}</span>
                <span className="text-white font-semibold text-sm flex-1">{c.name}</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                  {c.wins}{ko ? '회 우승' : ' wins'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 대회별 결과 */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
        </div>
      ) : yearEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12" style={{ color: '#3a5a3a' }}>
          <Trophy size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{ko ? `${selYear}년 대회 기록이 없습니다` : `No records for ${selYear}`}</p>
        </div>
      ) : yearEvents.map(ev => {
        const et       = getET(ev.event_type)
        const evPrizes = getPrizesForEvent(ev.id)
        const champ    = evPrizes.find(p => p.prize_type === 'place' && p.prize_rank === 1)
        const isOpen   = expandedId === ev.id
        return (
          <div key={ev.id} className="rounded-2xl overflow-hidden"
            style={{ background: `linear-gradient(135deg,${et.bg},rgba(6,13,6,0.97))`, border: `1px solid ${et.border}` }}>
            {/* 이벤트 헤더 */}
            <div className="px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <span className="text-2xl leading-none flex-shrink-0">{et.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{ko ? ev.name : (ev.name_en || ev.name)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: '#a3b8a3' }}>
                      {new Date(ev.date).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { year:'numeric', month:'short', day:'numeric' })}
                    </span>
                    {ev.venue && <span className="text-xs" style={{ color: '#5a7a5a' }}>· {ev.venue}</span>}
                  </div>
                  {/* 챔피언 한 줄 표시 */}
                  {champ && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-base">🥇</span>
                      <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>
                        {ko ? champ.member_name : (champ.users?.full_name_en || champ.member_name)}
                      </span>
                      {champ.net_score && (
                        <span className="text-xs" style={{ color: '#a3b8a3' }}>
                          net {champ.net_score}
                        </span>
                      )}
                      {champ.prize_description && (
                        <span className="text-xs" style={{ color: '#fde68a' }}> · {champ.prize_description}</span>
                      )}
                    </div>
                  )}
                  {!champ && ev.status !== 'completed' && (
                    <span className="text-xs mt-1 inline-block" style={{ color: '#5a7a5a' }}>
                      {ev.status === 'upcoming' ? (ko ? '예정' : 'Upcoming') : (ko ? '진행중 / 결과 미입력' : 'In progress')}
                    </span>
                  )}
                </div>
                {evPrizes.length > 1 && (
                  <button onClick={() => setExpandedId(isOpen ? null : ev.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#5a7a5a' }}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            </div>

            {/* 전체 시상 (펼쳤을 때) */}
            {isOpen && evPrizes.length > 0 && (
              <div className="px-4 pb-4 space-y-1.5" style={{ borderTop: `1px solid ${et.border}` }}>
                <p className="text-xs font-semibold mt-3 mb-2" style={{ color: et.color }}>
                  🎖 {ko ? '전체 시상 내역' : 'Full Prize Results'}
                </p>
                {evPrizes.map(p => {
                  const pt = getPT(p.prize_type)
                  const pName = ko ? p.member_name : (p.users?.full_name_en || p.member_name)
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                      style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <span className="text-lg flex-shrink-0">
                        {p.prize_type === 'place' && p.prize_rank <= 3 ? MEDAL_EMOJI[p.prize_rank-1] : '🎖'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ background: et.bg, color: et.color }}>
                            {ko ? pt.ko : pt.en}
                            {p.prize_type === 'place' && p.prize_rank ? ` ${p.prize_rank}위` : ''}
                          </span>
                          <span className="text-white text-sm font-semibold">{pName}</span>
                        </div>
                        {p.prize_description && (
                          <p className="text-xs mt-0.5" style={{ color: '#fde68a' }}>{p.prize_description}</p>
                        )}
                      </div>
                      {(p.net_score || p.gross_score) && (
                        <span className="text-xs flex-shrink-0" style={{ color: '#a3b8a3' }}>
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
  )
}
