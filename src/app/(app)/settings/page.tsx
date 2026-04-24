'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Settings, Save, ChevronLeft, MapPin, Plus, Edit2, X,
  ChevronDown, ChevronUp, Search, Database, CheckCircle2, AlertCircle, Copy, Check,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import CourseSearchInput from '@/components/ui/CourseSearchInput'

// ── 골프장 폼 기본값 ──────────────────────────────────────────────────────
const EMPTY_COURSE = {
  name: '', name_vn: '', province: 'Ho Chi Minh City',
  district: '', address: '', holes: 18, par: 72,
  distance_km: '', green_fee_weekday_vnd: '',
  green_fee_weekend_vnd: '', phone: '', website: '', description: '',
  sub_courses: [] as string[],   // 27H/36H용 코스 이름 (예: ['루나','스텔라','솔래'])
}

// 홀 수에 따른 기본 서브코스 이름
function defaultSubCourses(holes: number): string[] {
  if (holes === 27) return ['A코스', 'B코스', 'C코스']
  if (holes === 36) return ['A코스', 'B코스', 'C코스', 'D코스']
  return []
}

const PROVINCES = [
  'Ho Chi Minh City', 'Binh Duong', 'Dong Nai',
  'Long An', 'Ba Ria-Vung Tau', 'Binh Thuan', 'Other',
]

