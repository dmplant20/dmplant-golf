'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  ChevronLeft, Plus, Trash2, Save, X,
  Flag, BarChart2, Calendar, MapPin, ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── 기본 파 배열 ──────────────────────────────────────────────────────────
// 72파 기준: OUT 36, IN 36
const DEFAULT_PARS_18 = [4,4,3,5,4,3,4,5,4, 4,3,5,4,4,3,5,4,4]
const DEFAULT_PARS_9  = [4,4,3,5,4,3,4,5,4]

function computePars(totalPar: number, holes: number): number[] {
  const base = holes === 9 ? [...DEFAULT_PARS_9] : [...DEFAULT_PARS_18]
  const baseSum = base.reduce((a, b) => a + b, 0)
  const diff = totalPar - baseSum
  // diff 만큼 파 5 → 4 또는 파 4 → 5 조정
  const result = [...base]
  if (diff > 0) {
    let d = diff
    for (let i = 0; i < result.length && d > 0; i++) {
      if (result[i] < 5) { result[i]++; d-- }
    }
  } else if (diff < 0) {
    let d = -diff
    for (let i = result.length - 1; i >= 0 && d > 0; i--) {
      if (result[i] > 3) { result[i]--; d-- }
    }
  }
  return result
}

// ── 스코어 색상 ───────────────────────────────────────────────────────────
function scoreColor(score: number | null, par: number): string {
  if (score === null) return 'text-gray-500 bg-gray-800'
  const d = score - par
  if (d <= -2) return 'text-yellow-200 bg-indigo-700'  // eagle+
  if (d === -1) return 'text-white bg-blue-600'          // birdie
  if (d === 0)  return 'text-white bg-green-700'         // par
  if (d === 1)  return 'text-white bg-yellow-600'        // bogey
  if (d === 2)  return 'text-white bg-orange-600'        // double
  return 'text-white bg-red-700'                         // triple+
}

function scoreLabel(score: number | null, par: number, ko: boolean): string {
  if (score === null) return ''
  const d = score - par
  if (d <= -2) return ko ? '이글+' : 'Eagle+'
  if (d === -1) return ko ? '버디' : 'Birdie'
  if (d === 0)  return ko ? '파' : 'Par'
  if (d === 1)  return ko ? '보기' : 'Bogey'
  if (d === 2)  return ko ? '더블' : 'Dbl'
  return ko ? '트리플+' : 'Tri+'
}

// ── 통계 계산 ─────────────────────────────────────────────────────────────
function calcStats(rounds: any[]) {
  if (!rounds.length) return null
  const completed = rounds.filter(r => r.total_score)
  if (!completed.length) return null
  const scores = completed.map(r => r.total_score)
  return {
    count: rounds.length,
    best:  Math.min(...scores),
    avg:   Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    latest: completed[0]?.total_score,
    latestPar: completed[0]?.course_par,
  }
}

