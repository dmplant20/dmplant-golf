'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  ChevronLeft, Plus, Trash2, Save, X,
  Flag, BarChart2, Calendar, MapPin, ChevronRight,
  Search, ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── 국가 감지 ─────────────────────────────────────────────────────────────
type CountryKey = 'Vietnam' | 'Korea' | 'Indonesia' | 'Other'

// ── 하드코딩된 골프장 목록 ──────────────────────────────────────────────────
const BUILTIN_COURSES: {
  id: string; name: string; name_vn: string | null; province: string;
  holes: number; par: number; distance_km: number | null
}[] = [
  { id: '_tsn',  name: 'Tan Son Nhat Golf Course',          name_vn: 'Sân Golf Tân Sơn Nhất',              province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 6   },
  { id: '_ssg',  name: 'Saigon South Golf Club',            name_vn: 'Sân Golf Nam Sài Gòn',               province: 'Ho Chi Minh City', holes: 9,  par: 27,  distance_km: 8   },
  { id: '_vgcc', name: 'Vietnam Golf & Country Club',       name_vn: 'Sân Golf & Country Club Việt Nam',   province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 20  },
  { id: '_vpl',  name: 'Vinpearl Golf Léman Cu Chi',        name_vn: 'Sân Golf Vinpearl Golf Léman Củ Chi', province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 35  },
  { id: '_sbg',  name: 'Song Be Golf Resort',               name_vn: 'Sân Golf Song Bé',                   province: 'Binh Duong',       holes: 27, par: 108, distance_km: 15  },
  { id: '_tdg',  name: 'Twin Doves Golf Club',              name_vn: 'Sân Golf Twin Doves',                province: 'Binh Duong',       holes: 27, par: 108, distance_km: 35  },
  { id: '_hmg',  name: 'Harmonie Golf Park',                name_vn: 'Sân Golf Harmonie',                  province: 'Binh Duong',       holes: 18, par: 72,  distance_km: 35  },
  { id: '_ltg',  name: 'Long Thanh Golf Club',              name_vn: 'Sân Golf Long Thành',                province: 'Dong Nai',         holes: 36, par: 144, distance_km: 36  },
  { id: '_dng',  name: 'Dong Nai Golf Resort (Bo Chang)',   name_vn: 'Sân Golf Đồng Nai (Bò Chang)',       province: 'Dong Nai',         holes: 27, par: 108, distance_km: 50  },
  { id: '_ecc',  name: 'Emerald Country Club',              name_vn: 'Sân Golf Emerald Country Club',       province: 'Dong Nai',         holes: 18, par: 72,  distance_km: 40  },
  { id: '_rla',  name: 'Royal Long An Golf & Country Club', name_vn: 'Sân Golf Royal Long An',              province: 'Long An',          holes: 27, par: 108, distance_km: 50  },
  { id: '_wlg',  name: 'West Lakes Golf & Villas',          name_vn: 'Sân Golf West Lakes',                 province: 'Long An',          holes: 18, par: 72,  distance_km: 52  },
  { id: '_vtg',  name: 'Vung Tau Paradise Golf Resort',     name_vn: 'Sân Golf Vũng Tàu Paradise',          province: 'Ba Ria-Vung Tau',  holes: 27, par: 108, distance_km: 125 },
  { id: '_scg',  name: 'Sonadezi Chau Duc Golf Course',     name_vn: 'Sân Golf Sonadezi Châu Đức',          province: 'Ba Ria-Vung Tau',  holes: 36, par: 144, distance_km: 90  },
  { id: '_blf',  name: 'The Bluffs Grand Ho Tram Strip',    name_vn: 'Sân Golf The Bluffs Hồ Tràm',         province: 'Ba Ria-Vung Tau',  holes: 18, par: 71,  distance_km: 130 },
  { id: '_pga',  name: 'PGA NovaWorld Phan Thiet',          name_vn: 'Sân Golf PGA NovaWorld Phan Thiết',   province: 'Binh Thuan',       holes: 36, par: 144, distance_km: 200 },
]

function detectCountry(province: string): CountryKey {
  if (/Ho Chi Minh|Binh Duong|Dong Nai|Long An|Ba Ria|Binh Thuan|Da Nang|Ha Noi|Hanoi|Quang Nam|Khanh Hoa|Vung Tau|Hue|Nha Trang/i.test(province)) return 'Vietnam'
  if (/Korea|Seoul|Incheon|Jeju|Gyeong|Busan|Cheju|경기|서울|인천|제주|경상|부산/i.test(province)) return 'Korea'
  if (/Indonesia|Bali|Jakarta|BSD|Bandung|Surabaya|Bogor|Batam/i.test(province)) return 'Indonesia'
  return 'Other'
}

const COUNTRY_META: Record<CountryKey | 'all', { flag: string; ko: string; en: string }> = {
  all:       { flag: '🌏', ko: '전체',       en: 'All'       },
  Vietnam:   { flag: '🇻🇳', ko: '베트남',    en: 'Vietnam'   },
  Korea:     { flag: '🇰🇷', ko: '한국',      en: 'Korea'     },
  Indonesia: { flag: '🇮🇩', ko: '인도네시아', en: 'Indonesia' },
  Other:     { flag: '🌍', ko: '기타',       en: 'Other'     },
}