export default function SettingsPage() {
  const router = useRouter()
  const { currentClubId, lang, myClubs, setMyClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  // ── Club settings ─────────────────────────────────────────────────────
  const [club, setClub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: '', name_en: '', currency: 'KRW',
    annual_fee: '', monthly_fee: '',
  })

  // ── Golf courses ──────────────────────────────────────────────────────
  const [courses, setCourses] = useState<any[]>([])
  const [courseSearch, setCourseSearch] = useState('')
  const [showCourseSection, setShowCourseSection] = useState(false)
  const [editCourse, setEditCourse] = useState<any>(null)  // null=closed, {}=new, {...}=edit
  const [courseForm, setCourseForm] = useState({ ...EMPTY_COURSE })
  const [courseSaving, setCourseSaving] = useState(false)
  const [courseError, setCourseError] = useState('')

  // ── 주소 장소 검색 ────────────────────────────────────────────────────
  const [addrOpen,    setAddrOpen]    = useState(false)
  const [addrQ,       setAddrQ]       = useState('')
  const [addrResults, setAddrResults] = useState<any[]>([])
  const [addrLoading, setAddrLoading] = useState(false)

  // 패널 열릴 때 pre-fill된 검색어로 자동 검색
  useEffect(() => {
    if (!addrOpen || addrQ.trim().length < 2) return
    let cancelled = false
    setAddrLoading(true)
    setAddrResults([])
    fetch(`/api/places/search?q=${encodeURIComponent(addrQ)}&near=Vietnam`)
      .then(r => r.json())
      .then(json => { if (!cancelled) setAddrResults(json.results ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAddrLoading(false) })
    return () => { cancelled = true }
  }, [addrOpen])

  useEffect(() => {
    if (!currentClubId) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [{ data: clubData }, { data: courseData }] = await Promise.all([
        supabase.from('clubs').select('*').eq('id', currentClubId).single(),
        supabase.from('golf_courses').select('*').eq('is_active', true).order('distance_km'),
      ])
      if (clubData) {
        setClub(clubData)
        setForm({
          name: clubData.name ?? '',
          name_en: clubData.name_en ?? '',
          currency: clubData.currency ?? 'KRW',
          annual_fee: clubData.annual_fee != null ? String(clubData.annual_fee) : '',
          monthly_fee: clubData.monthly_fee != null ? String(clubData.monthly_fee) : '',
        })
      }
      setCourses(courseData ?? [])
      setLoading(false)
    }
    load()
  }, [currentClubId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!currentClubId || !canManage) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('clubs').update({
      name: form.name,
      name_en: form.name_en || null,
      currency: form.currency,
      annual_fee: form.annual_fee ? parseInt(form.annual_fee) : null,
      monthly_fee: form.monthly_fee ? parseInt(form.monthly_fee) : null,
    }).eq('id', currentClubId)
    setMyClubs(myClubs.map((c) =>
      c.id === currentClubId ? { ...c, name: form.name, name_en: form.name_en } : c
    ))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── Course CRUD ───────────────────────────────────────────────────────
  function openNewCourse() {
    setCourseForm({ ...EMPTY_COURSE })
    setCourseError('')
    setEditCourse({})  // empty object = new
    setAddrOpen(false); setAddrQ(''); setAddrResults([])
  }

  function openEditCourse(course: any) {
    const holes = course.holes ?? 18
    // sub_courses: DB에 저장된 쉼표구분 문자열 → 배열로 변환
    const storedSubs: string[] = course.sub_courses
      ? String(course.sub_courses).split(',').map((s: string) => s.trim()).filter(Boolean)
      : []
    const subCourses = storedSubs.length > 0 ? storedSubs : (holes > 18 ? defaultSubCourses(holes) : [])

    setCourseForm({
      name: course.name ?? '',
      name_vn: course.name_vn ?? '',
      province: course.province ?? 'Ho Chi Minh City',
      district: course.district ?? '',
      address: course.address ?? '',
      holes,
      par: course.par ?? 72,
      distance_km: course.distance_km != null ? String(course.distance_km) : '',
      green_fee_weekday_vnd: course.green_fee_weekday_vnd != null ? String(course.green_fee_weekday_vnd) : '',
      green_fee_weekend_vnd: course.green_fee_weekend_vnd != null ? String(course.green_fee_weekend_vnd) : '',
      phone: course.phone ?? '',
      website: course.website ?? '',
      description: course.description ?? '',
      sub_courses: subCourses,
    })
    setEditCourse(course)
    setCourseError('')
    setAddrOpen(false); setAddrQ(''); setAddrResults([])
  }

  async function saveCourse() {
    if (!courseForm.name.trim()) return
    setCourseError('')
    setCourseSaving(true)
    const supabase = createClient()
    // sub_courses: 배열 → 쉼표구분 문자열로 저장
    const subCoursesStr = courseForm.sub_courses.filter(s => s.trim()).join(',') || null

    const payload: any = {
      name: courseForm.name.trim(),
      name_vn: courseForm.name_vn.trim() || null,
      province: courseForm.province,
      district: courseForm.district.trim() || null,
      address: courseForm.address.trim() || null,
      holes: courseForm.holes,
      par: courseForm.par,
      distance_km: courseForm.distance_km ? parseInt(String(courseForm.distance_km)) : null,
      green_fee_weekday_vnd: courseForm.green_fee_weekday_vnd ? parseInt(String(courseForm.green_fee_weekday_vnd)) : null,
      green_fee_weekend_vnd: courseForm.green_fee_weekend_vnd ? parseInt(String(courseForm.green_fee_weekend_vnd)) : null,
      phone: courseForm.phone.trim() || null,
      website: courseForm.website.trim() || null,
      description: courseForm.description.trim() || null,
      sub_courses: subCoursesStr,
      is_active: true,
      club_id: currentClubId,
    }

    if (editCourse?.id) {
      // 수정 — 존재하지 않는 컬럼 자동 제거 후 재시도
      let updatePayload = { ...payload }
      let updateData: any = null
      let updateError: any = null

      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: d, error: e } = await supabase
          .from('golf_courses').update(updatePayload).eq('id', editCourse.id).select().single()
        if (!e) { updateData = d; break }
        updateError = e
        const msg: string = e.message ?? ''
        if (msg.includes('sub_courses'))  { const { sub_courses: _, ...rest } = updatePayload; updatePayload = rest }
        else if (msg.includes('designer')){ const { designer: _, ...rest } = updatePayload; updatePayload = rest }
        else if (msg.includes('club_id')) { const { club_id: _, ...rest } = updatePayload; updatePayload = rest }
        else break
      }

      if (updateError && !updateData) {
        setCourseError(`저장 실패: ${updateError.message}`)
        setCourseSaving(false)
        return
      }
      if (updateData) setCourses(prev => prev.map(c => c.id === updateData.id ? updateData : c))
    } else {
      // 신규 — DB 컬럼 없을 때 자동으로 해당 필드 제거 후 재시도
      let insertPayload = { ...payload }
      let insertData: any = null
      let insertError: any = null

      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: d, error: e } = await supabase
          .from('golf_courses').insert(insertPayload).select().single()
        if (!e) { insertData = d; break }
        insertError = e
        const msg: string = e.message ?? ''
        // 존재하지 않는 컬럼이면 해당 컬럼 제거 후 재시도
        if (msg.includes('club_id'))     { const { club_id: _, ...rest } = insertPayload; insertPayload = rest }
        else if (msg.includes('sub_courses'))  { const { sub_courses: _, ...rest } = insertPayload; insertPayload = rest }
        else if (msg.includes('designer'))     { const { designer: _, ...rest } = insertPayload; insertPayload = rest }
        else break  // 다른 에러면 중단
      }

      if (insertError && !insertData) {
        setCourseError(`저장 실패: ${insertError.message}`)
        setCourseSaving(false)
        return
      }
      if (insertData) {
        setCourses(prev =>
          [...prev, insertData].sort((a: any, b: any) => (a.distance_km ?? 999) - (b.distance_km ?? 999)))
      }
    }
    setCourseSaving(false)
    setEditCourse(null)
  }

  async function deactivateCourse(id: string) {
    if (!confirm(ko ? '이 골프장을 목록에서 숨기시겠습니까?' : 'Hide this course from the list?')) return
    const supabase = createClient()
    await supabase.from('golf_courses').update({ is_active: false }).eq('id', id)
    setCourses(prev => prev.filter(c => c.id !== id))
  }

  const filteredCourses = courses.filter(c =>
    courseSearch === '' ||
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.name_vn ?? '').toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.province ?? '').toLowerCase().includes(courseSearch.toLowerCase())
  )

  const currencies = [
    { value: 'KRW', label: '원 (₩) - KRW' },
    { value: 'VND', label: '동 (₫) - VND' },
    { value: 'IDR', label: '루피아 (Rp) - IDR' },
  ]
  const currSymbol = form.currency === 'KRW' ? '₩' : form.currency === 'VND' ? '₫' : 'Rp'

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <p className="text-gray-500">{ko ? '로딩 중...' : 'Loading...'}</p>
    </div>
  )

  return (
    <div className="px-4 py-5 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-green-400" />
          <h1 className="text-lg font-bold text-white">{ko ? '클럽 설정' : 'Club Settings'}</h1>
        </div>
      </div>

      {!canManage ? (
        <>
          <div className="glass-card rounded-2xl p-6 text-center mb-4">
            <p className="text-gray-400 text-sm">
              {ko ? '회장 또는 총무만 클럽 설정을 변경할 수 있습니다.' : 'Only president or secretary can modify club settings.'}
            </p>
          </div>
          {club && (
            <div className="glass-card rounded-2xl p-4 space-y-3 mb-4">
              <p className="text-sm text-gray-400">{ko ? '클럽명' : 'Club'}: <span className="text-white">{club.name}</span></p>
              {club.annual_fee && (
                <p className="text-sm text-gray-400">{ko ? '년회비' : 'Annual Fee'}: <span className="text-yellow-300">{currSymbol}{club.annual_fee.toLocaleString()}</span></p>
              )}
              {club.monthly_fee && (
                <p className="text-sm text-gray-400">{ko ? '월회비' : 'Monthly Fee'}: <span className="text-blue-300">{currSymbol}{club.monthly_fee.toLocaleString()}</span></p>
              )}
            </div>
          )}
          {/* 비관리자도 골프장 목록은 볼 수 있음 */}
          <CourseListReadOnly courses={courses} ko={ko} />
        </>
      ) : (
        <div className="space-y-5">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Club Info */}
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
                {ko ? '클럽 정보' : 'Club Info'}
              </h2>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽명 (한글) *' : 'Club Name *'}</label>
                <input required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽명 (영문)' : 'Club Name (English)'}</label>
                <input value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{ko ? '통화' : 'Currency'}</label>
                <select value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                  {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Fee Settings */}
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
                  {ko ? '회비 설정' : 'Fee Settings'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {ko
                    ? '년회비와 월회비를 모두 설정할 수 있습니다. 회원별로 회비 유형을 따로 지정하세요.'
                    : 'Set both annual and monthly fee amounts. Assign fee type per member individually.'}
                </p>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm font-medium text-white">{ko ? '년회비' : 'Annual Fee'}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currSymbol}</span>
                  <input type="number" min="0" value={form.annual_fee}
                    onChange={(e) => setForm((f) => ({ ...f, annual_fee: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                    placeholder="0" />
                </div>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-sm font-medium text-white">{ko ? '월회비' : 'Monthly Fee'}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currSymbol}</span>
                  <input type="number" min="0" value={form.monthly_fee}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                    placeholder="0" />
                </div>
              </div>
              {(form.annual_fee || form.monthly_fee) && (
                <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3 space-y-1">
                  {form.annual_fee && (
                    <p className="text-xs text-green-300">{ko ? '년회비' : 'Annual'}: {currSymbol}{parseInt(form.annual_fee).toLocaleString()}</p>
                  )}
                  {form.monthly_fee && (
                    <p className="text-xs text-green-300">{ko ? '월회비' : 'Monthly'}: {currSymbol}{parseInt(form.monthly_fee).toLocaleString()}
                      {ko ? ` (연간 ${currSymbol}${(parseInt(form.monthly_fee)*12).toLocaleString()})` : ` (${currSymbol}${(parseInt(form.monthly_fee)*12).toLocaleString()}/yr)`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button type="submit" disabled={saving}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
              <Save size={18} />
              {saving ? (ko ? '저장 중...' : 'Saving...') : saved ? (ko ? '✓ 저장됨' : '✓ Saved') : (ko ? '설정 저장' : 'Save Settings')}
            </button>
          </form>

          {/* ── 골프장 관리 ─────────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl overflow-hidden">
            {/* 헤더 (토글) */}
            <button
              className="w-full px-4 py-3.5 flex items-center gap-3"
              onClick={() => setShowCourseSection(v => !v)}>
              <MapPin size={18} className="text-green-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white flex-1 text-left">
                {ko ? `골프장 관리 (${courses.length}개)` : `Golf Courses (${courses.length})`}
              </span>
              {showCourseSection ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>

            {showCourseSection && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                {/* 검색 + 추가 버튼 */}
                <div className="flex gap-2 pt-3">
                  <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={courseSearch}
                      onChange={e => setCourseSearch(e.target.value)}
                      placeholder={ko ? '골프장 검색...' : 'Search courses...'}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
                  </div>
                  <button onClick={openNewCourse}
                    className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-2 rounded-xl transition flex-shrink-0">
                    <Plus size={14} />
                    {ko ? '추가' : 'Add'}
                  </button>
                </div>

                {/* 골프장 목록 */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredCourses.map(c => (
                    <div key={c.id} className="bg-gray-800/60 rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500">{c.province}</span>
                          <span className="text-xs text-green-500">{c.holes}H / Par{c.par}</span>
                          {c.distance_km && <span className="text-xs text-gray-600">{c.distance_km}km</span>}
                        </div>
                        {c.sub_courses && (
                          <p className="text-xs text-blue-400/70 mt-0.5 truncate">{c.sub_courses}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => openEditCourse(c)}
                          className="text-gray-500 hover:text-green-400 transition">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deactivateCourse(c.id)}
                          className="text-gray-600 hover:text-red-400 transition">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredCourses.length === 0 && (
                    <p className="text-center text-gray-600 py-4 text-sm">
                      {ko ? '골프장이 없습니다' : 'No courses found'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DB 마이그레이션 섹션 (회장/총무 전용) ───────────────────────── */}
      {canManage && <DbMigrationSection ko={ko} />}

      {/* ── 골프장 추가/수정 모달 ────────────────────────────────────────── */}
      {editCourse !== null && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-end" onClick={() => setEditCourse(null)}>
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* 핸들 */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            {/* 제목 */}
            <div className="flex items-center gap-2 px-5 pb-3 flex-shrink-0 border-b border-gray-800">
              <MapPin size={16} className="text-green-400" />
              <h3 className="text-base font-bold text-white flex-1">
                {editCourse?.id ? (ko ? '골프장 수정' : 'Edit Course') : (ko ? '골프장 추가' : 'Add Course')}
              </h3>
              <button onClick={() => setEditCourse(null)} className="text-gray-500"><X size={20} /></button>
            </div>

            {/* 스크롤 폼 */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {/* 이름 — 자동완성 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '골프장명 (영문) *' : 'Course Name *'}</label>
                <CourseSearchInput
                  value={courseForm.name}
                  onChange={v => setCourseForm(f => ({ ...f, name: v }))}
                  onSelect={async c => {
                    // 1. 선택한 골프장의 모든 필드 즉시 채우기
                    setCourseForm(f => ({
                      ...f,
                      name:     c.name,
                      name_vn:  c.name_vn ?? f.name_vn,
                      province: c.province ?? f.province,
                      holes:    c.holes ?? f.holes,
                      par:      c.par ?? f.par,
                      distance_km:          c.distance_km != null          ? String(c.distance_km)          : f.distance_km,
                      green_fee_weekday_vnd: c.green_fee_weekday_vnd != null ? String(c.green_fee_weekday_vnd) : f.green_fee_weekday_vnd,
                      green_fee_weekend_vnd: c.green_fee_weekend_vnd != null ? String(c.green_fee_weekend_vnd) : f.green_fee_weekend_vnd,
                      address:     c.address     ?? f.address,
                      phone:       c.phone       ?? f.phone,
                      website:     c.website     ?? f.website,
                      description: c.description ?? f.description,
                      sub_courses: c.sub_courses
                        ? c.sub_courses.split(',').map((s: string) => s.trim())
                        : (c.holes > 18 ? defaultSubCourses(c.holes) : []),
                    }))
                    // 2. 주소가 없으면 Google Places 에서 자동 조회
                    if (!c.address) {
                      try {
                        const res  = await fetch(`/api/places/search?q=${encodeURIComponent(c.name)}&near=Vietnam`)
                        const json = await res.json()
                        const hit  = (json.results ?? []).find((r: any) =>
                          r.name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]) ||
                          c.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
                        ) ?? json.results?.[0]
                        if (hit?.address) {
                          setCourseForm(f => ({ ...f, address: hit.address }))
                        }
                      } catch { /* 무시 */ }
                    }
                  }}
                  placeholder={ko ? '골프장명 입력 (1자부터 자동검색)' : 'Type course name to search...'}
                  className="text-sm"
                  useFixed
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '골프장명 (베트남어)' : 'Course Name (Vietnamese)'}</label>
                <input value={courseForm.name_vn} onChange={e => setCourseForm(f => ({ ...f, name_vn: e.target.value }))}
                  placeholder="Sân Golf Long Thành"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>

              {/* 지역 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{ko ? '성/시 *' : 'Province *'}</label>
                  <select value={courseForm.province} onChange={e => setCourseForm(f => ({ ...f, province: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500">
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{ko ? '거리 (km)' : 'Distance (km)'}</label>
                  <input type="number" min="0" value={courseForm.distance_km}
                    onChange={e => setCourseForm(f => ({ ...f, distance_km: e.target.value }))}
                    placeholder="36"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
              </div>

              {/* 홀 / 파 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{ko ? '홀 수' : 'Holes'}</label>
                  <select value={courseForm.holes} onChange={e => {
                    const h = parseInt(e.target.value)
                    setCourseForm(f => ({
                      ...f,
                      holes: h,
                      par: h === 9 ? 36 : h === 18 ? 72 : h === 27 ? 108 : 144,
                      sub_courses: h > 18 ? (f.sub_courses.length > 0 ? f.sub_courses : defaultSubCourses(h)) : [],
                    }))
                  }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500">
                    {[9, 18, 27, 36].map(h => <option key={h} value={h}>{h}홀</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Par</label>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => setCourseForm(f => ({ ...f, par: Math.max(27, f.par - 1) }))}
                      className="w-9 h-10 rounded-xl bg-gray-800 text-white text-lg flex items-center justify-center hover:bg-gray-700">−</button>
                    <span className="flex-1 text-center text-white font-bold">{courseForm.par}</span>
                    <button type="button"
                      onClick={() => setCourseForm(f => ({ ...f, par: Math.min(80, f.par + 1) }))}
                      className="w-9 h-10 rounded-xl bg-gray-800 text-white text-lg flex items-center justify-center hover:bg-gray-700">+</button>
                  </div>
                </div>
              </div>

              {/* 주소 — 구글 장소 검색 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '주소' : 'Address'}</label>
                <div className="relative">
                  <input
                    value={courseForm.address}
                    onChange={e => setCourseForm(f => ({ ...f, address: e.target.value }))}
                    placeholder={ko ? '주소 직접 입력 또는 🗺️ 검색' : 'Type address or tap 🗺️ to search'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-12 text-sm text-white focus:outline-none focus:border-green-500"
                  />
                  <button
                    type="button"
                    title={ko ? '구글 지도에서 주소 검색' : 'Search address on Google Maps'}
                    onClick={() => { setAddrQ(courseForm.name); setAddrOpen(true); setAddrResults([]) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 hover:text-green-300 transition text-base"
                  >🗺️</button>
                </div>

                {/* 장소 검색 패널 */}
                {addrOpen && (
                  <div className="mt-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    {/* 검색 입력 */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
                      <Search size={13} className="text-gray-500 flex-shrink-0" />
                      <input
                        autoFocus
                        value={addrQ}
                        onChange={async e => {
                          const v = e.target.value
                          setAddrQ(v)
                          if (v.trim().length < 2) { setAddrResults([]); return }
                          setAddrLoading(true)
                          try {
                            const res = await fetch(`/api/places/search?q=${encodeURIComponent(v)}&near=Vietnam`)
                            const json = await res.json()
                            setAddrResults(json.results ?? [])
                          } catch { setAddrResults([]) }
                          setAddrLoading(false)
                        }}
                        placeholder={ko ? '골프장명 또는 주소 검색...' : 'Search golf course or address...'}
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
                      />
                      {addrLoading
                        ? <span className="text-green-400 text-xs animate-pulse">검색중...</span>
                        : <button type="button" onClick={() => setAddrOpen(false)} className="text-gray-600 hover:text-gray-400"><X size={14} /></button>
                      }
                    </div>

                    {/* 구글 지도 직접 열기 버튼 */}
                    <a
                      href={`https://maps.google.com/maps/search/${encodeURIComponent(addrQ || courseForm.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/50 hover:bg-gray-700/50 transition"
                    >
                      <span className="text-sm">🗺️</span>
                      <span className="text-xs text-blue-400">{ko ? '구글 지도에서 직접 검색 →' : 'Open in Google Maps →'}</span>
                    </a>

                    {/* 검색 결과 */}
                    <div className="max-h-48 overflow-y-auto">
                      {addrResults.length > 0 ? addrResults.map((r: any) => (
                        <button
                          key={r.place_id}
                          type="button"
                          onClick={() => {
                            setCourseForm(f => ({ ...f, address: r.address ?? r.name }))
                            setAddrOpen(false)
                            setAddrQ('')
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-700 transition border-b border-gray-700/50 last:border-0"
                        >
                          <p className="text-sm text-white font-medium truncate">{r.name}</p>
                          {r.address && <p className="text-xs text-gray-500 truncate mt-0.5">{r.address}</p>}
                        </button>
                      )) : addrQ.trim().length >= 2 && !addrLoading ? (
                        <p className="text-center text-gray-600 text-xs py-3">{ko ? '결과 없음 — 위 구글 지도 링크를 이용하세요' : 'No results — try Google Maps link above'}</p>
                      ) : addrLoading ? null : (
                        <p className="text-center text-gray-600 text-xs py-3">{ko ? '검색어를 입력하세요' : 'Enter search term'}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 그린피 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{ko ? '그린피 평일 (VND)' : 'Weekday (VND)'}</label>
                  <input type="number" min="0" value={courseForm.green_fee_weekday_vnd}
                    onChange={e => setCourseForm(f => ({ ...f, green_fee_weekday_vnd: e.target.value }))}
                    placeholder="2000000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{ko ? '그린피 주말 (VND)' : 'Weekend (VND)'}</label>
                  <input type="number" min="0" value={courseForm.green_fee_weekend_vnd}
                    onChange={e => setCourseForm(f => ({ ...f, green_fee_weekend_vnd: e.target.value }))}
                    placeholder="2800000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
              </div>

              {/* 전화 / 웹사이트 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">{ko ? '전화번호' : 'Phone'}</label>
                  <input value={courseForm.phone} onChange={e => setCourseForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+84 28 ..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Website</label>
                  <input value={courseForm.website} onChange={e => setCourseForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
                </div>
              </div>

              {/* 서브코스 이름 (27H / 36H 전용) */}
              {courseForm.holes > 18 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">
                      {ko ? `코스 이름 (${courseForm.holes / 9}개 × 9홀)` : `Sub-course Names (${courseForm.holes / 9} × 9H)`}
                    </label>
                    <button type="button"
                      onClick={() => setCourseForm(f => ({ ...f, sub_courses: defaultSubCourses(f.holes) }))}
                      className="text-xs text-green-500 hover:text-green-400">
                      {ko ? '기본값으로' : 'Reset'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {courseForm.sub_courses.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-14 flex-shrink-0">
                          {idx + 1}번 코스
                        </span>
                        <input
                          value={name}
                          onChange={e => setCourseForm(f => {
                            const subs = [...f.sub_courses]
                            subs[idx] = e.target.value
                            return { ...f, sub_courses: subs }
                          })}
                          placeholder={`예: 루나, 스텔라, 솔래`}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">
                    {ko ? '스코어카드에서 어떤 코스 조합으로 라운딩했는지 표시됩니다' : 'Shown in scorecard when selecting course combination'}
                  </p>
                </div>
              )}

              {/* 설명 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '설명' : 'Description'}</label>
                <textarea rows={2} value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              </div>
            </div>

            {/* 저장 버튼 (sticky) */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-800 space-y-2">
              {courseError && (
                <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-3 py-2">
                  <p className="text-red-400 text-xs">{courseError}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setEditCourse(null); setCourseError('') }}
                  className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button onClick={saveCourse} disabled={courseSaving || !courseForm.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
                  <Save size={16} />
                  {courseSaving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DB 마이그레이션 섹션 ────────────────────────────────────────────────────
function DbMigrationSection({ ko }: { ko: boolean }) {
  const [open,       setOpen]       = useState(false)
  const [migrations, setMigrations] = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [running,    setRunning]    = useState<string | null>(null)
  const [result,     setResult]     = useState<Record<string, any>>({})
  const [setupModal, setSetupModal] = useState<{ name: string; sql: string } | null>(null)
  const [copied,     setCopied]     = useState(false)

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/migrate')
      const json = await res.json()
      setMigrations(json.migrations ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function runMigration(name: string) {
    setRunning(name)
    setResult(prev => ({ ...prev, [name]: null }))
    try {
      const res = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ migration: name }),
      })
      const json = await res.json()
      if (json.needsSetup) {
        setSetupModal({ name, sql: json.setupSql })
      } else {
        setResult(prev => ({ ...prev, [name]: json }))
        // 상태 새로고침
        await loadStatus()
      }
    } finally {
      setRunning(null)
    }
  }

  function handleCopy(sql: string) {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const supabaseUrl = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    : ''
  const projectRef  = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button className="w-full px-4 py-3.5 flex items-center gap-3"
        onClick={() => { setOpen(v => !v); if (!open) loadStatus() }}>
        <Database size={18} className="text-purple-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-white flex-1 text-left">
          {ko ? 'DB 마이그레이션' : 'DB Migrations'}
        </span>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-800 space-y-3 pt-3">
          <p className="text-xs text-gray-500">
            {ko
              ? '새 기능에 필요한 DB 컬럼/테이블을 앱에서 바로 추가할 수 있습니다.'
              : 'Apply DB schema changes required by new features directly from this app.'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : migrations.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-4">
              {ko ? '마이그레이션 항목 없음' : 'No migrations'}
            </p>
          ) : (
            <div className="space-y-2">
              {migrations.map(m => {
                const res = result[m.name]
                return (
                  <div key={m.name} className="rounded-xl px-3 py-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-2">
                      {m.applied ? (
                        <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{m.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: m.applied ? '#22c55e' : '#f59e0b' }}>
                          {m.applied
                            ? (ko ? '✓ 적용됨' : '✓ Applied')
                            : (ko ? '미적용 — 아직 설치 필요' : 'Not applied yet')}
                        </p>
                      </div>
                      {!m.applied && (
                        <button
                          onClick={() => runMigration(m.name)}
                          disabled={running === m.name}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', color: '#fff' }}>
                          {running === m.name ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                              {ko ? '실행 중...' : 'Running...'}
                            </span>
                          ) : (ko ? '실행' : 'Run')}
                        </button>
                      )}
                    </div>

                    {/* 실행 결과 */}
                    {res && (
                      <div className="mt-2 px-2 py-1.5 rounded-lg text-xs"
                        style={{
                          background: res.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: res.ok ? '#22c55e' : '#f87171',
                        }}>
                        {res.message ?? (res.status === 'applied' ? (ko ? '성공적으로 적용됨' : 'Applied successfully') : res.status)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button onClick={loadStatus} disabled={loading}
            className="w-full py-2 rounded-xl text-xs font-semibold text-gray-400 transition hover:text-white"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {ko ? '↺ 상태 새로고침' : '↺ Refresh Status'}
          </button>
        </div>
      )}

      {/* ── Setup 안내 모달 (함수 미등록 시) ─── */}
      {setupModal && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-end" onClick={() => setSetupModal(null)}>
          <div className="bg-gray-900 rounded-t-3xl w-full max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0 border-b border-gray-800">
              <Database size={16} className="text-purple-400" />
              <h3 className="text-base font-bold text-white flex-1">
                {ko ? '최초 설정 필요' : 'One-time Setup Required'}
              </h3>
              <button onClick={() => setSetupModal(null)} className="text-gray-500"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="rounded-xl p-3"
                style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                <p className="text-yellow-300 text-sm font-semibold mb-1">
                  {ko ? '⚠ 최초 1회만 SQL Editor에서 실행하면 됩니다' : '⚠ Run this once in Supabase SQL Editor'}
                </p>
                <p className="text-yellow-200/70 text-xs">
                  {ko
                    ? '이후에는 이 버튼으로 언제든지 마이그레이션을 실행할 수 있습니다.'
                    : 'After this one-time setup, you can run migrations from this button anytime.'}
                </p>
              </div>

              {/* 단계 안내 */}
              <div className="space-y-3">
                {[
                  {
                    step: '1',
                    title: ko ? 'Supabase SQL Editor 열기' : 'Open Supabase SQL Editor',
                    desc: ko ? '아래 버튼으로 바로 이동' : 'Use the button below to navigate directly',
                  },
                  {
                    step: '2',
                    title: ko ? 'SQL 복사 후 붙여넣기' : 'Copy & paste the SQL',
                    desc: ko ? '"SQL 복사" 버튼으로 클립보드에 복사' : 'Use "Copy SQL" button to copy to clipboard',
                  },
                  {
                    step: '3',
                    title: ko ? 'Run(실행) 클릭' : 'Click Run',
                    desc: ko ? 'SQL Editor의 초록색 Run 버튼 클릭' : 'Click the green Run button in SQL Editor',
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">{step}</div>
                    <div>
                      <p className="text-white text-sm font-semibold">{title}</p>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* SQL 코드 박스 */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{ko ? '실행할 SQL:' : 'SQL to run:'}</p>
                <div className="relative">
                  <pre className="bg-gray-950 rounded-xl p-3 text-xs text-green-300 overflow-x-auto whitespace-pre-wrap max-h-48 border border-gray-800"
                    style={{ fontFamily: 'monospace' }}>
                    {setupModal.sql}
                  </pre>
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="flex-shrink-0 px-5 py-4 flex gap-3 border-t border-gray-800">
              <button
                onClick={() => handleCopy(setupModal.sql)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition"
                style={{ background: 'rgba(255,255,255,0.06)', color: copied ? '#22c55e' : '#d1d5db' }}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? (ko ? '복사됨!' : 'Copied!') : (ko ? 'SQL 복사' : 'Copy SQL')}
              </button>
              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)' }}>
                <Database size={14} />
                {ko ? 'SQL Editor 열기' : 'Open SQL Editor'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 비관리자용 골프장 목록 (읽기 전용) ─────────────────────────────────────
function CourseListReadOnly({ courses, ko }: { courses: any[], ko: boolean }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = courses.filter(c =>
    search === '' ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.province ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button className="w-full px-4 py-3.5 flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <MapPin size={18} className="text-green-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-white flex-1 text-left">
          {ko ? `등록 골프장 (${courses.length}개)` : `Golf Courses (${courses.length})`}
        </span>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
          <div className="relative pt-3">
            <Search size={14} className="absolute left-3 top-1/2 translate-y-[2px] text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={ko ? '골프장 검색...' : 'Search...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-green-500" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {filtered.map(c => (
              <div key={c.id} className="bg-gray-800/60 rounded-xl px-3 py-2.5">
                <p className="text-white text-sm font-medium">{c.name}</p>
                {c.name_vn && <p className="text-gray-500 text-xs">{c.name_vn}</p>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">{c.province}</span>
                  <span className="text-xs text-green-500">{c.holes}H / Par {c.par}</span>
                  {c.distance_km && <span className="text-xs text-gray-600">{c.distance_km}km</span>}
                  {c.green_fee_weekday_vnd && (
                    <span className="text-xs text-yellow-600">
                      {ko ? '평일' : 'WD'} ₫{(c.green_fee_weekday_vnd/1000).toFixed(0)}K
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