// ─────────────────────────────────────────────────────────────────────────
export default function ScorecardPage() {
  const router = useRouter()
  const { user, lang } = useAuthStore()
  const ko = lang === 'ko'

  // ── views: 'list' | 'card' ────────────────────────────────────────────
  const [view,           setView]           = useState<'list'|'card'>('list')
  const [rounds,         setRounds]         = useState<any[]>([])
  const [selectedRound,  setSelectedRound]  = useState<any>(null)
  const [holeRows,       setHoleRows]       = useState<any[]>([]) // loaded hole data
  const [loading,        setLoading]        = useState(true)

  // ── new round sheet ───────────────────────────────────────────────────
  const [showNew,      setShowNew]      = useState(false)
  const [courses,      setCourses]      = useState<any[]>([])
  const [courseSearch, setCourseSearch] = useState('')
  const [newForm,      setNewForm]      = useState({
    courseName: '', courseId: '', coursePar: 72, holes: 18,
    playedAt: new Date().toISOString().split('T')[0], notes: '',
  })
  const [pars, setPars] = useState<number[]>(DEFAULT_PARS_18)
  const [creating,     setCreating]     = useState(false)

  // ── hole editing ──────────────────────────────────────────────────────
  const [editHole,   setEditHole]   = useState<number | null>(null)  // 1-18
  const [localHoles, setLocalHoles] = useState<Record<number, { score: number|null; par: number; putts: number|null }>>({})
  const [saving,     setSaving]     = useState(false)
  const [showParEdit, setShowParEdit] = useState(false)

  // ── load rounds ───────────────────────────────────────────────────────
  async function loadRounds() {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('personal_rounds')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
    setRounds(data ?? [])
    setLoading(false)
  }

  async function loadHoles(roundId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('personal_round_holes')
      .select('*')
      .eq('round_id', roundId)
      .order('hole_number')
    setHoleRows(data ?? [])
    // 로컬 상태로 변환
    const local: Record<number, { score: number|null; par: number; putts: number|null }> = {}
    data?.forEach(h => { local[h.hole_number] = { score: h.score, par: h.par, putts: h.putts } })
    setLocalHoles(local)
  }

  async function loadCourses() {
    if (courses.length > 0) return
    const supabase = createClient()
    const { data } = await supabase.from('golf_courses')
      .select('id, name, name_vn, province, par, holes, distance_km')
      .eq('is_active', true).order('distance_km')
    setCourses(data ?? [])
  }

  useEffect(() => { loadRounds() }, [user])

  // ── open round ────────────────────────────────────────────────────────
  async function openRound(round: any) {
    setSelectedRound(round)
    await loadHoles(round.id)
    // init local holes for all holes in round
    const totalHoles = round.total_holes
    const computedPars = computePars(round.course_par, totalHoles)
    setLocalHoles(prev => {
      const next = { ...prev }
      for (let i = 1; i <= totalHoles; i++) {
        if (!next[i]) next[i] = { score: null, par: computedPars[i-1], putts: null }
      }
      return next
    })
    setView('card')
  }

  // ── create round ──────────────────────────────────────────────────────
  async function createRound() {
    if (!user || !newForm.courseName) return
    setCreating(true)
    const supabase = createClient()
    const { data: round, error } = await supabase.from('personal_rounds').insert({
      user_id:    user.id,
      course_id:  newForm.courseId  || null,
      course_name: newForm.courseName,
      course_par: newForm.coursePar,
      total_holes: newForm.holes,
      played_at:  newForm.playedAt,
      notes:      newForm.notes || null,
    }).select().single()
    if (!error && round) {
      // pre-create hole rows
      const computedPars = computePars(newForm.coursePar, newForm.holes)
      await supabase.from('personal_round_holes').insert(
        Array.from({ length: newForm.holes }, (_, i) => ({
          round_id: round.id,
          hole_number: i + 1,
          par: computedPars[i],
          score: null,
        }))
      )
      setShowNew(false)
      resetNewForm()
      await loadRounds()
      await openRound(round)
    }
    setCreating(false)
  }

  function resetNewForm() {
    setNewForm({ courseName: '', courseId: '', coursePar: 72, holes: 18, playedAt: new Date().toISOString().split('T')[0], notes: '' })
    setPars(DEFAULT_PARS_18)
    setCourseSearch('')
  }

  // ── save holes ────────────────────────────────────────────────────────
  async function saveCard() {
    if (!selectedRound) return
    setSaving(true)
    const supabase = createClient()
    const entries = Object.entries(localHoles)
    for (const [holeStr, hd] of entries) {
      const hole = parseInt(holeStr)
      await supabase.from('personal_round_holes').upsert({
        round_id: selectedRound.id, hole_number: hole,
        par: hd.par, score: hd.score, putts: hd.putts,
      }, { onConflict: 'round_id,hole_number' })
    }
    // 합계 업데이트
    const filled = entries.filter(([, hd]) => hd.score !== null)
    const total  = filled.length === selectedRound.total_holes
      ? filled.reduce((s, [, hd]) => s + (hd.score ?? 0), 0)
      : null
    await supabase.from('personal_rounds').update({ total_score: total }).eq('id', selectedRound.id)
    setSaving(false)
    await loadRounds()
    // refresh selected round
    const { data } = await supabase.from('personal_rounds').select('*').eq('id', selectedRound.id).single()
    if (data) setSelectedRound(data)
  }

  // ── delete round ──────────────────────────────────────────────────────
  async function deleteRound(roundId: string) {
    if (!confirm(ko ? '이 라운드를 삭제하시겠습니까?' : 'Delete this round?')) return
    const supabase = createClient()
    await supabase.from('personal_rounds').delete().eq('id', roundId)
    if (view === 'card') { setView('list'); setSelectedRound(null) }
    loadRounds()
  }

  // ── computed ──────────────────────────────────────────────────────────
  const totalHoles = selectedRound?.total_holes ?? 18
  const outHoles   = Array.from({ length: 9 }, (_, i) => i + 1)
  const inHoles    = totalHoles === 18 ? Array.from({ length: 9 }, (_, i) => i + 10) : []

  function holeData(n: number) {
    return localHoles[n] ?? { score: null, par: 4, putts: null }
  }
  function sumScores(hs: number[]) {
    return hs.reduce((s, h) => s + (localHoles[h]?.score ?? 0), 0)
  }
  function sumPars(hs: number[]) {
    return hs.reduce((s, h) => s + (localHoles[h]?.par ?? 4), 0)
  }
  const outScore  = sumScores(outHoles)
  const inScore   = sumScores(inHoles)
  const total     = outScore + inScore
  const outPar    = sumPars(outHoles)
  const inPar     = sumPars(inHoles)
  const totalPar  = outPar + inPar
  const filledOut = outHoles.filter(h => localHoles[h]?.score !== null).length
  const filledIn  = inHoles.filter(h => localHoles[h]?.score !== null).length
  const filled    = filledOut + filledIn

  const stats = calcStats(rounds)

  // ─────────────────────────────────────────────────────────────────────
  if (view === 'card' && selectedRound) return (
    <ScorecardView
      round={selectedRound} localHoles={localHoles} setLocalHoles={setLocalHoles}
      editHole={editHole} setEditHole={setEditHole}
      outHoles={outHoles} inHoles={inHoles} totalHoles={totalHoles}
      holeData={holeData} sumScores={sumScores} sumPars={sumPars}
      outScore={outScore} inScore={inScore} total={total}
      outPar={outPar} inPar={inPar} totalPar={totalPar}
      filled={filled} saving={saving}
      ko={ko} lang={lang}
      onBack={() => { setView('list'); setSelectedRound(null); setLocalHoles({}) }}
      onSave={saveCard}
      onDelete={() => deleteRound(selectedRound.id)}
      showParEdit={showParEdit} setShowParEdit={setShowParEdit}
    />
  )

  // ── LIST VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-5 pb-28 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => router.back()} className="text-gray-400 p-1"><ChevronLeft size={22} /></button>
        <Flag size={18} className="text-green-400" />
        <h1 className="text-base font-bold text-white flex-1">{ko ? '개인 스코어카드' : 'My Scorecard'}</h1>
        <button
          onClick={() => { loadCourses(); setShowNew(true) }}
          className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition"
        >
          <Plus size={14} />{ko ? '새 라운드' : 'New Round'}
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="glass-card rounded-2xl p-4 mb-4">
          <p className="text-xs text-green-400 font-semibold mb-3 flex items-center gap-1.5">
            <BarChart2 size={13} />{ko ? '내 통계' : 'My Stats'}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-gray-500">{ko ? '라운드' : 'Rounds'}</p><p className="text-lg font-bold text-white">{stats.count}</p></div>
            <div><p className="text-xs text-gray-500">{ko ? '최저' : 'Best'}</p><p className="text-lg font-bold text-green-300">{stats.best}</p></div>
            <div><p className="text-xs text-gray-500">{ko ? '평균' : 'Avg'}</p><p className="text-lg font-bold text-yellow-300">{stats.avg}</p></div>
          </div>
        </div>
      )}

      {/* Round list */}
      {loading ? (
        <p className="text-center text-gray-500 py-12">{ko ? '로딩 중...' : 'Loading...'}</p>
      ) : rounds.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Flag size={40} className="text-gray-700" />
          <p className="text-gray-500 text-sm">{ko ? '라운드 기록이 없습니다.\n첫 라운드를 추가해보세요!' : 'No rounds yet.\nAdd your first round!'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rounds.map(r => {
            const diff = r.total_score ? r.total_score - r.course_par : null
            return (
              <button key={r.id} onClick={() => openRound(r)}
                className="glass-card rounded-xl px-4 py-3.5 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{r.course_name}</p>
                    <span className="text-xs text-gray-500">{r.total_holes}H</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={11} />{r.played_at}
                    </span>
                    {r.total_score ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff! <= 0 ? 'bg-green-900/60 text-green-300' : diff! <= 5 ? 'bg-yellow-900/60 text-yellow-300' : 'bg-red-900/40 text-red-300'}`}>
                        {r.total_score}타 {diff! >= 0 ? '+' : ''}{diff}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">{ko ? '미완성' : 'In progress'}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {/* ── New Round Sheet ── */}
      {showNew && (
        <div className="fixed inset-0 z-[200]" onClick={() => setShowNew(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-base font-bold text-white">{ko ? '새 라운드 추가' : 'New Round'}</h3>
              <button onClick={() => { setShowNew(false); resetNewForm() }} className="text-gray-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 날짜 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5"><Calendar size={11} className="inline mr-1" />{ko ? '라운드 날짜' : 'Date Played'}</label>
                <input type="date" value={newForm.playedAt} onChange={e => setNewForm(f => ({ ...f, playedAt: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm" />
              </div>

              {/* 홀 수 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">{ko ? '홀 수' : 'Holes'}</label>
                <div className="flex gap-2">
                  {[18, 9].map(h => (
                    <button key={h} onClick={() => { setNewForm(f => ({ ...f, holes: h })); setPars(computePars(newForm.coursePar, h)) }}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${newForm.holes === h ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {h}{ko ? '홀' : ' Holes'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 골프장 선택 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5"><MapPin size={11} className="inline mr-1" />{ko ? '골프장' : 'Golf Course'}</label>
                <input
                  value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)}
                  placeholder={ko ? '이름 검색 또는 직접 입력...' : 'Search or type manually...'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
                />
                {/* 검색 결과 */}
                {courseSearch.length > 0 && (
                  <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-gray-700 divide-y divide-gray-800">
                    {/* 직접 입력 옵션 */}
                    <button onClick={() => { setNewForm(f => ({ ...f, courseName: courseSearch, courseId: '' })); setCourseSearch('') }}
                      className="w-full px-3 py-2.5 text-left text-sm text-green-400 hover:bg-gray-800 transition">
                      ✏ {ko ? `"${courseSearch}" 직접 사용` : `Use "${courseSearch}"`}
                    </button>
                    {courses
                      .filter(c => c.name.toLowerCase().includes(courseSearch.toLowerCase()) || (c.name_vn ?? '').toLowerCase().includes(courseSearch.toLowerCase()))
                      .slice(0, 6)
                      .map(c => (
                        <button key={c.id} onClick={() => {
                          setNewForm(f => ({ ...f, courseName: c.name, courseId: c.id, coursePar: c.par ?? 72 }))
                          setPars(computePars(c.par ?? 72, newForm.holes))
                          setCourseSearch('')
                        }} className={`w-full px-3 py-2.5 text-left transition flex justify-between items-center hover:bg-gray-800 ${newForm.courseId === c.id ? 'bg-green-900/40' : ''}`}>
                          <div>
                            <p className="text-sm text-white">{c.name}</p>
                            {c.name_vn && <p className="text-xs text-gray-500">{c.name_vn}</p>}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">Par {c.par} · {c.distance_km}km</span>
                        </button>
                      ))}
                  </div>
                )}
                {newForm.courseName && (
                  <div className="mt-1.5 flex items-center gap-2 bg-green-900/20 border border-green-800/30 rounded-xl px-3 py-2">
                    <MapPin size={12} className="text-green-400" />
                    <p className="text-sm text-green-300 flex-1 truncate">{newForm.courseName}</p>
                    <span className="text-xs text-gray-400">Par {newForm.coursePar}</span>
                    <button onClick={() => setNewForm(f => ({ ...f, courseName: '', courseId: '' }))} className="text-gray-500"><X size={14} /></button>
                  </div>
                )}
              </div>

              {/* 코스 파 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">{ko ? `코스 파 (${newForm.holes === 9 ? '9홀' : '18홀'})` : `Course Par (${newForm.holes} holes)`}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => { const p = Math.max(60, newForm.coursePar - 1); setNewForm(f => ({ ...f, coursePar: p })); setPars(computePars(p, newForm.holes)) }}
                    className="w-10 h-10 rounded-xl bg-gray-800 text-white font-bold hover:bg-gray-700">−</button>
                  <span className="flex-1 text-center text-xl font-bold text-white">{newForm.coursePar}</span>
                  <button onClick={() => { const p = Math.min(80, newForm.coursePar + 1); setNewForm(f => ({ ...f, coursePar: p })); setPars(computePars(p, newForm.holes)) }}
                    className="w-10 h-10 rounded-xl bg-gray-800 text-white font-bold hover:bg-gray-700">+</button>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">{ko ? '메모 (선택)' : 'Notes (optional)'}</label>
                <input value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
                  placeholder={ko ? '동반자, 날씨 등...' : 'Playing partners, weather...'}  />
              </div>
            </div>
            {/* sticky footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-800 flex gap-3">
              <button onClick={() => { setShowNew(false); resetNewForm() }} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={createRound} disabled={creating || !newForm.courseName}
                className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-40 text-white font-bold text-sm">
                {creating ? '...' : (ko ? '시작하기' : 'Start')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scorecard View Component ──────────────────────────────────────────────
function ScorecardView({
  round, localHoles, setLocalHoles,
  editHole, setEditHole,
  outHoles, inHoles, totalHoles,
  holeData, sumScores, sumPars,
  outScore, inScore, total, outPar, inPar, totalPar,
  filled, saving, ko, lang,
  onBack, onSave, onDelete,
  showParEdit, setShowParEdit,
}: any) {

  const diff = filled === totalHoles ? total - totalPar : null

  function ScoreTable({ holes, label }: { holes: number[]; label: string }) {
    const sTotal = sumScores(holes)
    const pTotal = sumPars(holes)
    const filledHoles = holes.filter(h => localHoles[h]?.score !== null).length
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="min-w-max w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-800/80">
              <th className="sticky left-0 bg-gray-800 px-2 py-2 text-gray-400 font-semibold text-left w-12 border-r border-gray-700">
                {ko ? '홀' : 'Hole'}
              </th>
              {holes.map(h => (
                <th key={h} className="px-1.5 py-2 text-gray-400 font-semibold text-center w-9">{h}</th>
              ))}
              <th className="px-2 py-2 text-green-400 font-bold text-center w-12 border-l border-gray-700">{label}</th>
            </tr>
          </thead>
          <tbody>
            {/* Par row */}
            <tr className="bg-gray-900/60">
              <td className="sticky left-0 bg-gray-900 px-2 py-2 text-gray-400 font-semibold border-r border-gray-700 text-left">
                {ko ? '파' : 'Par'}
              </td>
              {holes.map(h => {
                const { par } = holeData(h)
                return (
                  <td key={h} className="px-1.5 py-2 text-center text-gray-300 font-medium"
                    onClick={() => showParEdit && setEditHole(-h)}> {/* negative = par edit */}
                    {par}
                  </td>
                )
              })}
              <td className="px-2 py-2 text-center text-green-400 font-bold border-l border-gray-700">{pTotal}</td>
            </tr>
            {/* Score row */}
            <tr>
              <td className="sticky left-0 bg-gray-950 px-2 py-2 text-gray-400 font-semibold border-r border-gray-700 text-left">
                {ko ? '타수' : 'Score'}
              </td>
              {holes.map(h => {
                const { score, par } = holeData(h)
                return (
                  <td key={h} className="px-1 py-1.5 text-center" onClick={() => setEditHole(h)}>
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition active:scale-95 ${scoreColor(score, par)}`}>
                      {score ?? '—'}
                    </span>
                  </td>
                )
              })}
              <td className="px-2 py-2 text-center border-l border-gray-700">
                {filledHoles === holes.length ? (
                  <span className={`text-sm font-bold ${sTotal - pTotal > 0 ? 'text-red-300' : sTotal - pTotal < 0 ? 'text-green-300' : 'text-yellow-300'}`}>
                    {sTotal}
                  </span>
                ) : (
                  <span className="text-gray-600 text-xs">{filledHoles}/{holes.length}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3">
        <button onClick={onBack} className="text-gray-400 p-1"><ChevronLeft size={22} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white truncate">{round.course_name}</p>
          <p className="text-xs text-gray-400">{round.played_at} · Par {round.course_par} · {round.total_holes}H</p>
        </div>
        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1 transition"><Trash2 size={16} /></button>
      </div>

      <div className="px-4 space-y-4">
        {/* OUT (1-9) */}
        <ScoreTable holes={outHoles} label="OUT" />

        {/* IN (10-18) */}
        {inHoles.length > 0 && <ScoreTable holes={inHoles} label="IN" />}

        {/* Totals */}
        <div className={`rounded-2xl p-4 ${diff !== null ? 'bg-gradient-to-r from-green-900/30 to-blue-900/20 border border-green-800/40' : 'glass-card'}`}>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {inHoles.length > 0 && (
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>OUT <span className="text-white font-semibold">{outScore || '—'}</span></span>
                  <span>IN <span className="text-white font-semibold">{inScore || '—'}</span></span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <p className="text-2xl font-black text-white">{filled === totalHoles ? total : `${filled}/${totalHoles}`}</p>
                {diff !== null && (
                  <span className={`text-lg font-bold ${diff > 0 ? 'text-red-300' : diff < 0 ? 'text-green-300' : 'text-yellow-300'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </span>
                )}
              </div>
              {diff !== null && (
                <p className="text-xs text-gray-400">
                  {ko ? scoreLabel(total, totalPar, ko) : scoreLabel(total, totalPar, ko)}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-gray-500 space-y-0.5">
              <p>Par {totalPar}</p>
              <p>{filled}/{totalHoles} {ko ? '홀 완료' : 'holes done'}</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {[
            { label: ko ? '이글+' : 'Eagle+', cls: 'bg-indigo-700 text-yellow-200' },
            { label: ko ? '버디'  : 'Birdie', cls: 'bg-blue-600 text-white' },
            { label: ko ? '파'    : 'Par',    cls: 'bg-green-700 text-white' },
            { label: ko ? '보기'  : 'Bogey',  cls: 'bg-yellow-600 text-white' },
            { label: ko ? '더블'  : 'Double', cls: 'bg-orange-600 text-white' },
            { label: ko ? '트리플+' : 'Triple+', cls: 'bg-red-700 text-white' },
          ].map(({ label, cls }) => (
            <span key={label} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
          ))}
        </div>

        {/* Save button */}
        <button onClick={onSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold transition">
          <Save size={16} />
          {saving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '스코어카드 저장' : 'Save Scorecard')}
        </button>
      </div>

      {/* Hole edit modal */}
      {editHole !== null && editHole > 0 && (
        <HoleEditModal
          hole={editHole}
          data={localHoles[editHole] ?? { score: null, par: 4, putts: null }}
          ko={ko}
          onClose={() => setEditHole(null)}
          onChange={(score: number|null, putts: number|null, par: number) => {
            setLocalHoles((prev: any) => ({ ...prev, [editHole]: { score, par, putts } }))
            setEditHole(null)
          }}
        />
      )}
    </div>
  )
}

// ── Hole Edit Modal ───────────────────────────────────────────────────────
function HoleEditModal({ hole, data, ko, onClose, onChange }: {
  hole: number; data: { score: number|null; par: number; putts: number|null }
  ko: boolean; onClose: () => void
  onChange: (score: number|null, putts: number|null, par: number) => void
}) {
  const [score, setScore] = useState<number|null>(data.score)
  const [putts, setPutts] = useState<number|null>(data.putts)
  const [par,   setPar]   = useState(data.par)
  const diff = score !== null ? score - par : null

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full bg-gray-900 rounded-t-2xl px-5 pt-4 pb-10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-3"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-lg font-black text-white">{ko ? `${hole}번 홀` : `Hole ${hole}`}</p>
            <p className="text-xs text-gray-400">Par {par}</p>
          </div>
          {diff !== null && (
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreColor(score, par)}`}>
              {diff === 0 ? 'Par' : diff > 0 ? `+${diff}` : diff} · {scoreLabel(score, par, ko)}
            </span>
          )}
        </div>

        {/* Par selector */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">{ko ? '파' : 'Par'}</p>
          <div className="flex gap-2">
            {[3,4,5].map(p => (
              <button key={p} onClick={() => setPar(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${par === p ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Score */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">{ko ? '타수' : 'Score'}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setScore(s => s !== null ? Math.max(1, s - 1) : par - 1)}
              className="w-12 h-12 rounded-xl bg-gray-800 text-white text-xl font-bold hover:bg-gray-700 transition">−</button>
            <span className={`flex-1 text-center text-3xl font-black rounded-xl py-2 ${score !== null ? scoreColor(score, par) : 'text-gray-600 bg-gray-800'}`}>
              {score ?? '—'}
            </span>
            <button onClick={() => setScore(s => s !== null ? s + 1 : par + 1)}
              className="w-12 h-12 rounded-xl bg-gray-800 text-white text-xl font-bold hover:bg-gray-700 transition">+</button>
          </div>
          {/* Quick score buttons */}
          <div className="flex gap-1.5 mt-2 flex-wrap justify-center">
            {[par-2, par-1, par, par+1, par+2, par+3].filter(v => v >= 1).map(v => (
              <button key={v} onClick={() => setScore(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${score === v ? scoreColor(v, par) : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {v - par === 0 ? 'P' : v - par > 0 ? `+${v-par}` : v - par}
              </button>
            ))}
          </div>
        </div>

        {/* Putts */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2">{ko ? '퍼트 수 (선택)' : 'Putts (optional)'}</p>
          <div className="flex gap-1.5">
            {[null, 1, 2, 3, 4].map(p => (
              <button key={String(p)} onClick={() => setPutts(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${putts === p ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {p === null ? '—' : p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium text-sm">{ko ? '취소' : 'Cancel'}</button>
          <button onClick={() => onChange(score, putts, par)}
            className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold text-sm">
            {ko ? '확인' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