// ── 서브코스 조합 ─────────────────────────────────────────────────────────
const SUB_COURSE_LABELS: Record<string, string> = {
  A: 'A코스', B: 'B코스', C: 'C코스', D: 'D코스',
  AB: 'A+B코스', BC: 'B+C코스', AC: 'A+C코스',
  CD: 'C+D코스', AD: 'A+D코스', BD: 'B+D코스',
}
function getSubCourseCombos(courseHoles: number, playHoles: number) {
  if (courseHoles === 27 && playHoles === 18) return [
    { key: 'AB', label: 'A+B코스' }, { key: 'BC', label: 'B+C코스' }, { key: 'AC', label: 'A+C코스' },
  ]
  if (courseHoles === 27 && playHoles === 9) return [
    { key: 'A', label: 'A코스' }, { key: 'B', label: 'B코스' }, { key: 'C', label: 'C코스' },
  ]
  if (courseHoles === 36 && playHoles === 18) return [
    { key: 'AB', label: 'A+B코스' }, { key: 'CD', label: 'C+D코스' },
    { key: 'BC', label: 'B+C코스' }, { key: 'AD', label: 'A+D코스' },
  ]
  if (courseHoles === 36 && playHoles === 9) return [
    { key: 'A', label: 'A코스' }, { key: 'B', label: 'B코스' },
    { key: 'C', label: 'C코스' }, { key: 'D', label: 'D코스' },
  ]
  return []
}

// ── 기본 파 ───────────────────────────────────────────────────────────────
const DEFAULT_PARS_18 = [4,4,3,5,4,3,4,5,4, 4,3,5,4,4,3,5,4,4]
const DEFAULT_PARS_9  = [4,4,3,5,4,3,4,5,4]

function computePars(totalPar: number, holes: number): number[] {
  const base    = holes === 9 ? [...DEFAULT_PARS_9] : [...DEFAULT_PARS_18]
  const baseSum = base.reduce((a, b) => a + b, 0)
  const diff    = totalPar - baseSum
  const result  = [...base]
  if (diff > 0) { let d = diff; for (let i = 0; i < result.length && d > 0; i++) { if (result[i] < 5) { result[i]++; d-- } } }
  else if (diff < 0) { let d = -diff; for (let i = result.length-1; i >= 0 && d > 0; i--) { if (result[i] > 3) { result[i]--; d-- } } }
  return result
}

