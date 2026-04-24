'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Save, X,
  Flag, BarChart2, Calendar, Search, CheckCircle2, Pencil,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── 국가 감지 ─────────────────────────────────────────────────────────────
type CountryKey = 'Vietnam' | 'Korea' | 'Indonesia' | 'Other'

// ── 하드코딩된 골프장 목록 ──────────────────────────────────────────────────
const BUILTIN_COURSES: {
  id: string; name: string; name_vn: string | null; province: string;
  holes: number; par: number; distance_km: number | null; sub_courses: string | null
}[] = [
  { id: '_tsn',  name: 'Tan Son Nhat Golf Course',          name_vn: 'Sân Golf Tân Sơn Nhất',               province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 6,   sub_courses: 'A코스,B코스,C코스,D코스'         },
  { id: '_ssg',  name: 'Saigon South Golf Club',            name_vn: 'Sân Golf Nam Sài Gòn',                province: 'Ho Chi Minh City', holes: 9,  par: 36,  distance_km: 8,   sub_courses: null                              },
  { id: '_vgcc', name: 'Vietnam Golf & Country Club',       name_vn: 'Sân Golf & Country Club Việt Nam',    province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 20,  sub_courses: 'West Course,East Course'         },
  { id: '_vpl',  name: 'Vinpearl Golf Léman Cu Chi',        name_vn: 'Sân Golf Vinpearl Golf Léman Củ Chi', province: 'Ho Chi Minh City', holes: 36, par: 144, distance_km: 35,  sub_courses: 'North Course,South Course'       },
  { id: '_sbg',  name: 'Song Be Golf Resort',               name_vn: 'Sân Golf Song Bé',                    province: 'Binh Duong',       holes: 27, par: 108, distance_km: 15,  sub_courses: 'Lotus,Palm,Desert'               },
  { id: '_tdg',  name: 'Twin Doves Golf Club',              name_vn: 'Sân Golf Twin Doves',                 province: 'Binh Duong',       holes: 27, par: 108, distance_km: 35,  sub_courses: 'Luna,Stella,Sole'                },
  { id: '_hmg',  name: 'Harmonie Golf Park',                name_vn: 'Sân Golf Harmonie',                   province: 'Binh Duong',       holes: 18, par: 72,  distance_km: 35,  sub_courses: null                              },
  { id: '_ltg',  name: 'Long Thanh Golf Club',              name_vn: 'Sân Golf Long Thành',                 province: 'Dong Nai',         holes: 36, par: 144, distance_km: 36,  sub_courses: 'Hill Course,Lake Course'         },
  { id: '_dng',  name: 'Dong Nai Golf Resort',              name_vn: 'Sân Golf Đồng Nai (Bò Chang)',        province: 'Dong Nai',         holes: 27, par: 108, distance_km: 50,  sub_courses: 'A코스,B코스,C코스'               },
  { id: '_ecc',  name: 'Emerald Country Club',              name_vn: 'Sân Golf Emerald Country Club',        province: 'Dong Nai',         holes: 18, par: 72,  distance_km: 40,  sub_courses: null                              },
  { id: '_rla',  name: 'Royal Long An Golf & Country Club', name_vn: 'Sân Golf Royal Long An',               province: 'Long An',          holes: 27, par: 108, distance_km: 50,  sub_courses: 'Desert,Forest,Lake'              },
  { id: '_wlg',  name: 'West Lakes Golf & Villas',          name_vn: 'Sân Golf West Lakes',                  province: 'Long An',          holes: 18, par: 72,  distance_km: 52,  sub_courses: null                              },
  { id: '_vtg',  name: 'Vung Tau Paradise Golf Resort',     name_vn: 'Sân Golf Vũng Tàu Paradise',           province: 'Ba Ria-Vung Tau',  holes: 27, par: 108, distance_km: 125, sub_courses: 'A코스,B코스,C코스'               },
  { id: '_scg',  name: 'Sonadezi Chau Duc Golf Course',     name_vn: 'Sân Golf Sonadezi Châu Đức',           province: 'Ba Ria-Vung Tau',  holes: 36, par: 144, distance_km: 90,  sub_courses: 'Resort Course,Tournament Course' },
  { id: '_blf',  name: 'The Bluffs Grand Ho Tram Strip',    name_vn: 'Sân Golf The Bluffs Hồ Tràm',          province: 'Ba Ria-Vung Tau',  holes: 18, par: 71,  distance_km: 130, sub_courses: null                              },
  { id: '_pga',  name: 'PGA NovaWorld Phan Thiet',          name_vn: 'Sân Golf PGA NovaWorld Phan Thiết',    province: 'Binh Thuan',       holes: 36, par: 144, distance_km: 200, sub_courses: 'Ocean Course,Garden Course'      },
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
function parseSubCourses(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}
const CUSTOM_KEY = '__custom__'

function getSubCourseCombos(courseHoles: number, playHoles: number, subCoursesRaw?: string | null) {
  const subs = parseSubCourses(subCoursesRaw)
  function name(i: number) { return subs[i] ?? String.fromCharCode(65 + i) + '코스' }
  function combo2(i: number, j: number) { return `${name(i)}+${name(j)}` }
  const customBtn = { key: CUSTOM_KEY, label: '✏️ 직접입력' }
  if (courseHoles === 27 && playHoles === 18) return [
    { key: '01', label: combo2(0,1) }, { key: '12', label: combo2(1,2) }, { key: '20', label: combo2(2,0) },
    customBtn,
  ]
  if (courseHoles === 27 && playHoles === 9) return [
    { key: '0', label: name(0) }, { key: '1', label: name(1) }, { key: '2', label: name(2) },
    customBtn,
  ]
  if (courseHoles === 36 && playHoles === 18) return [
    { key: '01', label: combo2(0,1) }, { key: '23', label: combo2(2,3) },
    { key: '12', label: combo2(1,2) }, { key: '03', label: combo2(0,3) },
    customBtn,
  ]
  if (courseHoles === 36 && playHoles === 9) return [
    { key: '0', label: name(0) }, { key: '1', label: name(1) },
    { key: '2', label: name(2) }, { key: '3', label: name(3) },
    customBtn,
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
function scoreInfo(score: number | null, par: number) {
  if (score === null) return { bg: 'rgba(55,65,55,0.5)', text: '#4a6a4a', border: 'transparent', label: '', shape: 'square' }
  const d = score - par
  if (d <= -2) return { bg: '#3730a3', text: '#fde68a', border: '#6366f1',   label: '이글+', shape: 'circle' }
  if (d === -1) return { bg: '#1d4ed8', text: '#fff',    border: '#3b82f6',   label: '버디',  shape: 'circle' }
  if (d === 0)  return { bg: '#15803d', text: '#fff',    border: '#22c55e',   label: '파',    shape: 'square' }
  if (d === 1)  return { bg: '#a16207', text: '#fff',    border: '#eab308',   label: '보기',  shape: 'square' }
  if (d === 2)  return { bg: '#c2410c', text: '#fff',    border: '#f97316',   label: '더블',  shape: 'double-square' }
  return           { bg: '#991b1b', text: '#fff',    border: '#ef4444',   label: '트리플+', shape: 'double-square' }
}

function calcStats(rounds: any[]) {
  const completed = rounds.filter(r => r.total_score)
  if (!completed.length) return null
  const scores = completed.map(r => r.total_score)
  return {
    count:  rounds.length,
    best:   Math.min(...scores),
    avg:    Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
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
  const [loading,       setLoading]       = useState(true)

  // new round
  const [showNew,           setShowNew]           = useState(false)
  const [courses,           setCourses]           = useState<any[]>(BUILTIN_COURSES)
  const [newForm,           setNewForm]           = useState({
    courseName: '', courseId: '', coursePar: 72, holes: 18,
    playedAt: new Date().toISOString().split('T')[0], notes: '',
  })
  const [creating,          setCreating]          = useState(false)
  const [createError,       setCreateError]       = useState('')
  const [selectedCourseObj, setSelectedCourseObj] = useState<any>(null)
  const [subCourse,         setSubCourse]         = useState<string>('')
  const [cpSearch,          setCpSearch]          = useState('')
  const [selCountry,        setSelCountry]        = useState<string>('all')
  const [selProvince,       setSelProvince]       = useState<string>('all')
  const [customSubCourse,   setCustomSubCourse]   = useState('')

  // 코스명 수정
  const [editingName,     setEditingName]     = useState(false)
  const [editNameValue,   setEditNameValue]   = useState('')
  const [editNameSaving,  setEditNameSaving]  = useState(false)
  // 서브코스 조합 선택용 (코스명 수정 시트에서)
  const [editSubCourse,   setEditSubCourse]   = useState('')
  const [editCustomSub,   setEditCustomSub]   = useState('')

  // scorecard
  const [localHoles, setLocalHoles] = useState<Record<number, { score: number|null; par: number; putts: number|null; yardage: number|null }>>({})
  const [editHole,   setEditHole]   = useState<number | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [fineToast,  setFineToast]  = useState<string | null>(null)

  // ── filters ──────────────────────────────────────────────────────────
  const availableCountries = useMemo(() => {
    const keys = new Set<string>()
    courses.forEach(c => keys.add(detectCountry(c.province)))
    return (['Vietnam','Korea','Indonesia','Other'] as CountryKey[]).filter(k => keys.has(k))
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

  const subCourseCombos = useMemo(() => {
    if (!selectedCourseObj) return []
    return getSubCourseCombos(selectedCourseObj.holes, newForm.holes, selectedCourseObj.sub_courses)
  }, [selectedCourseObj, newForm.holes])

  const needsSubCourse = subCourseCombos.length > 0

  // ── loaders ───────────────────────────────────────────────────────────
  async function loadRounds() {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const { data } = await createClient().from('personal_rounds')
      .select('*').eq('user_id', user.id).order('played_at', { ascending: false })
    setRounds(data ?? [])
    setLoading(false)
  }

  async function loadHoles(roundId: string, totalHoles: number, coursePar: number) {
    const { data } = await createClient().from('personal_round_holes')
      .select('*').eq('round_id', roundId).order('hole_number')
    const computedPars = computePars(coursePar, totalHoles)
    const local: Record<number, { score: number|null; par: number; putts: number|null; yardage: number|null }> = {}
    for (let i = 1; i <= totalHoles; i++) {
      const row = data?.find(h => h.hole_number === i)
      local[i] = row
        ? { score: row.score, par: row.par, putts: row.putts ?? null, yardage: row.yardage ?? null }
        : { score: null, par: computedPars[i-1], putts: null, yardage: null }
    }
    setLocalHoles(local)
  }

  async function loadCourses() {
    if (courses.some(c => !String(c.id).startsWith('_'))) return
    const { data } = await createClient().from('golf_courses')
      .select('id, name, name_vn, province, par, holes, distance_km, sub_courses')
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
    await loadHoles(round.id, round.total_holes, round.course_par)
    setView('card')
  }

  function handleSelectCourse(c: any) {
    setSelectedCourseObj(c); setSubCourse(''); setCreateError('')
    const adjustedPar = c.holes > newForm.holes
      ? Math.round(c.par * newForm.holes / c.holes) : (c.par ?? 72)
    setNewForm(f => ({ ...f, courseName: c.name, courseId: c.id, coursePar: adjustedPar }))
    setCpSearch('')
  }

  async function createRound() {
    if (!user || !newForm.courseName) return
    if (needsSubCourse && !subCourse) {
      setCreateError(ko ? '어떤 코스를 도는지 선택해주세요' : 'Please select which course to play')
      return
    }
    if (needsSubCourse && subCourse === CUSTOM_KEY && !customSubCourse.trim()) {
      setCreateError(ko ? '코스 이름을 직접 입력해주세요' : 'Please enter the course name')
      return
    }
    setCreating(true); setCreateError('')
    const subCourseLabel = subCourse === CUSTOM_KEY
      ? customSubCourse.trim()
      : (subCourseCombos.find(c => c.key === subCourse)?.label ?? subCourse)
    const finalCourseName = subCourse ? `${newForm.courseName} (${subCourseLabel})` : newForm.courseName
    const courseId = (newForm.courseId && !String(newForm.courseId).startsWith('_')) ? newForm.courseId : null
    const supabase = createClient()
    const { data: round, error } = await supabase.from('personal_rounds').insert({
      user_id: user.id, course_id: courseId, course_name: finalCourseName,
      course_par: newForm.coursePar, total_holes: newForm.holes,
      played_at: newForm.playedAt, notes: newForm.notes || null,
    }).select().single()
    if (error) { setCreateError(error.message); setCreating(false); return }
    if (round) {
      const computedPars = computePars(newForm.coursePar, newForm.holes)
      await supabase.from('personal_round_holes').insert(
        Array.from({ length: newForm.holes }, (_, i) => ({
          round_id: round.id, hole_number: i + 1, par: computedPars[i], score: null,
        }))
      )
      setShowNew(false); resetNewForm(); await loadRounds(); await openRound(round)
    }
    setCreating(false)
  }

  function resetNewForm() {
    setNewForm({ courseName: '', courseId: '', coursePar: 72, holes: 18, playedAt: new Date().toISOString().split('T')[0], notes: '' })
    setCpSearch(''); setSelCountry('all'); setSelProvince('all')
    setSelectedCourseObj(null); setSubCourse(''); setCustomSubCourse(''); setCreateError('')
  }

  async function saveCard() {
    if (!selectedRound) return
    setSaving(true)
    const supabase = createClient()
    const entries = Object.entries(localHoles)
    for (const [holeStr, hd] of entries) {
      await supabase.from('personal_round_holes').upsert(
        { round_id: selectedRound.id, hole_number: parseInt(holeStr), par: hd.par, score: hd.score, putts: hd.putts, yardage: hd.yardage ?? null },
        { onConflict: 'round_id,hole_number' }
      )
    }
    const filled = entries.filter(([, hd]) => hd.score !== null)
    const total = filled.length === selectedRound.total_holes
      ? filled.reduce((s, [, hd]) => s + (hd.score ?? 0), 0) : null
    await supabase.from('personal_rounds').update({ total_score: total }).eq('id', selectedRound.id)
    const { data } = await supabase.from('personal_rounds').select('*').eq('id', selectedRound.id).single()
    if (data) setSelectedRound(data)
    setSaving(false)
    await loadRounds()
    // 핸디오버 벌금
    try {
      if (total !== null && currentClubId && user) {
        const [{ data: clubData }, { data: membership }] = await Promise.all([
          supabase.from('clubs').select('fine_handicap_per_stroke,fine_handicap_max,currency').eq('id', currentClubId).single(),
          supabase.from('club_memberships').select('club_handicap').eq('club_id', currentClubId).eq('user_id', user.id).maybeSingle(),
        ])
        const perStroke = clubData?.fine_handicap_per_stroke
        const maxFine   = clubData?.fine_handicap_max ?? null
        const handicap  = membership?.club_handicap ?? null
        const currency  = clubData?.currency ?? 'KRW'
        const sym       = CURRENCY_SYMBOL[currency] ?? '₩'
        if (perStroke && handicap !== null) {
          const allowed = selectedRound.course_par + handicap
          if (total > allowed) {
            const over = total - allowed
            const fine = maxFine !== null ? Math.min(over * perStroke, maxFine) : over * perStroke
            await supabase.from('finance_transactions').insert({
              club_id: currentClubId, type: 'fine', amount: fine, currency,
              description: ko ? `핸디오버 벌금 (+${over}타)` : `Handicap-over fine (+${over} strokes)`,
              transaction_date: selectedRound.played_at, recorded_by: user.id, member_id: user.id,
            })
            setFineToast(ko ? `벌금 ${sym}${fine.toLocaleString()} 자동 부과 (+${over}타)` : `Fine ${sym}${fine.toLocaleString()} (+${over} strokes)`)
          } else {
            setFineToast(ko ? '핸디오버 없음 ✓' : 'No fine ✓')
          }
          setTimeout(() => setFineToast(null), 3000)
        }
      }
    } catch { /* ignore */ }
  }

  // ── 코스명(서브코스) 수정 ────────────────────────────────────────────────
  function openEditName() {
    setEditNameValue(selectedRound?.course_name ?? '')
    setEditSubCourse('')
    setEditCustomSub('')
    setEditingName(true)
  }

  async function saveCourseName() {
    if (!selectedRound) return
    // 서브코스 조합이 선택된 경우 조합 라벨을 이름에 반영
    let finalName = editNameValue.trim()
    if (editSubCourse) {
      // 기존 괄호 부분 제거 후 새 조합 추가
      const baseName = finalName.replace(/\s*\(.*\)\s*$/, '').trim()
      const subLabel = editSubCourse === CUSTOM_KEY
        ? editCustomSub.trim()
        : (editSubCombos.find(c => c.key === editSubCourse)?.label ?? editSubCourse)
      finalName = subLabel ? `${baseName} (${subLabel})` : baseName
    }
    if (!finalName) return
    setEditNameSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('personal_rounds')
      .update({ course_name: finalName })
      .eq('id', selectedRound.id)
      .select().single()
    if (data) {
      setSelectedRound(data)
      setRounds(prev => prev.map(r => r.id === data.id ? data : r))
    }
    setEditNameSaving(false)
    setEditingName(false)
  }

  // 현재 라운드의 원본 코스 찾기 (서브코스 조합 피커용)
  const editBaseCourse = useMemo(() => {
    if (!selectedRound) return null
    // course_name에서 괄호 이전 부분으로 매칭
    const baseName = selectedRound.course_name?.replace(/\s*\(.*\)\s*$/, '').trim() ?? ''
    return courses.find(c => c.name === baseName || c.name === selectedRound.course_name) ?? null
  }, [selectedRound, courses])

  const editSubCombos = useMemo(() => {
    if (!editBaseCourse) return []
    return getSubCourseCombos(editBaseCourse.holes, selectedRound?.total_holes ?? 18, editBaseCourse.sub_courses)
  }, [editBaseCourse, selectedRound])

  async function deleteRound(roundId: string) {
    if (!confirm(ko ? '이 라운드를 삭제하시겠습니까?' : 'Delete this round?')) return
    await createClient().from('personal_rounds').delete().eq('id', roundId)
    if (view === 'card') { setView('list'); setSelectedRound(null); setLocalHoles({}) }
    loadRounds()
  }

  // ── computed ──────────────────────────────────────────────────────────
  const totalHoles = selectedRound?.total_holes ?? 18
  const outHoles   = Array.from({ length: 9 }, (_, i) => i + 1)
  const inHoles    = totalHoles === 18 ? Array.from({ length: 9 }, (_, i) => i + 10) : []
  const holeData   = (n: number) => localHoles[n] ?? { score: null, par: 4, putts: null, yardage: null }
  const sumScores  = (hs: number[]) => hs.reduce((s, h) => s + (localHoles[h]?.score ?? 0), 0)
  const sumPars    = (hs: number[]) => hs.reduce((s, h) => s + (localHoles[h]?.par ?? 4), 0)
  const outScore = sumScores(outHoles), inScore = sumScores(inHoles), total = outScore + inScore
  const outPar   = sumPars(outHoles),   inPar   = sumPars(inHoles),   totalPar = outPar + inPar
  const filledCount = Object.values(localHoles).filter(h => h.score !== null).length
  const stats = calcStats(rounds)

  // ── CARD VIEW ────────────────────────────────────────────────────────
  if (view === 'card' && selectedRound) return (
    <div className="min-h-screen pb-28" style={{ background: '#060d06' }}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 px-4 pt-5 pb-3 flex items-center gap-2"
        style={{ background: 'rgba(6,13,6,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
        <button onClick={() => { setView('list'); setSelectedRound(null); setLocalHoles({}) }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <ChevronLeft size={18} className="text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-black text-white truncate leading-tight">{selectedRound.course_name}</p>
            <button
              onClick={openEditName}
              className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition"
              style={{ background: 'rgba(255,255,255,0.07)' }}
              title={ko ? '코스명 수정' : 'Edit course name'}>
              <Pencil size={11} style={{ color: '#6b7280' }} />
            </button>
          </div>
          <p className="text-[11px]" style={{ color: '#5a7a5a' }}>
            {selectedRound.played_at} · Par {selectedRound.course_par} · {totalHoles}H
          </p>
        </div>
        {/* 진행도 */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-xs font-bold" style={{ color: filledCount === totalHoles ? '#22c55e' : '#5a7a5a' }}>
            {filledCount}/{totalHoles}
          </span>
          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(filledCount/totalHoles)*100}%`, background: 'linear-gradient(90deg,#16a34a,#22c55e)' }} />
          </div>
        </div>
        <button onClick={() => deleteRound(selectedRound.id)}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* ── 스코어카드 테이블 OUT ── */}
        <ScoreTable
          holes={outHoles} label="OUT" localHoles={localHoles}
          holeData={holeData} sumScores={sumScores} sumPars={sumPars}
          onTapHole={setEditHole} ko={ko} />
        {/* ── 스코어카드 테이블 IN ── */}
        {inHoles.length > 0 && (
          <ScoreTable
            holes={inHoles} label="IN" localHoles={localHoles}
            holeData={holeData} sumScores={sumScores} sumPars={sumPars}
            onTapHole={setEditHole} ko={ko} />
        )}

        {/* ── 합계 카드 ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg,rgba(22,163,74,0.1),rgba(6,13,6,0.98))', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="px-4 py-4">
            {/* OUT/IN 소계 */}
            {inHoles.length > 0 && (
              <div className="flex gap-6 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#5a7a5a' }}>OUT</p>
                  <p className="text-base font-black text-white">{sumScores(outHoles) || '—'}</p>
                  <p className="text-[10px]" style={{ color: '#3a5a3a' }}>Par {outPar}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#5a7a5a' }}>IN</p>
                  <p className="text-base font-black text-white">{sumScores(inHoles) || '—'}</p>
                  <p className="text-[10px]" style={{ color: '#3a5a3a' }}>Par {inPar}</p>
                </div>
                {/* 퍼트 합계 */}
                <div className="ml-auto text-right">
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#5a7a5a' }}>{ko ? '총 퍼트' : 'Putts'}</p>
                  <p className="text-base font-black" style={{ color: '#60a5fa' }}>
                    {Object.values(localHoles).reduce((s, h) => s + (h.putts ?? 0), 0) || '—'}
                  </p>
                </div>
              </div>
            )}
            {/* 총점 */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: '#5a7a5a' }}>
                  {ko ? '총 스코어' : 'Total Score'}
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-white leading-none">
                    {filledCount === totalHoles ? total : `${filledCount}/${totalHoles}`}
                  </span>
                  {filledCount === totalHoles && (() => {
                    const diff = total - totalPar
                    const col = diff > 0 ? '#fca5a5' : diff < 0 ? '#86efac' : '#fde68a'
                    return (
                      <div>
                        <span className="text-2xl font-black" style={{ color: col }}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: col }}>
                          {(() => {
                            if (diff <= -2) return ko ? '이글이하' : 'Eagle+'
                            if (diff === -1) return ko ? '버디' : 'Birdie'
                            if (diff === 0)  return ko ? '파' : 'Par'
                            if (diff <= 5)   return ko ? `+${diff}` : `+${diff}`
                            return ko ? `+${diff} 오버` : `+${diff} Over`
                          })()}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <div className="text-right text-xs space-y-0.5" style={{ color: '#3a5a3a' }}>
                <p>Par {totalPar}</p>
                <p>{totalHoles}H</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 스코어 범례 ── */}
        <div className="flex flex-wrap gap-1.5 justify-center px-2">
          {[
            { label: ko ? '이글+' : 'Eagle+', bg: '#3730a3', text: '#fde68a' },
            { label: ko ? '버디'  : 'Birdie', bg: '#1d4ed8', text: '#fff' },
            { label: ko ? '파'    : 'Par',    bg: '#15803d', text: '#fff' },
            { label: ko ? '보기'  : 'Bogey',  bg: '#a16207', text: '#fff' },
            { label: ko ? '더블'  : 'Double', bg: '#c2410c', text: '#fff' },
            { label: ko ? '트리플+' : 'Tri+', bg: '#991b1b', text: '#fff' },
          ].map(({ label, bg, text }) => (
            <span key={label} className="text-[10px] px-2.5 py-1 rounded-full font-bold"
              style={{ background: bg, color: text }}>{label}</span>
          ))}
        </div>

        {/* ── 저장 버튼 ── */}
        <button onClick={saveCard} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 20px rgba(22,163,74,0.3)' }}>
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              {ko ? '저장 중...' : 'Saving...'}
            </>
          ) : (
            <><Save size={16} />{ko ? '스코어카드 저장' : 'Save Scorecard'}</>
          )}
        </button>
      </div>

      {/* ── 홀 입력 모달 ── */}
      {editHole !== null && editHole > 0 && (
        <HoleEditModal
          hole={editHole}
          totalHoles={totalHoles}
          data={holeData(editHole)}
          ko={ko}
          onClose={() => setEditHole(null)}
          onNavigate={(n) => setEditHole(n)}
          onChange={(score, putts, par, yardage) => {
            setLocalHoles(prev => ({ ...prev, [editHole]: { score, par, putts, yardage } }))
            setEditHole(null)
          }}
        />
      )}

      {/* 벌금 토스트 */}
      {fineToast && (
        <div className="fixed bottom-24 inset-x-4 flex justify-center z-[300] pointer-events-none">
          <div className="px-5 py-3 rounded-2xl text-sm font-bold text-white shadow-xl text-center"
            style={{ background: 'rgba(22,163,74,0.95)', backdropFilter: 'blur(8px)' }}>
            {fineToast}
          </div>
        </div>
      )}

      {/* ── 코스명 수정 바텀시트 ── */}
      {editingName && (
        <div className="fixed inset-0 z-[250]" onClick={() => setEditingName(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
            style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.18)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}>

            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(34,197,94,0.25)' }} />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
              <div className="flex items-center gap-2">
                <Pencil size={14} className="text-green-400" />
                <h3 className="text-sm font-black text-white">
                  {ko ? '코스 정보 수정' : 'Edit Course Info'}
                </h3>
              </div>
              <button onClick={() => setEditingName(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 현재 코스명 직접 편집 */}
              <div>
                <label className="text-[11px] font-bold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                  {ko ? '코스명 (직접 수정)' : 'Course Name'}
                </label>
                <input
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.2)', outline: 'none' }}
                />
              </div>

              {/* 서브코스 조합 선택 (해당 코스가 27/36홀인 경우) */}
              {editSubCombos.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold mb-2 block" style={{ color: '#f97316' }}>
                    {ko ? '서브코스 조합으로 변경' : 'Change sub-course combo'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {editSubCombos.map(combo => (
                      <button key={combo.key}
                        onClick={() => {
                          setEditSubCourse(prev => prev === combo.key ? '' : combo.key)
                          if (combo.key !== CUSTOM_KEY) setEditCustomSub('')
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold transition"
                        style={editSubCourse === combo.key
                          ? combo.key === CUSTOM_KEY
                            ? { background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', color: '#fff' }
                            : { background: 'linear-gradient(135deg,#d97706,#92400e)', color: '#fff' }
                          : combo.key === CUSTOM_KEY
                            ? { background: 'rgba(139,92,246,0.08)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }
                            : { background: 'rgba(251,146,60,0.08)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                        {editSubCourse === combo.key && combo.key !== CUSTOM_KEY && <CheckCircle2 size={11} className="inline mr-1" />}
                        {combo.label}
                      </button>
                    ))}
                  </div>

                  {/* 직접입력 텍스트란 */}
                  {editSubCourse === CUSTOM_KEY && (
                    <input
                      autoFocus
                      value={editCustomSub}
                      onChange={e => setEditCustomSub(e.target.value)}
                      placeholder={ko ? '예: 솔래+루나' : 'e.g. Sole+Luna'}
                      className="mt-2 w-full rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold"
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)', outline: 'none' }}
                    />
                  )}

                  {/* 미리보기 */}
                  {editSubCourse && editSubCourse !== CUSTOM_KEY && (
                    <p className="text-[11px] mt-1.5 font-semibold" style={{ color: '#22c55e' }}>
                      → {editNameValue.replace(/\s*\(.*\)\s*$/, '').trim()}
                      {' '}({editSubCombos.find(c => c.key === editSubCourse)?.label})
                    </p>
                  )}
                  {editSubCourse === CUSTOM_KEY && editCustomSub.trim() && (
                    <p className="text-[11px] mt-1.5 font-semibold" style={{ color: '#22c55e' }}>
                      → {editNameValue.replace(/\s*\(.*\)\s*$/, '').trim()} ({editCustomSub.trim()})
                    </p>
                  )}
                </div>
              )}

              {/* 저장 버튼 */}
              <div className="flex gap-3 pt-1 pb-2">
                <button onClick={() => setEditingName(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button
                  onClick={saveCourseName}
                  disabled={editNameSaving || !editNameValue.trim() ||
                    (editSubCourse === CUSTOM_KEY && !editCustomSub.trim())}
                  className="flex-1 py-3 rounded-xl text-sm font-black disabled:opacity-40 transition flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }}>
                  {editNameSaving
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{ko ? '저장 중...' : 'Saving...'}</>
                    : <><Save size={14} />{ko ? '저장' : 'Save'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────
  // LIST VIEW
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28" style={{ background: '#060d06' }}>

      {/* 헤더 */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <ChevronLeft size={18} className="text-gray-400" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(22,163,74,0.3),rgba(14,53,29,0.5))' }}>
            <Flag size={14} className="text-green-400" />
          </div>
          <h1 className="text-base font-black text-white">{ko ? '개인 스코어카드' : 'My Scorecard'}</h1>
        </div>
        <button
          onClick={() => { loadCourses(); setShowNew(true) }}
          className="flex items-center gap-1.5 text-xs font-black px-3.5 py-2.5 rounded-xl transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 2px 12px rgba(22,163,74,0.35)' }}>
          <Plus size={13} />{ko ? '새 라운드' : 'New Round'}
        </button>
      </div>

      <div className="px-4 space-y-3">

        {/* 통계 카드 */}
        {stats ? (
          <div className="rounded-2xl p-4"
            style={{ background: 'linear-gradient(135deg,rgba(22,163,74,0.1),rgba(6,13,6,0.98))', border: '1px solid rgba(34,197,94,0.18)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3 flex items-center gap-1.5" style={{ color: '#22c55e' }}>
              <BarChart2 size={11} />{ko ? '내 라운드 통계' : 'My Stats'}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: ko ? '라운드' : 'Rounds', val: stats.count, color: '#e5e7eb' },
                { label: ko ? '최저타' : 'Best',   val: stats.best,  color: '#86efac' },
                { label: ko ? '평균타' : 'Avg',    val: stats.avg,   color: '#fde68a' },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl py-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[10px] mb-1" style={{ color: '#5a7a5a' }}>{label}</p>
                  <p className="text-2xl font-black" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && rounds.length === 0 && (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.08)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(22,163,74,0.08)' }}>
              <Flag size={32} className="text-green-900" />
            </div>
            <p className="text-sm font-bold text-gray-400">{ko ? '아직 라운드 기록이 없습니다' : 'No rounds yet'}</p>
            <p className="text-xs mt-1.5" style={{ color: '#3a5a3a' }}>
              {ko ? '"새 라운드" 버튼으로 첫 라운드를 시작하세요' : 'Tap "New Round" to start'}
            </p>
          </div>
        )}

        {/* 라운드 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {rounds.map(r => {
              const diff = r.total_score ? r.total_score - r.course_par : null
              const diffColor = diff === null ? '#4a6a4a' : diff <= 0 ? '#86efac' : diff <= 5 ? '#fde68a' : '#fca5a5'
              const bgColor   = diff === null ? 'rgba(107,114,128,0.08)' : diff <= 0 ? 'rgba(22,163,74,0.1)' : diff <= 5 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)'
              return (
                <button key={r.id} onClick={() => openRound(r)}
                  className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.1)' }}>
                  {/* 스코어 뱃지 */}
                  <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{ background: bgColor }}>
                    {r.total_score ? (
                      <>
                        <span className="text-base font-black" style={{ color: diffColor }}>{r.total_score}</span>
                        <span className="text-[9px] font-bold" style={{ color: diffColor, opacity: 0.8 }}>
                          {diff! >= 0 ? '+' : ''}{diff}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold" style={{ color: '#4a6a4a' }}>
                        {ko ? '진행' : 'WIP'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{r.course_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
            style={{ maxHeight: '93vh', background: '#0c160c', border: '1px solid rgba(34,197,94,0.18)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}>
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(34,197,94,0.25)' }} />
            </div>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
              <h3 className="text-base font-black text-white">{ko ? '새 라운드 시작' : 'New Round'}</h3>
              <button onClick={() => { setShowNew(false); resetNewForm() }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <X size={14} className="text-gray-400" />
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

              {/* 날짜 + 홀 수 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    <Calendar size={10} className="inline mr-1" />{ko ? '라운드 날짜' : 'Date'}
                  </label>
                  <input type="date" value={newForm.playedAt}
                    onChange={e => setNewForm(f => ({ ...f, playedAt: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-white text-sm"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.15)', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="text-[11px] font-bold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    {ko ? '홀 수' : 'Holes'}
                  </label>
                  <div className="flex gap-2">
                    {[18, 9].map(h => (
                      <button key={h} onClick={() => {
                        const p = selectedCourseObj
                          ? (selectedCourseObj.holes > h ? Math.round(selectedCourseObj.par * h / selectedCourseObj.holes) : selectedCourseObj.par)
                          : (h === 9 ? 36 : 72)
                        setNewForm(f => ({ ...f, holes: h, coursePar: p }))
                        setSubCourse('')
                      }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-black transition"
                        style={newForm.holes === h
                          ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }
                          : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.1)' }}>
                        {h}H
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 골프장 선택 */}
              <div>
                <label className="text-[11px] font-bold mb-2 block" style={{ color: '#5a7a5a' }}>
                  {ko ? '골프장' : 'Golf Course'}
                </label>

                {selectedCourseObj ? (
                  /* 선택된 코스 */
                  <div className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(22,163,74,0.2)' }}>
                      <Flag size={14} className="text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{selectedCourseObj.name}</p>
                      <p className="text-xs" style={{ color: '#5a7a5a' }}>{selectedCourseObj.province}</p>
                    </div>
                    <button onClick={() => { setSelectedCourseObj(null); setNewForm(f => ({ ...f, courseName: '', courseId: '' })); setSubCourse('') }}
                      className="text-xs px-2.5 py-1.5 rounded-lg transition"
                      style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                      {ko ? '변경' : 'Change'}
                    </button>
                  </div>
                ) : (
                  /* 코스 검색 */
                  <>
                    {/* 국가 필터 */}
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {(['all', ...availableCountries] as const).map(k => {
                        const m = COUNTRY_META[k as keyof typeof COUNTRY_META]
                        return (
                          <button key={k} onClick={() => { setSelCountry(k); setSelProvince('all') }}
                            className="text-xs px-2.5 py-1.5 rounded-xl font-semibold transition"
                            style={selCountry === k
                              ? { background: 'rgba(22,163,74,0.25)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                              : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a' }}>
                            {m.flag} {ko ? m.ko : m.en}
                          </button>
                        )
                      })}
                    </div>

                    {/* 지역 필터 */}
                    {availableProvinces.length > 0 && (
                      <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
                        <button onClick={() => setSelProvince('all')}
                          className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-xl font-semibold transition"
                          style={selProvince === 'all'
                            ? { background: 'rgba(22,163,74,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
                            : { background: 'rgba(255,255,255,0.04)', color: '#4a6a4a' }}>
                          {ko ? '전체' : 'All'}
                        </button>
                        {availableProvinces.map(p => (
                          <button key={p} onClick={() => setSelProvince(p)}
                            className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-xl font-semibold transition whitespace-nowrap"
                            style={selProvince === p
                              ? { background: 'rgba(22,163,74,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
                              : { background: 'rgba(255,255,255,0.04)', color: '#4a6a4a' }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 검색 인풋 */}
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a7a5a' }} />
                      <input value={cpSearch} onChange={e => setCpSearch(e.target.value)}
                        placeholder={ko ? '골프장 검색...' : 'Search course...'}
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl text-white text-sm"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.15)' }} />
                    </div>

                    {/* 코스 목록 */}
                    <div className="rounded-xl overflow-hidden" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid rgba(34,197,94,0.1)' }}>
                      {filteredCourses.map((c, i) => (
                        <button key={c.id} onClick={() => handleSelectCourse(c)}
                          className="w-full text-left px-3 py-3 flex items-center gap-3 transition"
                          style={{
                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                            borderBottom: i < filteredCourses.length - 1 ? '1px solid rgba(34,197,94,0.06)' : 'none',
                          }}>
                          <div>
                            <p className="text-sm font-semibold text-white">{c.name}</p>
                            <p className="text-xs" style={{ color: '#5a7a5a' }}>{c.province} · {c.holes}H · Par {c.par}</p>
                          </div>
                        </button>
                      ))}
                      {filteredCourses.length === 0 && (
                        <div className="px-3 py-6 text-center text-xs" style={{ color: '#3a5a3a' }}>
                          {ko ? '검색 결과 없음' : 'No results'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 서브코스 선택 (27/36홀) */}
              {needsSubCourse && selectedCourseObj && (
                <div>
                  <label className="text-[11px] font-bold mb-2 block" style={{ color: '#f97316' }}>
                    {ko ? `어떤 코스를 도실 건가요? (${selectedCourseObj.holes}홀 코스)` : `Which courses? (${selectedCourseObj.holes}H course)`}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {subCourseCombos.map(combo => (
                      <button key={combo.key}
                        onClick={() => { setSubCourse(combo.key); setCreateError(''); if (combo.key !== CUSTOM_KEY) setCustomSubCourse('') }}
                        className="px-3.5 py-2.5 rounded-xl text-sm font-bold transition"
                        style={subCourse === combo.key
                          ? combo.key === CUSTOM_KEY
                            ? { background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', color: '#fff', boxShadow: '0 2px 10px rgba(124,58,237,0.35)' }
                            : { background: 'linear-gradient(135deg,#d97706,#92400e)', color: '#fff', boxShadow: '0 2px 10px rgba(234,88,12,0.3)' }
                          : combo.key === CUSTOM_KEY
                            ? { background: 'rgba(139,92,246,0.08)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }
                            : { background: 'rgba(251,146,60,0.08)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                        {subCourse === combo.key && combo.key !== CUSTOM_KEY && <CheckCircle2 size={12} className="inline mr-1" />}
                        {combo.label}
                      </button>
                    ))}
                  </div>

                  {/* 직접입력 선택 시 텍스트 입력란 */}
                  {subCourse === CUSTOM_KEY && (
                    <div className="mt-2.5">
                      <input
                        autoFocus
                        value={customSubCourse}
                        onChange={e => { setCustomSubCourse(e.target.value); setCreateError('') }}
                        placeholder={ko ? '예: 솔래+루나, 스텔라+루나' : 'e.g. Sole+Luna, Stella+Luna'}
                        className="w-full rounded-xl px-3.5 py-2.5 text-white text-sm font-semibold"
                        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)', outline: 'none' }}
                      />
                      <p className="text-[10px] mt-1.5" style={{ color: '#7c3aed' }}>
                        {ko ? '원하는 코스 조합을 자유롭게 입력하세요' : 'Type any course combination you want'}
                      </p>
                    </div>
                  )}

                  {/* 선택 완료 표시 */}
                  {subCourse && subCourse !== CUSTOM_KEY && (
                    <p className="text-xs mt-1.5 font-semibold" style={{ color: '#22c55e' }}>
                      ✓ {subCourseCombos.find(c => c.key === subCourse)?.label} {ko ? '선택됨' : 'selected'}
                    </p>
                  )}
                  {subCourse === CUSTOM_KEY && customSubCourse.trim() && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: '#22c55e' }}>
                      ✓ {customSubCourse.trim()} {ko ? '입력됨' : 'entered'}
                    </p>
                  )}
                </div>
              )}

              {/* 파 조절 */}
              {newForm.courseName && (
                <div>
                  <label className="text-[11px] font-bold mb-2 block" style={{ color: '#5a7a5a' }}>Par</label>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setNewForm(f => ({ ...f, coursePar: Math.max(54, f.coursePar - 1) }))}
                      className="w-11 h-11 rounded-xl text-xl font-bold transition"
                      style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>−</button>
                    <span className="text-2xl font-black text-white flex-1 text-center">{newForm.coursePar}</span>
                    <button onClick={() => setNewForm(f => ({ ...f, coursePar: Math.min(80, f.coursePar + 1) }))}
                      className="w-11 h-11 rounded-xl text-xl font-bold transition"
                      style={{ background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>+</button>
                  </div>
                </div>
              )}

              {/* 메모 */}
              <div>
                <label className="text-[11px] font-bold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                  {ko ? '메모 (선택)' : 'Notes (optional)'}
                </label>
                <textarea value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder={ko ? '날씨, 동반자 등...' : 'Weather, partners...'}
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(34,197,94,0.12)' }} />
              </div>

              {/* 에러 */}
              {createError && (
                <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                  {createError}
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
              <button onClick={() => { setShowNew(false); resetNewForm() }}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={createRound}
                disabled={creating || !newForm.courseName ||
                  (needsSubCourse && !subCourse) ||
                  (needsSubCourse && subCourse === CUSTOM_KEY && !customSubCourse.trim())}
                className="flex-1 py-3.5 rounded-xl font-black text-sm disabled:opacity-40 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {ko ? '생성 중...' : 'Creating...'}
                  </span>
                ) : needsSubCourse && !subCourse ? (ko ? '코스 선택 필요' : 'Select course')
                  : needsSubCourse && subCourse === CUSTOM_KEY && !customSubCourse.trim() ? (ko ? '코스명 입력 필요' : 'Enter course name')
                  : (ko ? '🏌️ 라운드 시작' : '🏌️ Start Round')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 스코어카드 테이블 컴포넌트 ────────────────────────────────────────────
function ScoreTable({ holes, label, localHoles, holeData, sumScores, sumPars, onTapHole, ko }: {
  holes: number[]; label: string; localHoles: any
  holeData: (n: number) => any; sumScores: (hs: number[]) => number; sumPars: (hs: number[]) => number
  onTapHole: (h: number) => void; ko: boolean
}) {
  const sTotal     = sumScores(holes)
  const pTotal     = sumPars(holes)
  const filledHoles = holes.filter(h => localHoles[h]?.score !== null).length
  const hasYardage  = holes.some(h => localHoles[h]?.yardage)
  const hasPutts    = holes.some(h => localHoles[h]?.putts !== null)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(34,197,94,0.15)' }}>
      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'rgba(22,163,74,0.1)' }}>
              <th className="sticky left-0 px-2.5 py-2.5 text-left font-bold w-12"
                style={{ background: 'rgba(8,18,8,0.98)', color: '#3a5a3a', borderRight: '1px solid rgba(34,197,94,0.1)', minWidth: 44 }}>
                {ko ? '홀' : 'Hole'}
              </th>
              {holes.map(h => (
                <th key={h} className="text-center font-bold" style={{ color: '#5a7a5a', width: 40, minWidth: 40 }}>{h}</th>
              ))}
              <th className="px-2.5 py-2.5 text-center font-black" style={{ color: '#22c55e', borderLeft: '1px solid rgba(34,197,94,0.12)', width: 44, minWidth: 44 }}>{label}</th>
            </tr>
          </thead>
          <tbody>
            {/* 야디지 행 */}
            {hasYardage && (
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                <td className="sticky left-0 px-2.5 py-1.5 font-bold text-[10px]"
                  style={{ background: 'rgba(8,18,8,0.98)', color: '#3a5a3a', borderRight: '1px solid rgba(34,197,94,0.08)' }}>
                  {ko ? '야드' : 'Yds'}
                </td>
                {holes.map(h => (
                  <td key={h} className="text-center py-1.5 text-[10px]" style={{ color: '#3a5a3a' }}>
                    {localHoles[h]?.yardage ?? ''}
                  </td>
                ))}
                <td className="text-center py-1.5 text-[10px]" style={{ color: '#3a5a3a', borderLeft: '1px solid rgba(34,197,94,0.08)' }}>
                  {holes.reduce((s, h) => s + (localHoles[h]?.yardage ?? 0), 0) || ''}
                </td>
              </tr>
            )}
            {/* 파 행 */}
            <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
              <td className="sticky left-0 px-2.5 py-2 font-bold"
                style={{ background: 'rgba(8,18,8,0.98)', color: '#4a6a4a', borderRight: '1px solid rgba(34,197,94,0.08)' }}>
                {ko ? '파' : 'Par'}
              </td>
              {holes.map(h => (
                <td key={h} className="text-center py-2 font-semibold" style={{ color: '#6b7280' }}>
                  {holeData(h).par}
                </td>
              ))}
              <td className="text-center py-2 font-black" style={{ color: '#22c55e', borderLeft: '1px solid rgba(34,197,94,0.08)' }}>{pTotal}</td>
            </tr>
            {/* 스코어 행 */}
            <tr style={{ background: 'rgba(6,13,6,1)' }}>
              <td className="sticky left-0 px-2.5 py-2 font-bold"
                style={{ background: 'rgba(6,10,6,1)', color: '#4a6a4a', borderRight: '1px solid rgba(34,197,94,0.08)' }}>
                {ko ? '타' : 'Score'}
              </td>
              {holes.map(h => {
                const { score, par } = holeData(h)
                const info = scoreInfo(score, par)
                return (
                  <td key={h} className="py-1.5 px-0.5" onClick={() => onTapHole(h)}>
                    <div className="mx-auto flex items-center justify-center font-black text-xs cursor-pointer transition-all active:scale-90"
                      style={{
                        width: 36, height: 36,
                        background: info.bg,
                        color: info.text,
                        border: `2px solid ${info.border}`,
                        borderRadius: info.shape === 'circle' ? '50%' : 8,
                        boxShadow: score !== null ? `0 2px 8px ${info.border}55` : 'none',
                        outline: info.shape === 'double-square' ? `2px solid ${info.border}` : 'none',
                        outlineOffset: info.shape === 'double-square' ? 2 : 0,
                      }}>
                      {score ?? '·'}
                    </div>
                  </td>
                )
              })}
              <td className="text-center py-1.5" style={{ borderLeft: '1px solid rgba(34,197,94,0.08)' }}>
                {filledHoles === holes.length ? (
                  <span className="text-sm font-black"
                    style={{ color: sTotal - pTotal > 0 ? '#fca5a5' : sTotal - pTotal < 0 ? '#86efac' : '#fde68a' }}>
                    {sTotal}
                  </span>
                ) : (
                  <span className="text-xs font-semibold" style={{ color: '#3a5a3a' }}>{filledHoles}/{holes.length}</span>
                )}
              </td>
            </tr>
            {/* 퍼트 행 */}
            {hasPutts && (
              <tr style={{ background: 'rgba(59,130,246,0.04)' }}>
                <td className="sticky left-0 px-2.5 py-1.5 font-bold text-[10px]"
                  style={{ background: 'rgba(6,10,6,0.98)', color: '#3b5f8a', borderRight: '1px solid rgba(34,197,94,0.08)' }}>
                  {ko ? '퍼트' : 'Putts'}
                </td>
                {holes.map(h => (
                  <td key={h} className="text-center py-1.5 text-xs font-bold" style={{ color: localHoles[h]?.putts != null ? '#60a5fa' : '#2a3a4a' }}
                    onClick={() => onTapHole(h)}>
                    {localHoles[h]?.putts ?? '·'}
                  </td>
                ))}
                <td className="text-center py-1.5 text-xs font-black" style={{ color: '#60a5fa', borderLeft: '1px solid rgba(34,197,94,0.08)' }}>
                  {holes.reduce((s, h) => s + (localHoles[h]?.putts ?? 0), 0) || ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 홀 입력 모달 ──────────────────────────────────────────────────────────
function HoleEditModal({ hole, totalHoles, data, ko, onClose, onNavigate, onChange }: {
  hole: number; totalHoles: number
  data: { score: number|null; par: number; putts: number|null; yardage: number|null }
  ko: boolean
  onClose: () => void
  onNavigate: (hole: number) => void
  onChange: (score: number|null, putts: number|null, par: number, yardage: number|null) => void
}) {
  const [score,   setScore]   = useState<number|null>(data.score)
  const [putts,   setPutts]   = useState<number|null>(data.putts)
  const [par,     setPar]     = useState(data.par)
  const [yardage, setYardage] = useState<string>(data.yardage != null ? String(data.yardage) : '')

  const diff = score !== null ? score - par : null
  const info = scoreInfo(score, par)

  // 퍼트 +/- (0~6)
  const incPutts = () => setPutts(p => p === null ? 2 : Math.min(6, p + 1))
  const decPutts = () => setPutts(p => p === null ? 2 : Math.max(0, p - 1))

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full rounded-t-3xl pb-8"
        style={{ background: 'linear-gradient(180deg,#0e1a0e,#060d06)', border: '1px solid rgba(34,197,94,0.18)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}>

        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(34,197,94,0.25)' }} />
        </div>

        {/* 홀 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 mb-1">
          <div>
            <p className="text-2xl font-black text-white leading-none">
              {ko ? `${hole}번 홀` : `Hole ${hole}`}
            </p>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: '#5a7a5a' }}>Par {par}</p>
          </div>
          <div className="flex items-center gap-2">
            {diff !== null && (
              <span className="text-sm font-black px-3 py-1.5 rounded-full"
                style={{ background: info.bg, color: info.text, border: `1px solid ${info.border}` }}>
                {diff === 0 ? 'Par' : diff > 0 ? `+${diff}` : String(diff)} {info.label}
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.07)' }}>
              <X size={14} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="px-5 space-y-4">
          {/* 파 선택 */}
          <div>
            <p className="text-[11px] font-bold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '파 선택' : 'Par'}</p>
            <div className="flex gap-2">
              {[3, 4, 5].map(p => (
                <button key={p} onClick={() => setPar(p)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition"
                  style={par === p
                    ? { background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.1)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 타수 입력 */}
          <div>
            <p className="text-[11px] font-bold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '타수' : 'Score'}</p>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setScore(s => s !== null ? Math.max(1, s - 1) : par)}
                className="w-14 h-14 rounded-2xl text-2xl font-black transition active:scale-90"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>−</button>

              {/* 큰 스코어 디스플레이 */}
              <div className="flex-1 flex items-center justify-center h-16 rounded-2xl"
                style={{ background: score !== null ? info.bg : 'rgba(55,65,55,0.4)', border: `2px solid ${score !== null ? info.border : 'transparent'}` }}>
                <span className="text-4xl font-black" style={{ color: score !== null ? info.text : '#4a6a4a' }}>
                  {score ?? '—'}
                </span>
              </div>

              <button onClick={() => setScore(s => s !== null ? s + 1 : par)}
                className="w-14 h-14 rounded-2xl text-2xl font-black transition active:scale-90"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>+</button>
            </div>

            {/* 빠른 선택 버튼 */}
            <div className="flex gap-1.5 justify-center">
              {[par-2, par-1, par, par+1, par+2, par+3].filter(v => v >= 1).map(v => {
                const delta = v - par
                const si = scoreInfo(v, par)
                const isSelected = score === v
                return (
                  <button key={v} onClick={() => setScore(v)}
                    className="flex-1 py-2 rounded-xl text-xs font-black transition active:scale-95"
                    style={isSelected
                      ? { background: si.bg, color: si.text, border: `1px solid ${si.border}` }
                      : { background: 'rgba(255,255,255,0.05)', color: '#5a7a5a', border: '1px solid rgba(34,197,94,0.08)' }}>
                    {delta === 0 ? 'P' : delta > 0 ? `+${delta}` : delta}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 퍼트 + 야디지 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 퍼트 — +/- 카운터 */}
            <div>
              <p className="text-[11px] font-bold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '퍼트 수' : 'Putts'}</p>
              <div className="flex items-center gap-2">
                <button onClick={decPutts}
                  className="w-10 h-10 rounded-xl text-lg font-black transition active:scale-90"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>−</button>
                <div className="flex-1 h-10 rounded-xl flex items-center justify-center font-black text-lg"
                  style={{ background: putts !== null ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)', color: putts !== null ? '#60a5fa' : '#3a5a3a', border: putts !== null ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent' }}>
                  {putts ?? '—'}
                </div>
                <button onClick={incPutts}
                  className="w-10 h-10 rounded-xl text-lg font-black transition active:scale-90"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>+</button>
              </div>
              {/* 빠른 퍼트 선택 */}
              <div className="flex gap-1 mt-1.5">
                {([null, 1, 2, 3] as const).map(p => (
                  <button key={String(p)} onClick={() => setPutts(p)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition"
                    style={putts === p
                      ? { background: 'rgba(59,130,246,0.25)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#4a6a4a' }}>
                    {p === null ? '—' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* 야디지 */}
            <div>
              <p className="text-[11px] font-bold mb-2" style={{ color: '#5a7a5a' }}>{ko ? '야디지 (선택)' : 'Yardage (opt)'}</p>
              <input type="number" min="50" max="999" value={yardage}
                onChange={e => setYardage(e.target.value)}
                placeholder={ko ? '예: 385' : 'e.g. 385'}
                className="w-full h-10 text-center rounded-xl text-sm font-black"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.15)', color: '#fff' }} />
              <p className="text-[10px] mt-1.5 text-center" style={{ color: '#3a5a3a' }}>yards</p>
            </div>
          </div>

          {/* 홀 네비게이션 + 확인 */}
          <div className="flex gap-2 pt-1">
            {/* 이전 홀 */}
            <button
              onClick={() => onNavigate(hole - 1)}
              disabled={hole <= 1}
              className="w-11 h-12 rounded-xl flex items-center justify-center font-bold transition disabled:opacity-25"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#6b7280' }}>
              <ChevronLeft size={18} />
            </button>

            {/* 확인 */}
            <button onClick={() => onChange(score, putts, par, yardage ? parseInt(yardage) : null)}
              className="flex-1 py-3.5 rounded-xl font-black text-sm transition active:scale-95"
              style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}>
              {ko ? '✓ 확인' : '✓ OK'}
            </button>

            {/* 다음 홀 */}
            <button
              onClick={() => onNavigate(hole + 1)}
              disabled={hole >= totalHoles}
              className="w-11 h-12 rounded-xl flex items-center justify-center font-bold transition disabled:opacity-25"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#6b7280' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 홀 번호 인디케이터 */}
          <div className="flex justify-center gap-1 pb-1">
            {Array.from({ length: totalHoles }, (_, i) => i + 1).map(h => (
              <button key={h} onClick={() => onNavigate(h)}
                className="transition"
                style={{
                  width: h === hole ? 16 : 6, height: 6,
                  borderRadius: h === hole ? 3 : '50%',
                  background: h === hole ? '#22c55e' : 'rgba(34,197,94,0.2)',
                }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
