'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Settings, Save, ChevronLeft, MapPin, Plus, Edit2, X,
  ChevronDown, ChevronUp, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import CourseSearchInput from '@/components/ui/CourseSearchInput'

// ── 골프장 폼 기본값 ──────────────────────────────────────────────────────
const EMPTY_COURSE = {
  name: '', name_vn: '', province: 'Ho Chi Minh City',
  district: '', address: '', holes: 18, par: 72,
  designer: '', distance_km: '', green_fee_weekday_vnd: '',
  green_fee_weekend_vnd: '', phone: '', website: '', description: '',
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
    setEditCourse({})  // empty object = new
  }

  function openEditCourse(course: any) {
    setCourseForm({
      name: course.name ?? '',
      name_vn: course.name_vn ?? '',
      province: course.province ?? 'Ho Chi Minh City',
      district: course.district ?? '',
      address: course.address ?? '',
      holes: course.holes ?? 18,
      par: course.par ?? 72,
      designer: course.designer ?? '',
      distance_km: course.distance_km != null ? String(course.distance_km) : '',
      green_fee_weekday_vnd: course.green_fee_weekday_vnd != null ? String(course.green_fee_weekday_vnd) : '',
      green_fee_weekend_vnd: course.green_fee_weekend_vnd != null ? String(course.green_fee_weekend_vnd) : '',
      phone: course.phone ?? '',
      website: course.website ?? '',
      description: course.description ?? '',
    })
    setEditCourse(course)
  }

  async function saveCourse() {
    if (!courseForm.name.trim()) return
    setCourseSaving(true)
    const supabase = createClient()
    const payload = {
      name: courseForm.name.trim(),
      name_vn: courseForm.name_vn.trim() || null,
      province: courseForm.province,
      district: courseForm.district.trim() || null,
      address: courseForm.address.trim() || null,
      holes: courseForm.holes,
      par: courseForm.par,
      designer: courseForm.designer.trim() || null,
      distance_km: courseForm.distance_km ? parseInt(String(courseForm.distance_km)) : null,
      green_fee_weekday_vnd: courseForm.green_fee_weekday_vnd ? parseInt(String(courseForm.green_fee_weekday_vnd)) : null,
      green_fee_weekend_vnd: courseForm.green_fee_weekend_vnd ? parseInt(String(courseForm.green_fee_weekend_vnd)) : null,
      phone: courseForm.phone.trim() || null,
      website: courseForm.website.trim() || null,
      description: courseForm.description.trim() || null,
      is_active: true,
    }

    if (editCourse?.id) {
      // 수정
      const { data } = await supabase.from('golf_courses').update(payload).eq('id', editCourse.id).select().single()
      if (data) setCourses(prev => prev.map(c => c.id === data.id ? data : c))
    } else {
      // 신규
      const { data } = await supabase.from('golf_courses').insert(payload).select().single()
      if (data) setCourses(prev => [...prev, data].sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999)))
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
                  onSelect={c => {
                    // 기존 DB 골프장 선택 시 모든 필드 자동 완성
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
                      designer:    c.designer    ?? f.designer,
                      description: c.description ?? f.description,
                    }))
                  }}
                  placeholder={ko ? '골프장명 입력 (1자부터 자동검색)' : 'Type course name to search...'}
                  className="text-sm"
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
                  <select value={courseForm.holes} onChange={e => setCourseForm(f => ({ ...f, holes: parseInt(e.target.value) }))}
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

              {/* 주소 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '주소' : 'Address'}</label>
                <input value={courseForm.address} onChange={e => setCourseForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
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

              {/* 설계자 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '설계자' : 'Designer'}</label>
                <input value={courseForm.designer} onChange={e => setCourseForm(f => ({ ...f, designer: e.target.value }))}
                  placeholder="Greg Norman"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
              </div>

              {/* 설명 */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">{ko ? '설명' : 'Description'}</label>
                <textarea rows={2} value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500 resize-none" />
              </div>
            </div>

            {/* 저장 버튼 (sticky) */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-800 flex gap-3">
              <button onClick={() => setEditCourse(null)}
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