// ── 스코어 색상 ───────────────────────────────────────────────────────────
function scoreColor(score: number | null, par: number): string {
  if (score === null) return 'text-gray-500 bg-gray-800'
  const d = score - par
  if (d <= -2) return 'text-yellow-200 bg-indigo-700'
  if (d === -1) return 'text-white bg-blue-600'
  if (d === 0)  return 'text-white bg-green-700'
  if (d === 1)  return 'text-white bg-yellow-600'
  if (d === 2)  return 'text-white bg-orange-600'
  return 'text-white bg-red-700'
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

function calcStats(rounds: any[]) {
  const completed = rounds.filter(r => r.total_score)
  if (!completed.length) return null
  const scores = completed.map(r => r.total_score)
  return {
    count:  rounds.length,
    best:   Math.min(...scores),
    avg:    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    latest: completed[0]?.total_score,
  }
}

const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp' }

// ─────────────────────────────────────────────────────────────────────────
export default function ScorecardPage() {
  const router = useRouter()
  const { user, lang, currentClubId } = useAuthStore()
  const ko = lang === 'ko'

  const [view,          setView]          = useState<'list'|'card'>('list')
  const [rounds,        setRounds]        = useState<any[]>([])
  const [selectedRound, setSelectedRound] = useState<any>(null)
  const [holeRows,      setHoleRows]      = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)

  // new round
  const [showNew,         setShowNew]         = useState(false)
  const [courses,         setCourses]         = useState<any[]>(BUILTIN_COURSES)
  const [newForm,         setNewForm]         = useState({
    courseName: '', courseId: '', coursePar: 72, holes: 18,
    playedAt: new Date().toISOString().split('T')[0], notes: '',
  })
  const [pars,            setPars]            = useState<number[]>(DEFAULT_PARS_18)
  const [creating,        setCreating]        = useState(false)
  const [createError,     setCreateError]     = useState('')
  // 선택된 코스 전체 객체 (27홀 등 sub-course 선택에 필요)
  const [selectedCourseObj, setSelectedCourseObj] = useState<any>(null)
  const [subCourse,       setSubCourse]       = useState<string>('')

  // course picker state
  const [cpSearch,      setCpSearch]      = useState('')
  const [selCountry,    setSelCountry]    = useState<string>('all')
  const [selProvince,   setSelProvince]   = useState<string>('all')

  // hole editing
  const [editHole,      setEditHole]      = useState<number | null>(null)
  const [localHoles,    setLocalHoles]    = useState<Record<number, { score: number|null; par: number; putts: number|null; yardage: number|null }>>({})
  const [saving,        setSaving]        = useState(false)
  const [showParEdit,   setShowParEdit]   = useState(false)

  // fine toast
  const [fineToast,     setFineToast]     = useState<string | null>(null)

  // ── course countries / provinces ──────────────────────────────────────
  const availableCountries = useMemo(() => {
    const keys = new Set<string>()
    courses.forEach(c => keys.add(detectCountry(c.province)))
    const order: CountryKey[] = ['Vietnam','Korea','Indonesia','Other']
    return order.filter(k => keys.has(k))
  }, [courses])

  const availableProvinces = useMemo(() => {
    if (selCountry === 'all') return []
    const set = new Set<string>()
    courses.forEach(c => { if (detectCountry(c.province) === selCountry) set.add(c.province) })
    return [...set].sort()
  }, [courses, selCountry])

  const filteredCourses = useMemo(() => {
    let list = courses
    if (selCountry !== 'all') list = list.filter(c => detectCountry(c.province) === selCountry)
    if (selProvince !== 'all') list = list.filter(c => c.province === selProvince)
    if (cpSearch.trim()) {
      const q = cpSearch.trim().toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.name_vn ?? '').toLowerCase().includes(q) ||
        c.province.toLowerCase().includes(q)
      )
    }
    return list
  }, [courses, selCountry, selProvince, cpSearch])

  // 선택된 코스의 sub-course 조합
  const subCourseCombos = useMemo(() => {
    if (!selectedCourseObj) return []
    return getSubCourseCombos(selectedCourseObj.holes, newForm.holes)
  }, [selectedCourseObj, newForm.holes])

  const needsSubCourse = subCourseCombos.length > 0

  // ── loaders ───────────────────────────────────────────────────────────
  async function loadRounds() {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('personal_rounds')
      .select('*').eq('user_id', user.id).order('played_at', { ascending: false })
    setRounds(data ?? [])
    setLoading(false)
  }

  async function loadHoles(roundId: string) {
    const supabase = createClient()
    const { data } = await supabase.from('personal_round_holes')
      .select('*').eq('round_id', roundId).order('hole_number')
    setHoleRows(data ?? [])
    const local: Record<number, { score: number|null; par: number; putts: number|null; yardage: number|null }> = {}
    data?.forEach(h => {
      local[h.hole_number] = { score: h.score, par: h.par, putts: h.putts, yardage: h.yardage ?? null }
    })
    setLocalHoles(local)
  }

  async function loadCourses() {
    if (courses.some(c => !String(c.id).startsWith('_'))) return
    const supabase = createClient()
    const { data } = await supabase.from('golf_courses')
      .select('id, name, name_vn, province, par, holes, distance_km')
      .eq('is_active', true).order('name')
    if (data && data.length > 0) {
      const dbNames = new Set(data.map((c: any) => c.name.toLowerCase()))
      const extras = BUILTIN_COURSES.filter(b => !dbNames.has(b.name.toLowerCase()))
      setCourses([...data, ...extras])
    }
  }

  useEffect(() => { loadRounds() }, [user])

  async function openRound(round: any) {
    setSelectedRound(round)
    await loadHoles(round.id)
    const totalHoles   = round.total_holes
    const computedPars = computePars(round.course_par, totalHoles)
    setLocalHoles(prev => {
      const next = { ...prev }
      for (let i = 1; i <= totalHoles; i++) {
        if (!next[i]) next[i] = { score: null, par: computedPars[i-1], putts: null, yardage: null }
      }
      return next
    })
    setView('card')
  }

  // ── 코스 선택 핸들러 ──────────────────────────────────────────────────
  function handleSelectCourse(c: any) {
    setSelectedCourseObj(c)
    setSubCourse('')
    setCreateError('')
    // 현재 play holes에 맞게 par 자동 계산
    const adjustedPar = c.holes > newForm.holes
      ? Math.round(c.par * newForm.holes / c.holes)
      : (c.par ?? 72)
    setNewForm(f => ({ ...f, courseName: c.name, courseId: c.id, coursePar: adjustedPar }))
    setPars(computePars(adjustedPar, newForm.holes))
    setCpSearch('')
  }

  // ── sub-course 선택 핸들러 ────────────────────────────────────────────
  function handleSelectSubCourse(comboKey: string) {
    if (!selectedCourseObj) return
    setSubCourse(comboKey)
    setCreateError('')
    // sub-course별 par는 비례 계산 (이미 adjustedPar가 설정됐으면 그대로 유지)
    // 명시적으로 표시 이름 업데이트는 createRound 시점에 처리
  }

  async function createRound() {
    if (!user || !newForm.courseName) return
    // sub-course 선택 필요한데 안 됐으면 에러
    if (needsSubCourse && !subCourse) {
      setCreateError(ko ? '어떤 코스를 도는지 선택해주세요' : 'Please select which course to play')
      return
    }
    setCreating(true)
    setCreateError('')
    const supabase = createClient()

    // 코스명에 sub-course 포함
    const finalCourseName = subCourse
      ? `${newForm.courseName} (${SUB_COURSE_LABELS[subCourse] ?? subCourse})`
      : newForm.courseName

    // BUILTIN 코스 ID('_' 시작)는 FK 오류 방지를 위해 null 처리
    const courseId = (newForm.courseId && !String(newForm.courseId).startsWith('_'))
      ? newForm.courseId : null

    const { data: round, error } = await supabase.from('personal_rounds').insert({
      user_id:     user.id,
      course_id:   courseId,
      course_name: finalCourseName,
      course_par:  newForm.coursePar,
      total_holes: newForm.holes,
      played_at:   newForm.playedAt,
      notes:       newForm.notes || null,
    }).select().single()

    if (error) {
      setCreateError(error.message || (ko ? '저장 실패' : 'Save failed'))
      setCreating(false)
      return
    }

    if (round) {
      const computedPars = computePars(newForm.coursePar, newForm.holes)
      await supabase.from('personal_round_holes').insert(
        Array.from({ length: newForm.holes }, (_, i) => ({
          round_id: round.id, hole_number: i + 1, par: computedPars[i], score: null,
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
    setCpSearch(''); setSelCountry('all'); setSelProvince('all')
    setSelectedCourseObj(null); setSubCourse(''); setCreateError('')
  }

  async function saveCard() {
    if (!selectedRound) return
    setSaving(true)
    const supabase  = createClient()
    const entries   = Object.entries(localHoles)
    for (const [holeStr, hd] of entries) {
      await supabase.from('personal_round_holes').upsert(
        {
          round_id: selectedRound.id, hole_number: parseInt(holeStr),
          par: hd.par, score: hd.score, putts: hd.putts,
          yardage: hd.yardage ?? null,
        },
        { onConflict: 'round_id,hole_number' }
      )
    }
    const filled = entries.filter(([, hd]) => hd.score !== null)
    const total  = filled.length === selectedRound.total_holes
      ? filled.reduce((s, [, hd]) => s + (hd.score ?? 0), 0) : null
    await supabase.from('personal_rounds').update({ total_score: total }).eq('id', selectedRound.id)
    setSaving(false)
    await loadRounds()
    const { data } = await supabase.from('personal_rounds').select('*').eq('id', selectedRound.id).single()
    if (data) setSelectedRound(data)

    // ── 자동 핸디오버 벌금 계산 ──────────────────────────────────────
    try {
      if (total !== null && currentClubId && user) {
        const [{ data: clubData }, { data: membership }] = await Promise.all([
          supabase.from('clubs').select('fine_handicap_per_stroke, fine_handicap_max, currency').eq('id', currentClubId).single(),
          supabase.from('club_memberships').select('club_handicap').eq('club_id', currentClubId).eq('user_id', user.id).maybeSingle(),
        ])
        const perStroke  = clubData?.fine_handicap_per_stroke
        const maxFine    = clubData?.fine_handicap_max ?? null
        const clubHandicap = membership?.club_handicap ?? null
        const clubCurrency = clubData?.currency ?? 'KRW'
        const fineSym    = CURRENCY_SYMBOL[clubCurrency] ?? '₩'

        if (perStroke && clubHandicap !== null) {
          const allowedScore = selectedRound.course_par + clubHandicap
          if (total > allowedScore) {
            const overStrokes = total - allowedScore
            const fineAmount  = maxFine !== null
              ? Math.min(overStrokes * perStroke, maxFine)
              : overStrokes * perStroke
            await supabase.from('finance_transactions').insert({
              club_id: currentClubId, type: 'fine', amount: fineAmount, currency: clubCurrency,
              description: ko ? `핸디오버 벌금 (+${overStrokes}타)` : `Handicap-over fine (+${overStrokes} strokes)`,
              transaction_date: selectedRound.played_at, recorded_by: user.id, member_id: user.id,
            })
            setFineToast(ko
              ? `벌금 ${fineSym}${fineAmount.toLocaleString()} 자동 부과 (+${overStrokes}타)`
              : `Fine ${fineSym}${fineAmount.toLocaleString()} auto-charged (+${overStrokes} strokes)`)
            setTimeout(() => setFineToast(null), 3000)
          } else {
            setFineToast(ko ? '벌금 없음 ✓' : 'No fine ✓')
            setTimeout(() => setFineToast(null), 2000)
          }
        }
      }
    } catch { /* silently ignore */ }
  }

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
  function holeData(n: number) { return localHoles[n] ?? { score: null, par: 4, putts: null, yardage: null } }
  function sumScores(hs: number[]) { return hs.reduce((s, h) => s + (localHoles[h]?.score ?? 0), 0) }
  function sumPars(hs: number[])   { return hs.reduce((s, h) => s + (localHoles[h]?.par   ?? 4), 0) }
  const outScore = sumScores(outHoles), inScore = sumScores(inHoles), total = outScore + inScore
  const outPar   = sumPars(outHoles),   inPar   = sumPars(inHoles),   totalPar = outPar + inPar
  const filledOut = outHoles.filter(h => localHoles[h]?.score !== null).length
  const filledIn  = inHoles.filter(h => localHoles[h]?.score !== null).length
  const filled    = filledOut + filledIn
  const stats     = calcStats(rounds)

  // ── Scorecard view ────────────────────────────────────────────────────
  if (view === 'card' && selectedRound) return (
    <>
      <ScorecardView
        round={selectedRound} localHoles={localHoles} setLocalHoles={setLocalHoles}
        editHole={editHole} setEditHole={setEditHole}
        outHoles={outHoles} inHoles={inHoles} totalHoles={totalHoles}
        holeData={holeData} sumScores={sumScores} sumPars={sumPars}
        outScore={outScore} inScore={inScore} total={total}
        outPar={outPar} inPar={inPar} totalPar={totalPar}
        filled={filled} saving={saving} ko={ko} lang={lang}
        onBack={() => { setView('list'); setSelectedRound(null); setLocalHoles({}) }}
        onSave={saveCard} onDelete={() => deleteRound(selectedRound.id)}
        showParEdit={showParEdit} setShowParEdit={setShowParEdit}
      />
      {fineToast && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-[300] px-4 pointer-events-none">
          <div className="px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl"
            style={{ background: 'rgba(22,163,74,0.92)', backdropFilter: 'blur(8px)', maxWidth: '90vw', textAlign: 'center' }}>
            {fineToast}
          </div>
        </div>
      )}
    </>
  )

  // ─────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg, #060d06)' }}>

      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2">
        <button onClick={() => router.back()} className="text-gray-400 p-1">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Flag size={17} className="text-green-400" />
          <h1 className="text-base font-bold text-white">
            {ko ? '개인 스코어카드' : 'My Scorecard'}
          </h1>
        </div>
        <button
          onClick={() => { loadCourses(); setShowNew(true) }}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl transition whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 2px 12px rgba(22,163,74,0.3)' }}>
          <Plus size={13} />{ko ? '새 라운드' : 'New Round'}
        </button>
      </div>

      <div className="px-4 space-y-3">

        {/* 통계 카드 */}
        {stats ? (
          <div className="rounded-2xl p-4"
            style={{ background: 'linear-gradient(135deg,rgba(22,163,74,0.12),rgba(6,13,6,0.97))', border: '1px solid rgba(34,197,94,0.18)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3 flex items-center gap-1.5" style={{ color: '#22c55e' }}>
              <BarChart2 size={11} />{ko ? '내 라운드 통계' : 'My Stats'}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: ko ? '라운드' : 'Rounds', val: stats.count, cls: 'text-white' },
                { label: ko ? '최저타' : 'Best',   val: stats.best,  cls: 'text-green-300' },
                { label: ko ? '평균타' : 'Avg',    val: stats.avg,   cls: 'text-yellow-300' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="rounded-xl py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[10px] mb-0.5" style={{ color: '#5a7a5a' }}>{label}</p>
                  <p className={`text-xl font-black ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && rounds.length === 0 && (
          <div className="rounded-2xl p-5 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.08)' }}>
            <Flag size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400">{ko ? '아직 라운드 기록이 없습니다' : 'No rounds recorded yet'}</p>
            <p className="text-xs mt-1" style={{ color: '#3a5a3a' }}>
              {ko ? '"새 라운드" 버튼으로 첫 라운드를 시작하세요' : 'Tap "New Round" to get started'}
            </p>
          </div>
        )}

        {/* 라운드 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {rounds.map(r => {
              const diff = r.total_score ? r.total_score - r.course_par : null
              return (
                <button key={r.id} onClick={() => openRound(r)}
                  className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.1)' }}>
                  <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{ background: diff === null ? 'rgba(107,114,128,0.15)' : diff <= 0 ? 'rgba(22,163,74,0.15)' : diff <= 5 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)' }}>
                    {r.total_score ? (
                      <>
                        <span className={`text-sm font-black ${diff! <= 0 ? 'text-green-300' : diff! <= 5 ? 'text-yellow-300' : 'text-red-300'}`}>{r.total_score}</span>
                        <span className="text-[9px] font-bold" style={{ color: '#5a7a5a' }}>{diff! >= 0 ? '+' : ''}{diff}</span>
                      </>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#3a5a3a' }}>{ko ? '진행' : 'WIP'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.course_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs flex items-center gap-0.5" style={{ color: '#5a7a5a' }}>
                        <Calendar size={10} />{r.played_at}
                      </span>
                      <span className="text-xs" style={{ color: '#3a5a3a' }}>Par {r.course_par} · {r.total_holes}H</span>
                    </div>
                  </div>
                  <ChevronRight size={15} style={{ color: '#3a5a3a' }} className="flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          새 라운드 바텀시트
      ═══════════════════════════════════════════════════════════════ */}
      {showNew && (
        <div className="fixed inset-0 z-[200]" onClick={() => setShowNew(false)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
            style={{ maxHeight: '93vh', background: '#0c160c', border: '1px solid rgba(34,197,94,0.15)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(34,197,94,0.2)' }} />
            </div>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
              <h3 className="text-base font-black text-white">{ko ? '새 라운드 시작' : 'New Round'}</h3>
              <button onClick={() => { setShowNew(false); resetNewForm() }}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

              {/* 날짜 + 홀 수 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    <Calendar size={10} className="inline mr-1" />{ko ? '라운드 날짜' : 'Date'}
                  </label>
                  <input type="date" value={newForm.playedAt}
                    onChange={e => setNewForm(f => ({ ...f, playedAt: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-white text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.15)' }} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    {ko ? '홀 수' : 'Holes'}
                  </label>
                  <div className="flex gap-2">
                    {[18, 9].map(h => (
                      <button key={h} type="button"
                        onClick={() => {
                          setNewForm(f => ({ ...f, holes: h }))
                          // 코스가 선택됐으면 par 재계산
                          if (selectedCourseObj) {
                            const p = selectedCourseObj.holes > h
                              ? Math.round(selectedCourseObj.par * h / selectedCourseObj.holes)
                              : (selectedCourseObj.par ?? 72)
                            setNewForm(f => ({ ...f, holes: h, coursePar: p }))
                            setPars(computePars(p, h))
                          } else {
                            setPars(computePars(newForm.coursePar, h))
                          }
                          setSubCourse('')
                        }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                        style={newForm.holes === h
                          ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }
                          : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.12)' }}>
                        {h}H
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── 골프장 검색 섹션 ── */}
              <div>
                <label className="text-[11px] font-semibold mb-2 block" style={{ color: '#5a7a5a' }}>
                  <MapPin size={10} className="inline mr-1" />{ko ? '골프장 선택' : 'Golf Course'}
                </label>

                {/* 선택된 골프장 */}
                {newForm.courseName ? (
                  <div>
                    <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3"
                      style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(22,163,74,0.2)' }}>
                        <Flag size={12} style={{ color: '#22c55e' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{newForm.courseName}</p>
                        <p className="text-[10px]" style={{ color: '#5a7a5a' }}>
                          Par {newForm.coursePar} · {newForm.holes}홀
                          {selectedCourseObj?.holes > newForm.holes && (
                            <span style={{ color: '#f59e0b' }}> · {selectedCourseObj.holes}홀 코스</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setNewForm(f => ({ ...f, courseName: '', courseId: '' }))
                          setSelectedCourseObj(null); setSubCourse(''); setCpSearch('')
                        }}
                        className="flex-shrink-0" style={{ color: '#3a5a3a' }}>
                        <X size={15} />
                      </button>
                    </div>

                    {/* ── sub-course 선택 (27홀/36홀인 경우) ── */}
                    {needsSubCourse && (
                      <div className="rounded-xl p-3 mb-1"
                        style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
                        <p className="text-[11px] font-semibold mb-2" style={{ color: '#f59e0b' }}>
                          ⛳ {ko
                            ? `${selectedCourseObj.holes}홀 코스입니다. 어떤 코스를 도시나요?`
                            : `${selectedCourseObj.holes}-hole course. Which courses will you play?`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {subCourseCombos.map(combo => (
                            <button key={combo.key} type="button"
                              onClick={() => handleSelectSubCourse(combo.key)}
                              className="px-3 py-2 rounded-xl text-sm font-bold transition"
                              style={subCourse === combo.key
                                ? { background: 'linear-gradient(135deg,#d97706,#92400e)', color: '#fff' }
                                : { background: 'rgba(255,255,255,0.05)', color: '#d97706', border: '1px solid rgba(234,179,8,0.3)' }}>
                              {combo.label}
                            </button>
                          ))}
                        </div>
                        {subCourse && (
                          <p className="text-[10px] mt-2" style={{ color: '#22c55e' }}>
                            ✓ {SUB_COURSE_LABELS[subCourse]} 선택됨
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* 국가 필터 */}
                    {availableCountries.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scroll-hide mb-2">
                        <button onClick={() => { setSelCountry('all'); setSelProvince('all') }}
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition"
                          style={selCountry === 'all'
                            ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }
                            : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.12)' }}>
                          {COUNTRY_META.all.flag} {ko ? COUNTRY_META.all.ko : COUNTRY_META.all.en}
                        </button>
                        {availableCountries.map(ck => (
                          <button key={ck} onClick={() => { setSelCountry(ck); setSelProvince('all') }}
                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap"
                            style={selCountry === ck
                              ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.12)' }}>
                            {COUNTRY_META[ck].flag} {ko ? COUNTRY_META[ck].ko : COUNTRY_META[ck].en}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 지역 필터 */}
                    {selCountry !== 'all' && availableProvinces.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scroll-hide mb-2">
                        <button onClick={() => setSelProvince('all')}
                          className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition"
                          style={selProvince === 'all'
                            ? { background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                            : { background: 'rgba(255,255,255,0.04)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.1)' }}>
                          {ko ? '전 지역' : 'All Areas'}
                        </button>
                        {availableProvinces.map(pv => (
                          <button key={pv} onClick={() => setSelProvince(pv)}
                            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition whitespace-nowrap"
                            style={selProvince === pv
                              ? { background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                              : { background: 'rgba(255,255,255,0.04)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.1)' }}>
                            {pv}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 검색 입력 */}
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#3a5a3a' }} />
                      <input
                        value={cpSearch}
                        onChange={e => setCpSearch(e.target.value)}
                        placeholder={ko ? '골프장명 검색...' : 'Search courses...'}
                        className="w-full pl-9 pr-8 py-3 rounded-xl text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.18)', color: '#fff' }}
                        autoComplete="off"
                      />
                      {cpSearch && (
                        <button onClick={() => setCpSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#3a5a3a' }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* 골프장 목록 */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(34,197,94,0.1)' }}>
                      {filteredCourses.length === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <p className="text-sm" style={{ color: '#3a5a3a' }}>
                            {ko ? '검색 결과 없음' : 'No courses found'}
                          </p>
                          {cpSearch.trim() && (
                            <button
                              onClick={() => {
                                setNewForm(f => ({ ...f, courseName: cpSearch.trim(), courseId: '' }))
                                setSelectedCourseObj(null)
                                setCpSearch('')
                              }}
                              className="text-xs mt-1.5" style={{ color: '#22c55e' }}>
                              "{cpSearch.trim()}" {ko ? '직접 입력' : '— use as entered'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="max-h-52 overflow-y-auto">
                          {filteredCourses.map((c, idx) => (
                            <button key={c.id} type="button"
                              onClick={() => handleSelectCourse(c)}
                              className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition"
                              style={{ borderTop: idx > 0 ? '1px solid rgba(34,197,94,0.07)' : 'none', background: 'transparent' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(22,163,74,0.12)' }}>
                                <MapPin size={11} style={{ color: '#22c55e' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px]" style={{ color: '#3a5a3a' }}>{c.province}</span>
                                  <span className="text-[10px] font-semibold" style={{ color: c.holes > 18 ? '#f59e0b' : '#22c55e' }}>
                                    {c.holes}H · Par {Math.round(c.par * newForm.holes / c.holes)}
                                    {c.holes > 18 && ` (전체 ${c.holes}H)`}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 코스 파 조정 */}
              <div>
                <label className="text-[11px] font-semibold mb-2 block" style={{ color: '#5a7a5a' }}>
                  {ko ? `코스 파 (${newForm.holes}홀)` : `Course Par (${newForm.holes} holes)`}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { const p = Math.max(54, newForm.coursePar-1); setNewForm(f => ({ ...f, coursePar: p })); setPars(computePars(p, newForm.holes)) }}
                    className="w-10 h-10 rounded-xl font-bold text-lg transition"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>−</button>
                  <div className="flex-1 text-center rounded-xl py-2"
                    style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <span className="text-2xl font-black text-white">Par {newForm.coursePar}</span>
                  </div>
                  <button
                    onClick={() => { const p = Math.min(80, newForm.coursePar+1); setNewForm(f => ({ ...f, coursePar: p })); setPars(computePars(p, newForm.holes)) }}
                    className="w-10 h-10 rounded-xl font-bold text-lg transition"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>+</button>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                  {ko ? '메모 (선택)' : 'Notes (optional)'}
                </label>
                <input value={newForm.notes}
                  onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.12)', color: '#fff' }}
                  placeholder={ko ? '동반자, 날씨 등...' : 'Playing partners, weather...'} />
              </div>
            </div>

            {/* 에러 메시지 */}
            {createError && (
              <div className="flex-shrink-0 px-5 pb-2">
                <div className="rounded-xl px-4 py-2.5" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="text-red-400 text-sm">⚠ {createError}</p>
                </div>
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="flex-shrink-0 px-5 py-4 flex gap-3"
              style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
              <button onClick={() => { setShowNew(false); resetNewForm() }}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button
                onClick={createRound}
                disabled={creating || !newForm.courseName || (needsSubCourse && !subCourse)}
                className="flex-1 py-3.5 rounded-xl font-black text-sm disabled:opacity-40 transition"
                style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    {ko ? '생성 중...' : 'Creating...'}
                  </span>
                ) : needsSubCourse && !subCourse ? (
                  ko ? '코스 선택 필요' : 'Select course'
                ) : (
                  ko ? '🏌️ 라운드 시작' : '🏌️ Start Round'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scorecard View ────────────────────────────────────────────────────────
function ScorecardView({
  round, localHoles, setLocalHoles, editHole, setEditHole,
  outHoles, inHoles, totalHoles, holeData, sumScores, sumPars,
  outScore, inScore, total, outPar, inPar, totalPar,
  filled, saving, ko, lang, onBack, onSave, onDelete,
  showParEdit, setShowParEdit,
}: any) {

  const diff = filled === totalHoles ? total - totalPar : null

  function ScoreTable({ holes, label }: { holes: number[]; label: string }) {
    const sTotal     = sumScores(holes)
    const pTotal     = sumPars(holes)
    const filledHoles = holes.filter((h: number) => localHoles[h]?.score !== null).length
    const hasYardage  = holes.some((h: number) => localHoles[h]?.yardage)
    return (
      <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(34,197,94,0.12)' }}>
        <table className="min-w-max w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'rgba(22,163,74,0.08)' }}>
              <th className="sticky left-0 px-2 py-2 text-left w-12 font-semibold"
                style={{ background: 'rgba(12,22,12,0.95)', color: '#3a5a3a', borderRight: '1px solid rgba(34,197,94,0.1)' }}>
                {ko ? '홀' : 'Hole'}
              </th>
              {holes.map((h: number) => (
                <th key={h} className="px-1.5 py-2 text-center w-9 font-semibold" style={{ color: '#5a7a5a' }}>{h}</th>
              ))}
              <th className="px-2 py-2 text-center w-12 font-bold" style={{ color: '#22c55e', borderLeft: '1px solid rgba(34,197,94,0.1)' }}>{label}</th>
            </tr>
          </thead>
          <tbody>
            {/* 야디지 행 */}
            {hasYardage && (
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                <td className="sticky left-0 px-2 py-1.5 font-semibold text-left text-[10px]"
                  style={{ background: 'rgba(12,22,12,0.95)', color: '#3a5a3a', borderRight: '1px solid rgba(34,197,94,0.1)' }}>
                  {ko ? '야드' : 'Yds'}
                </td>
                {holes.map((h: number) => (
                  <td key={h} className="px-1.5 py-1.5 text-center text-[10px]" style={{ color: '#3a5a3a' }}>
                    {localHoles[h]?.yardage ?? ''}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center text-[10px]"
                  style={{ color: '#3a5a3a', borderLeft: '1px solid rgba(34,197,94,0.1)' }}>
                  {holes.reduce((s: number, h: number) => s + (localHoles[h]?.yardage ?? 0), 0) || ''}
                </td>
              </tr>
            )}
            {/* 파 행 */}
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <td className="sticky left-0 px-2 py-2 font-semibold text-left"
                style={{ background: 'rgba(12,22,12,0.95)', color: '#3a5a3a', borderRight: '1px solid rgba(34,197,94,0.1)' }}>
                {ko ? '파' : 'Par'}
              </td>
              {holes.map((h: number) => (
                <td key={h} className="px-1.5 py-2 text-center font-medium" style={{ color: '#6b7280' }}>
                  {holeData(h).par}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-bold" style={{ color: '#22c55e', borderLeft: '1px solid rgba(34,197,94,0.1)' }}>{pTotal}</td>
            </tr>
            {/* 스코어 행 */}
            <tr>
              <td className="sticky left-0 px-2 py-2 font-semibold text-left"
                style={{ background: 'rgba(6,10,6,0.98)', color: '#3a5a3a', borderRight: '1px solid rgba(34,197,94,0.1)' }}>
                {ko ? '타' : 'Score'}
              </td>
              {holes.map((h: number) => {
                const { score, par } = holeData(h)
                return (
                  <td key={h} className="px-0.5 py-1" onClick={() => setEditHole(h)}>
                    <span className={`flex items-center justify-center w-8 h-8 mx-auto rounded-lg text-xs font-bold cursor-pointer transition active:scale-90 ${scoreColor(score, par)}`}>
                      {score ?? '—'}
                    </span>
                  </td>
                )
              })}
              <td className="px-2 py-2 text-center" style={{ borderLeft: '1px solid rgba(34,197,94,0.1)' }}>
                {filledHoles === holes.length ? (
                  <span className={`text-sm font-black ${sTotal - pTotal > 0 ? 'text-red-300' : sTotal - pTotal < 0 ? 'text-green-300' : 'text-yellow-300'}`}>
                    {sTotal}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#3a5a3a' }}>{filledHoles}/{holes.length}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg, #060d06)' }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3">
        <button onClick={onBack} className="text-gray-400 p-1"><ChevronLeft size={22} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white truncate">{round.course_name}</p>
          <p className="text-xs" style={{ color: '#3a5a3a' }}>{round.played_at} · Par {round.course_par} · {round.total_holes}H</p>
        </div>
        <button onClick={onDelete} className="p-2 rounded-xl transition"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="px-4 space-y-3">
        <ScoreTable holes={outHoles} label="OUT" />
        {inHoles.length > 0 && <ScoreTable holes={inHoles} label="IN" />}

        {/* 합계 */}
        <div className="rounded-2xl p-4"
          style={{ background: diff !== null ? 'linear-gradient(135deg,rgba(22,163,74,0.12),rgba(6,13,6,0.97))' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.18)' }}>
          <div className="flex items-center justify-between">
            <div>
              {inHoles.length > 0 && (
                <div className="flex gap-4 text-xs mb-1" style={{ color: '#5a7a5a' }}>
                  <span>OUT <span className="text-white font-bold">{outScore || '—'}</span></span>
                  <span>IN <span className="text-white font-bold">{inScore || '—'}</span></span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-white">
                  {filled === totalHoles ? total : `${filled}/${totalHoles}`}
                </span>
                {diff !== null && (
                  <span className={`text-xl font-black ${diff > 0 ? 'text-red-300' : diff < 0 ? 'text-green-300' : 'text-yellow-300'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </span>
                )}
              </div>
              {diff !== null && (
                <p className="text-xs mt-0.5" style={{ color: '#5a7a5a' }}>{scoreLabel(total, totalPar, ko)}</p>
              )}
            </div>
            <div className="text-right text-xs space-y-0.5" style={{ color: '#3a5a3a' }}>
              <p>Par {totalPar}</p>
              <p>{filled}/{totalHoles} {ko ? '홀' : 'holes'}</p>
            </div>
          </div>
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {[
            { label: ko ? '이글+' : 'Eagle+', cls: 'bg-indigo-700 text-yellow-200' },
            { label: ko ? '버디'  : 'Birdie', cls: 'bg-blue-600 text-white' },
            { label: ko ? '파'    : 'Par',    cls: 'bg-green-700 text-white' },
            { label: ko ? '보기'  : 'Bogey',  cls: 'bg-yellow-600 text-white' },
            { label: ko ? '더블'  : 'Dbl',    cls: 'bg-orange-600 text-white' },
            { label: ko ? '트리플+' : 'Tri+', cls: 'bg-red-700 text-white' },
          ].map(({ label, cls }) => (
            <span key={label} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>
          ))}
        </div>

        {/* 저장 */}
        <button onClick={onSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm disabled:opacity-50 transition"
          style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 14px rgba(22,163,74,0.25)' }}>
          <Save size={15} />
          {saving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '스코어카드 저장' : 'Save Scorecard')}
        </button>
      </div>

      {/* 홀 입력 모달 */}
      {editHole !== null && editHole > 0 && (
        <HoleEditModal
          hole={editHole}
          data={localHoles[editHole] ?? { score: null, par: 4, putts: null, yardage: null }}
          ko={ko}
          onClose={() => setEditHole(null)}
          onChange={(score: number|null, putts: number|null, par: number, yardage: number|null) => {
            setLocalHoles((prev: any) => ({ ...prev, [editHole]: { score, par, putts, yardage } }))
            setEditHole(null)
          }}
        />
      )}
    </div>
  )
}

// ── 홀 입력 모달 ──────────────────────────────────────────────────────────
function HoleEditModal({ hole, data, ko, onClose, onChange }: {
  hole: number
  data: { score: number|null; par: number; putts: number|null; yardage: number|null }
  ko: boolean; onClose: () => void
  onChange: (score: number|null, putts: number|null, par: number, yardage: number|null) => void
}) {
  const [score,   setScore]   = useState<number|null>(data.score)
  const [putts,   setPutts]   = useState<number|null>(data.putts)
  const [par,     setPar]     = useState(data.par)
  const [yardage, setYardage] = useState<string>(data.yardage != null ? String(data.yardage) : '')
  const diff = score !== null ? score - par : null

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full rounded-t-3xl px-5 pt-4 pb-10"
        style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.15)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(34,197,94,0.2)' }} />
        </div>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xl font-black text-white">{ko ? `${hole}번 홀` : `Hole ${hole}`}</p>
            <p className="text-xs" style={{ color: '#3a5a3a' }}>Par {par}</p>
          </div>
          {diff !== null && (
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${scoreColor(score, par)}`}>
              {diff === 0 ? 'Par' : diff > 0 ? `+${diff}` : diff} · {scoreLabel(score, par, ko)}
            </span>
          )}
        </div>

        {/* 파 선택 */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '파' : 'Par'}</p>
          <div className="flex gap-2">
            {[3,4,5].map(p => (
              <button key={p} onClick={() => setPar(p)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition"
                style={par === p
                  ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.1)' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 타수 */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '타수' : 'Score'}</p>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setScore(s => s !== null ? Math.max(1, s-1) : par-1)}
              className="w-12 h-12 rounded-xl text-xl font-bold transition"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>−</button>
            <span className={`flex-1 text-center text-3xl font-black rounded-xl py-2.5 ${score !== null ? scoreColor(score, par) : 'text-gray-600 bg-gray-800/50'}`}>
              {score ?? '—'}
            </span>
            <button onClick={() => setScore(s => s !== null ? s+1 : par+1)}
              className="w-12 h-12 rounded-xl text-xl font-bold transition"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>+</button>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-center">
            {[par-2, par-1, par, par+1, par+2, par+3].filter(v => v >= 1).map(v => (
              <button key={v} onClick={() => setScore(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${score === v ? scoreColor(v, par) : ''}`}
                style={score === v ? {} : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a' }}>
                {v - par === 0 ? 'P' : v - par > 0 ? `+${v-par}` : v-par}
              </button>
            ))}
          </div>
        </div>

        {/* 야디지 + 퍼트 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* 야디지 */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#5a7a5a' }}>
              {ko ? '야디지 (선택)' : 'Yardage (opt)'}
            </p>
            <input
              type="number" min="50" max="999" value={yardage}
              onChange={e => setYardage(e.target.value)}
              placeholder={ko ? '예: 385' : 'e.g. 385'}
              className="w-full text-center py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.15)', color: '#fff' }}
            />
          </div>
          {/* 퍼트 */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '퍼트 (선택)' : 'Putts (opt)'}</p>
            <div className="flex gap-1">
              {([null, 1, 2, 3, 4] as const).map(p => (
                <button key={String(p)} onClick={() => setPutts(p)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition"
                  style={putts === p
                    ? { background: 'rgba(59,130,246,0.25)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.1)' }}>
                  {p === null ? '—' : p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#6b7280' }}>
            {ko ? '취소' : 'Cancel'}
          </button>
          <button
            onClick={() => onChange(score, putts, par, yardage ? parseInt(yardage) : null)}
            className="flex-1 py-3.5 rounded-xl font-black text-sm"
            style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }}>
            {ko ? '확인' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
