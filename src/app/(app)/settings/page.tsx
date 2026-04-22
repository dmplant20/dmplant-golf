'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Settings, Save, ChevronLeft, MapPin, Plus, Edit2, X,
  ChevronDown, ChevronUp, Search, AlertTriangle, Gift, Trash2, Lock,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

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
const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp' }
// 통화별 단위(천 단위 표시)
const CURRENCY_UNIT: Record<string, number> = { KRW: 1000, VND: 1000, IDR: 1000 }

// 통화별 헨디오버 기본 예시
const FINE_PRESET: Record<string, { per: number; max: number }> = {
  VND: { per: 100_000,  max: 500_000  },
  KRW: { per: 1_000,    max: 10_000   },
  IDR: { per: 10_000,   max: 100_000  },
}

export default function SettingsPage() {
  const router = useRouter()
  const { currentClubId, lang, myClubs, setMyClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  // ── Club settings ──────────────────────────────────────────────
  const [club,    setClub]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form, setForm] = useState({
    name: '', name_en: '', currency: 'KRW',
    annual_fee: '', monthly_fee: '',
  })

  // ── Golf courses ───────────────────────────────────────────────
  const [courses,          setCourses]          = useState<any[]>([])
  const [courseSearch,     setCourseSearch]     = useState('')
  const [showCourseSection,setShowCourseSection]= useState(false)
  const [editCourse,       setEditCourse]       = useState<any>(null)
  const [courseForm,       setCourseForm]       = useState({ ...EMPTY_COURSE })
  const [courseSaving,     setCourseSaving]     = useState(false)

  // ── Fine rules ─────────────────────────────────────────────────
  const [showFineSection, setShowFineSection] = useState(false)
  const [fineForm, setFineForm] = useState({
    per_stroke: '', max_amount: '', notes: '',
  })
  const [fineSaving, setFineSaving] = useState(false)
  const [fineSaved,  setFineSaved]  = useState(false)

  // ── Sponsorships ───────────────────────────────────────────────
  const [showSponsorSection, setShowSponsorSection] = useState(false)
  const [sponsorships,       setSponsorships]       = useState<any[]>([])
  const [showAddSponsor,     setShowAddSponsor]     = useState(false)
  const [members,            setMembers]            = useState<any[]>([])
  const [sponsorSaving,      setSponsorSaving]      = useState(false)
  const [sponsorDeleting,    setSponsorDeleting]    = useState<string | null>(null)
  const emptySponsorForm = {
    member_id: '', member_name: '',
    type: 'cash' as 'cash' | 'item',
    amount: '', item_description: '', estimated_value: '',
    sponsor_date: new Date().toISOString().split('T')[0],
    note: '',
  }
  const [sponsorForm, setSponsorForm] = useState(emptySponsorForm)

  // ── Load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentClubId) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [{ data: clubData }, { data: courseData }, { data: sponsorData }, { data: memberData }] = await Promise.all([
        supabase.from('clubs').select('*').eq('id', currentClubId).single(),
        supabase.from('golf_courses').select('*').eq('is_active', true).order('distance_km'),
        supabase.from('sponsorships').select('*').eq('club_id', currentClubId).order('sponsor_date', { ascending: false }),
        supabase.from('club_memberships').select('user_id, users(full_name, full_name_en)').eq('club_id', currentClubId).eq('status', 'approved'),
      ])
      if (clubData) {
        setClub(clubData)
        setForm({
          name:        clubData.name         ?? '',
          name_en:     clubData.name_en      ?? '',
          currency:    clubData.currency     ?? 'KRW',
          annual_fee:  clubData.annual_fee   != null ? String(clubData.annual_fee)  : '',
          monthly_fee: clubData.monthly_fee  != null ? String(clubData.monthly_fee) : '',
        })
        setFineForm({
          per_stroke: clubData.fine_handicap_per_stroke != null ? String(clubData.fine_handicap_per_stroke) : '',
          max_amount: clubData.fine_handicap_max        != null ? String(clubData.fine_handicap_max)        : '',
          notes:      clubData.fine_notes               ?? '',
        })
      }
      setCourses(courseData ?? [])
      setSponsorships(sponsorData ?? [])
      setMembers(memberData ?? [])
      setLoading(false)
    }
    load()
  }, [currentClubId])

  // ── Save club info ─────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!currentClubId || !canManage) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('clubs').update({
      name:        form.name,
      name_en:     form.name_en     || null,
      currency:    form.currency,
      annual_fee:  form.annual_fee  ? parseInt(form.annual_fee)  : null,
      monthly_fee: form.monthly_fee ? parseInt(form.monthly_fee) : null,
    }).eq('id', currentClubId)
    setMyClubs(myClubs.map(c => c.id === currentClubId ? { ...c, name: form.name, name_en: form.name_en } : c))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  // ── Save fine rules ────────────────────────────────────────────
  async function saveFineRules() {
    if (!currentClubId || !canManage) return
    setFineSaving(true)
    const supabase = createClient()
    await supabase.from('clubs').update({
      fine_handicap_per_stroke: fineForm.per_stroke ? parseInt(fineForm.per_stroke) : null,
      fine_handicap_max:        fineForm.max_amount ? parseInt(fineForm.max_amount) : null,
      fine_notes:               fineForm.notes.trim() || null,
    }).eq('id', currentClubId)
    setFineSaving(false); setFineSaved(true); setTimeout(() => setFineSaved(false), 2000)
  }

  function applyFinePreset() {
    const p = FINE_PRESET[form.currency] ?? FINE_PRESET.VND
    setFineForm(f => ({ ...f, per_stroke: String(p.per), max_amount: String(p.max) }))
  }

  // ── Sponsorship CRUD ───────────────────────────────────────────
  async function addSponsorship() {
    const nameToUse = sponsorForm.member_id
      ? (members.find(m => m.user_id === sponsorForm.member_id)?.users?.full_name ?? sponsorForm.member_name)
      : sponsorForm.member_name
    if (!nameToUse.trim()) return
    setSponsorSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const payload: any = {
      club_id:     currentClubId,
      member_id:   sponsorForm.member_id || null,
      member_name: nameToUse.trim(),
      type:        sponsorForm.type,
      currency:    form.currency,
      sponsor_date: sponsorForm.sponsor_date,
      note:        sponsorForm.note.trim() || null,
      created_by:  user!.id,
    }
    if (sponsorForm.type === 'cash') {
      payload.amount = sponsorForm.amount ? parseInt(sponsorForm.amount) : 0
    } else {
      payload.amount            = sponsorForm.estimated_value ? parseInt(sponsorForm.estimated_value) : 0
      payload.item_description  = sponsorForm.item_description.trim() || null
      payload.estimated_value   = sponsorForm.estimated_value ? parseInt(sponsorForm.estimated_value) : null
    }
    const { data } = await supabase.from('sponsorships').insert(payload).select().single()
    if (data) setSponsorships(p => [data, ...p])
    setSponsorSaving(false); setShowAddSponsor(false); setSponsorForm(emptySponsorForm)
  }

  async function deleteSponsorship(id: string) {
    setSponsorDeleting(id)
    await createClient().from('sponsorships').delete().eq('id', id)
    setSponsorships(p => p.filter(s => s.id !== id))
    setSponsorDeleting(null)
  }

  // ── Course CRUD ────────────────────────────────────────────────
  function openNewCourse()       { setCourseForm({ ...EMPTY_COURSE }); setEditCourse({}) }
  function openEditCourse(c: any) {
    setCourseForm({
      name:                    c.name                    ?? '',
      name_vn:                 c.name_vn                 ?? '',
      province:                c.province                ?? 'Ho Chi Minh City',
      district:                c.district                ?? '',
      address:                 c.address                 ?? '',
      holes:                   c.holes                   ?? 18,
      par:                     c.par                     ?? 72,
      designer:                c.designer                ?? '',
      distance_km:             c.distance_km             != null ? String(c.distance_km)             : '',
      green_fee_weekday_vnd:   c.green_fee_weekday_vnd   != null ? String(c.green_fee_weekday_vnd)   : '',
      green_fee_weekend_vnd:   c.green_fee_weekend_vnd   != null ? String(c.green_fee_weekend_vnd)   : '',
      phone:                   c.phone                   ?? '',
      website:                 c.website                 ?? '',
      description:             c.description             ?? '',
    })
    setEditCourse(c)
  }

  async function saveCourse() {
    if (!courseForm.name.trim()) return
    setCourseSaving(true)
    const supabase = createClient()
    const payload = {
      name:                  courseForm.name.trim(),
      name_vn:               courseForm.name_vn.trim() || null,
      province:              courseForm.province,
      district:              courseForm.district.trim() || null,
      address:               courseForm.address.trim() || null,
      holes:                 courseForm.holes,
      par:                   courseForm.par,
      designer:              courseForm.designer.trim() || null,
      distance_km:           courseForm.distance_km           ? parseInt(String(courseForm.distance_km))           : null,
      green_fee_weekday_vnd: courseForm.green_fee_weekday_vnd ? parseInt(String(courseForm.green_fee_weekday_vnd)) : null,
      green_fee_weekend_vnd: courseForm.green_fee_weekend_vnd ? parseInt(String(courseForm.green_fee_weekend_vnd)) : null,
      phone:                 courseForm.phone.trim() || null,
      website:               courseForm.website.trim() || null,
      description:           courseForm.description.trim() || null,
      is_active:             true,
    }
    if (editCourse?.id) {
      const { data } = await supabase.from('golf_courses').update(payload).eq('id', editCourse.id).select().single()
      if (data) setCourses(prev => prev.map(c => c.id === data.id ? data : c))
    } else {
      const { data } = await supabase.from('golf_courses').insert(payload).select().single()
      if (data) setCourses(prev => [...prev, data].sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999)))
    }
    setCourseSaving(false); setEditCourse(null)
  }

  async function deactivateCourse(id: string) {
    if (!confirm(ko ? '이 골프장을 목록에서 숨기시겠습니까?' : 'Hide this course?')) return
    await createClient().from('golf_courses').update({ is_active: false }).eq('id', id)
    setCourses(prev => prev.filter(c => c.id !== id))
  }

  // ── Helpers ────────────────────────────────────────────────────
  const filteredCourses = courses.filter(c =>
    courseSearch === '' ||
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.name_vn ?? '').toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.province ?? '').toLowerCase().includes(courseSearch.toLowerCase())
  )

  const currencies = [
    { value: 'KRW', label: '원 (₩) — KRW' },
    { value: 'VND', label: '동 (₫) — VND' },
    { value: 'IDR', label: '루피아 (Rp) — IDR' },
  ]
  const sym = CURRENCY_SYMBOL[form.currency] ?? '₩'

  // 벌금 미리보기 텍스트
  const finePreview = (() => {
    const per = fineForm.per_stroke ? parseInt(fineForm.per_stroke) : null
    const max = fineForm.max_amount ? parseInt(fineForm.max_amount) : null
    if (!per && !max) return ''
    const parts = []
    if (per) parts.push(`${ko ? '타당' : 'per stroke'} ${sym}${per.toLocaleString()}`)
    if (max) parts.push(`${ko ? '최고' : 'max'} ${sym}${max.toLocaleString()}`)
    return parts.join(` · `)
  })()

  // 찬조 표시 텍스트
  function sponsorDisplay(s: any) {
    const currency = CURRENCY_SYMBOL[s.currency] ?? sym
    if (s.type === 'item') {
      const val = s.estimated_value ? ` (${currency}${Number(s.estimated_value).toLocaleString()} ${ko ? '상당' : 'est.'})` : ''
      return `${s.item_description ?? ko ? '물품' : 'Item'}${val}`
    }
    return `${currency}${Number(s.amount).toLocaleString()}`
  }

  // ── 비관리자 뷰 ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="px-4 pt-5 pb-24 space-y-5 animate-fade-in max-w-lg mx-auto">

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Settings size={18} style={{ color: '#22c55e' }} />
          <h1 className="text-lg font-bold text-white">{ko ? '클럽 설정' : 'Club Settings'}</h1>
        </div>
        {!canManage && (
          <span className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', color: '#5a7a5a' }}>
            <Lock size={10} /> {ko ? '열람 전용' : 'Read only'}
          </span>
        )}
      </div>

      {!canManage ? (
        /* ── 비관리자 읽기 전용 뷰 ── */
        <div className="space-y-4">
          {club && (
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#22c55e' }}>
                {ko ? '클럽 정보' : 'Club Info'}
              </p>
              <p className="text-sm" style={{ color: '#a3b8a3' }}>{ko ? '클럽명' : 'Club'}: <span className="text-white font-medium">{club.name}</span></p>
              {club.annual_fee  && <p className="text-sm" style={{ color: '#a3b8a3' }}>{ko ? '년회비' : 'Annual Fee'}: <span className="text-yellow-300 font-medium">{sym}{club.annual_fee.toLocaleString()}</span></p>}
              {club.monthly_fee && <p className="text-sm" style={{ color: '#a3b8a3' }}>{ko ? '월회비' : 'Monthly Fee'}: <span className="text-blue-300 font-medium">{sym}{club.monthly_fee.toLocaleString()}</span></p>}
            </div>
          )}
          {/* 벌금 규정 읽기 전용 */}
          {(club?.fine_handicap_per_stroke || club?.fine_notes) && (
            <FineRulesReadOnly club={club} sym={sym} ko={ko} />
          )}
          {/* 골프장 목록 읽기 전용 */}
          <CourseListReadOnly courses={courses} ko={ko} />
        </div>
      ) : (
        /* ── 관리자 편집 뷰 ── */
        <div className="space-y-5">

          {/* ━━ 클럽 정보 + 회비 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <form onSubmit={handleSave} className="space-y-5">
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#22c55e' }}>
                {ko ? '클럽 정보' : 'Club Info'}
              </h2>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '클럽명 (한글) *' : 'Club Name *'}</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '클럽명 (영문)' : 'Club Name (English)'}</label>
                <input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '통화' : 'Currency'}</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input-field">
                  {currencies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#22c55e' }}>{ko ? '회비 설정' : 'Fee Settings'}</h2>
              {[
                { key: 'annual_fee',  label: ko ? '년회비' : 'Annual Fee',  dot: 'bg-yellow-400' },
                { key: 'monthly_fee', label: ko ? '월회비' : 'Monthly Fee', dot: 'bg-blue-400' },
              ].map(({ key, label, dot }) => (
                <div key={key} className="rounded-xl p-3.5 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.08)' }}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="text-sm font-medium text-white">{label}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#5a7a5a' }}>{sym}</span>
                    <input type="number" min="0"
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="input-field pl-8" placeholder="0" />
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={saving}
              className="w-full btn-primary py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={16} />
              {saving ? (ko ? '저장 중...' : 'Saving...') : saved ? '✓ ' + (ko ? '저장됨' : 'Saved') : (ko ? '기본 정보 저장' : 'Save')}
            </button>
          </form>

          {/* ━━ 벌금 규정 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <button className="w-full px-4 py-3.5 flex items-center gap-3"
              onClick={() => setShowFineSection(v => !v)}>
              <AlertTriangle size={17} className="flex-shrink-0" style={{ color: '#fbbf24' }} />
              <span className="text-sm font-semibold text-white flex-1 text-left">
                {ko ? '벌금 규정' : 'Fine Rules'}
                {finePreview && (
                  <span className="ml-2 text-xs font-normal" style={{ color: '#5a7a5a' }}>{finePreview}</span>
                )}
              </span>
              {showFineSection ? <ChevronUp size={16} style={{ color: '#5a7a5a' }} /> : <ChevronDown size={16} style={{ color: '#5a7a5a' }} />}
            </button>

            {showFineSection && (
              <div className="px-4 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
                <div className="pt-4 space-y-1">
                  <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                    {ko ? '🏌️ 헨디오버 벌금 (타수 초과 벌금)' : '🏌️ Handicap-Over Fine (per stroke)'}
                  </p>
                  <p className="text-xs" style={{ color: '#5a7a5a' }}>
                    {ko
                      ? '핸디캡 기준 초과 타수 당 벌금 금액과 최고 한도를 설정합니다.'
                      : 'Set fine per stroke over handicap and the maximum cap.'}
                  </p>
                  {/* 빠른 입력 버튼 */}
                  <button onClick={applyFinePreset}
                    className="text-xs px-2.5 py-1 rounded-lg mt-1 transition"
                    style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                    {ko ? `기본값 적용 (${sym}${(FINE_PRESET[form.currency]?.per ?? 100_000).toLocaleString()} / 최고 ${sym}${(FINE_PRESET[form.currency]?.max ?? 500_000).toLocaleString()})` : `Apply default`}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>
                      {ko ? '타당 벌금 금액' : 'Fine per stroke'} ({sym})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#5a7a5a' }}>{sym}</span>
                      <input type="number" min="0" value={fineForm.per_stroke}
                        onChange={e => setFineForm(f => ({ ...f, per_stroke: e.target.value }))}
                        placeholder={String(FINE_PRESET[form.currency]?.per ?? 100000)}
                        className="input-field pl-7 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>
                      {ko ? '최고 벌금 한도' : 'Maximum cap'} ({sym})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#5a7a5a' }}>{sym}</span>
                      <input type="number" min="0" value={fineForm.max_amount}
                        onChange={e => setFineForm(f => ({ ...f, max_amount: e.target.value }))}
                        placeholder={String(FINE_PRESET[form.currency]?.max ?? 500000)}
                        className="input-field pl-7 text-sm" />
                    </div>
                  </div>
                </div>

                {/* 미리보기 */}
                {finePreview && (
                  <div className="rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)', color: '#fbbf24' }}>
                    📋 {ko ? '헨디오버' : 'Handicap-over'}: {finePreview}
                  </div>
                )}

                {/* 기타 규정 */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>
                    {ko ? '기타 벌금 규정 (자유 입력)' : 'Other fine rules (free text)'}
                  </label>
                  <textarea rows={3} value={fineForm.notes}
                    onChange={e => setFineForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder={ko
                      ? '예)\n• OB 타당 100,000₫\n• 지각 벌금 50,000₫\n• 노쇼 벌금 200,000₫'
                      : 'e.g.\n• OB per stroke: 100,000₫\n• Late arrival: 50,000₫'}
                    className="input-field resize-none text-xs leading-relaxed" />
                </div>

                <button onClick={saveFineRules} disabled={fineSaving}
                  className="w-full btn-primary py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save size={14} />
                  {fineSaving ? (ko ? '저장 중...' : 'Saving...') : fineSaved ? '✓ ' + (ko ? '저장됨' : 'Saved') : (ko ? '벌금 규정 저장' : 'Save Fine Rules')}
                </button>
              </div>
            )}
          </div>

          {/* ━━ 찬조 내역 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <button className="w-full px-4 py-3.5 flex items-center gap-3"
              onClick={() => setShowSponsorSection(v => !v)}>
              <Gift size={17} className="flex-shrink-0" style={{ color: '#a78bfa' }} />
              <span className="text-sm font-semibold text-white flex-1 text-left">
                {ko ? `찬조 내역 (${sponsorships.length}건)` : `Sponsorships (${sponsorships.length})`}
              </span>
              {showSponsorSection ? <ChevronUp size={16} style={{ color: '#5a7a5a' }} /> : <ChevronDown size={16} style={{ color: '#5a7a5a' }} />}
            </button>

            {showSponsorSection && (
              <div className="px-4 pb-5 space-y-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
                <div className="flex justify-between items-center pt-3">
                  <p className="text-xs" style={{ color: '#5a7a5a' }}>
                    {ko ? '재무 페이지에서 전 회원이 열람할 수 있습니다.' : 'All members can view in Finance page.'}
                  </p>
                  <button onClick={() => setShowAddSponsor(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl text-white font-medium"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
                    <Plus size={13} /> {ko ? '찬조 등록' : 'Add'}
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {sponsorships.length === 0 ? (
                    <div className="text-center py-6" style={{ color: '#3a5a3a' }}>
                      <Gift size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">{ko ? '등록된 찬조가 없습니다' : 'No sponsorships yet'}</p>
                    </div>
                  ) : sponsorships.map(s => (
                    <div key={s.id} className="rounded-xl px-3.5 py-3 flex items-start gap-3"
                      style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}>
                      <span className="text-lg flex-shrink-0 mt-0.5">{s.type === 'item' ? '🎁' : '💰'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{s.member_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#c4b5fd' }}>{sponsorDisplay(s)}</p>
                        {s.note && <p className="text-xs mt-0.5 italic" style={{ color: '#7a6a9a' }}>{s.note}</p>}
                        <p className="text-xs mt-1" style={{ color: '#5a4a7a' }}>{s.sponsor_date}</p>
                      </div>
                      <button onClick={() => deleteSponsorship(s.id)} disabled={sponsorDeleting === s.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ━━ 골프장 관리 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <button className="w-full px-4 py-3.5 flex items-center gap-3"
              onClick={() => setShowCourseSection(v => !v)}>
              <MapPin size={17} className="text-green-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white flex-1 text-left">
                {ko ? `골프장 관리 (${courses.length}개)` : `Golf Courses (${courses.length})`}
              </span>
              {showCourseSection ? <ChevronUp size={16} style={{ color: '#5a7a5a' }} /> : <ChevronDown size={16} style={{ color: '#5a7a5a' }} />}
            </button>

            {showCourseSection && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
                <div className="flex gap-2 pt-3">
                  <div className="flex-1 relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5a7a5a' }} />
                    <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)}
                      placeholder={ko ? '골프장 검색...' : 'Search courses...'}
                      className="input-field pl-8 text-sm py-2" />
                  </div>
                  <button onClick={openNewCourse}
                    className="flex items-center gap-1.5 text-white text-xs px-3 py-2 rounded-xl font-medium"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                    <Plus size={13} /> {ko ? '추가' : 'Add'}
                  </button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredCourses.map(c => (
                    <div key={c.id} className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.08)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs" style={{ color: '#5a7a5a' }}>{c.province}</span>
                          <span className="text-xs text-green-500">{c.holes}H / Par{c.par}</span>
                          {c.distance_km && <span className="text-xs" style={{ color: '#3a5a3a' }}>{c.distance_km}km</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => openEditCourse(c)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deactivateCourse(c.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredCourses.length === 0 && (
                    <p className="text-center py-6 text-sm" style={{ color: '#3a5a3a' }}>
                      {ko ? '골프장이 없습니다' : 'No courses found'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ 찬조 등록 모달 ════════════════════════════════════════════ */}
      {showAddSponsor && (
        <div className="fixed inset-0 flex items-end z-[200]" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowAddSponsor(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 animate-slide-up overflow-y-auto"
            style={{ background: '#0a140a', border: '1px solid rgba(124,58,237,0.25)', borderBottom: 'none', maxHeight: '90dvh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center -mt-1"><div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} /></div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">🎁 {ko ? '찬조 등록' : 'Add Sponsorship'}</h3>
              <button onClick={() => setShowAddSponsor(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#5a7a5a' }}>
                <X size={16} />
              </button>
            </div>

            {/* 회원 선택 */}
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                {ko ? '찬조 회원 *' : 'Member *'}
              </label>
              <select value={sponsorForm.member_id}
                onChange={e => setSponsorForm(f => ({ ...f, member_id: e.target.value, member_name: '' }))}
                className="input-field">
                <option value="">{ko ? '— 회원 선택 —' : '— Select member —'}</option>
                {members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>
                    {ko ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                  </option>
                ))}
              </select>
              {!sponsorForm.member_id && (
                <input value={sponsorForm.member_name}
                  onChange={e => setSponsorForm(f => ({ ...f, member_name: e.target.value }))}
                  placeholder={ko ? '또는 이름 직접 입력' : 'Or type name directly'}
                  className="input-field mt-2 text-sm" />
              )}
            </div>

            {/* 찬조 유형 */}
            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: '#5a7a5a' }}>
                {ko ? '찬조 유형 *' : 'Type *'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'cash', emoji: '💰', ko: '현금', en: 'Cash' },
                  { v: 'item', emoji: '🎁', ko: '물품',  en: 'Item' },
                ].map(t => (
                  <button key={t.v} onClick={() => setSponsorForm(f => ({ ...f, type: t.v as 'cash' | 'item' }))}
                    className="py-3 rounded-xl flex flex-col items-center gap-1 text-sm font-medium transition"
                    style={sponsorForm.type === t.v
                      ? { background: 'rgba(124,58,237,0.2)', border: '1.5px solid rgba(124,58,237,0.4)', color: '#c4b5fd' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#5a7a5a' }}>
                    <span className="text-xl">{t.emoji}</span>
                    <span>{ko ? t.ko : t.en}</span>
                  </button>
                ))}
              </div>
            </div>

            {sponsorForm.type === 'cash' ? (
              /* 현금 */
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                  {ko ? `금액 (${sym}) *` : `Amount (${sym}) *`}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#5a7a5a' }}>{sym}</span>
                  <input type="number" min="0" value={sponsorForm.amount}
                    onChange={e => setSponsorForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="5000000" className="input-field pl-8" />
                </div>
              </div>
            ) : (
              /* 물품 */
              <>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                    {ko ? '물품 내용 *' : 'Item description *'}
                  </label>
                  <input value={sponsorForm.item_description}
                    onChange={e => setSponsorForm(f => ({ ...f, item_description: e.target.value }))}
                    placeholder={ko ? '예: 캐디백 한점, 골프공 3타스, 음료수 2박스' : 'e.g. Golf bag (1 set), Golf balls (3 dozen)'}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                    {ko ? `상당 금액 (${sym}, 선택)` : `Estimated value (${sym}, optional)`}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#5a7a5a' }}>{sym}</span>
                    <input type="number" min="0" value={sponsorForm.estimated_value}
                      onChange={e => setSponsorForm(f => ({ ...f, estimated_value: e.target.value }))}
                      placeholder="5000000" className="input-field pl-8" />
                  </div>
                </div>
              </>
            )}

            {/* 날짜 */}
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                {ko ? '날짜' : 'Date'}
              </label>
              <input type="date" value={sponsorForm.sponsor_date}
                onChange={e => setSponsorForm(f => ({ ...f, sponsor_date: e.target.value }))}
                className="input-field" />
            </div>

            {/* 메모 */}
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: '#5a7a5a' }}>
                {ko ? '메모 (선택)' : 'Note (optional)'}
              </label>
              <input value={sponsorForm.note}
                onChange={e => setSponsorForm(f => ({ ...f, note: e.target.value }))}
                placeholder={ko ? '예: 2025년 클럽 대회 협찬' : 'e.g. Club tournament 2025 sponsorship'}
                className="input-field" />
            </div>

            {/* 미리보기 */}
            {((sponsorForm.member_id || sponsorForm.member_name) && (sponsorForm.amount || sponsorForm.item_description)) && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                👁 {sponsorForm.member_id
                  ? (ko ? members.find(m => m.user_id === sponsorForm.member_id)?.users?.full_name : (members.find(m => m.user_id === sponsorForm.member_id)?.users?.full_name_en || members.find(m => m.user_id === sponsorForm.member_id)?.users?.full_name))
                  : sponsorForm.member_name} {ko ? '회원' : ''} ·{' '}
                {sponsorForm.type === 'cash'
                  ? `${sym}${Number(sponsorForm.amount || 0).toLocaleString()}`
                  : `${sponsorForm.item_description}${sponsorForm.estimated_value ? ` (${sym}${Number(sponsorForm.estimated_value).toLocaleString()} ${ko ? '상당' : 'est.'})` : ''}`}
              </div>
            )}

            <div className="flex gap-3 pb-2">
              <button onClick={() => setShowAddSponsor(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.12)', color: '#86efac' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={addSponsorship} disabled={sponsorSaving || (!sponsorForm.member_id && !sponsorForm.member_name)}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                {sponsorSaving ? (ko ? '등록 중...' : '...') : (ko ? '등록하기' : 'Register')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ 골프장 추가/수정 모달 ════════════════════════════════════════ */}
      {editCourse !== null && (
        <div className="fixed inset-0 z-[200] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setEditCourse(null)}>
          <div className="rounded-t-3xl w-full max-h-[90vh] flex flex-col"
            style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.2)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} />
            </div>
            <div className="flex items-center gap-2 px-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
              <MapPin size={16} className="text-green-400" />
              <h3 className="text-base font-bold text-white flex-1">
                {editCourse?.id ? (ko ? '골프장 수정' : 'Edit Course') : (ko ? '골프장 추가' : 'Add Course')}
              </h3>
              <button onClick={() => setEditCourse(null)}><X size={20} style={{ color: '#5a7a5a' }} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {[
                { key: 'name',   label: ko ? '골프장명 (영문) *' : 'Course Name *',          ph: 'Long Thanh Golf Club' },
                { key: 'name_vn',label: ko ? '골프장명 (베트남어)' : 'Name (Vietnamese)',     ph: 'Sân Golf Long Thành' },
              ].map(({ key, label, ph }) => (
                <div key={key}>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{label}</label>
                  <input value={(courseForm as any)[key]} onChange={e => setCourseForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={ph} className="input-field text-sm" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '성/시 *' : 'Province *'}</label>
                  <select value={courseForm.province} onChange={e => setCourseForm(f => ({ ...f, province: e.target.value }))} className="input-field text-sm">
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '거리 (km)' : 'Distance (km)'}</label>
                  <input type="number" min="0" value={courseForm.distance_km}
                    onChange={e => setCourseForm(f => ({ ...f, distance_km: e.target.value }))}
                    placeholder="36" className="input-field text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '홀 수' : 'Holes'}</label>
                  <select value={courseForm.holes} onChange={e => setCourseForm(f => ({ ...f, holes: parseInt(e.target.value) }))} className="input-field text-sm">
                    {[9, 18, 27, 36].map(h => <option key={h} value={h}>{h}{ko ? '홀' : ' holes'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>Par</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setCourseForm(f => ({ ...f, par: Math.max(27, f.par - 1) }))}
                      className="w-9 h-10 rounded-xl text-white text-lg flex items-center justify-center"
                      style={{ background: 'rgba(34,197,94,0.1)' }}>−</button>
                    <span className="flex-1 text-center text-white font-bold">{courseForm.par}</span>
                    <button type="button" onClick={() => setCourseForm(f => ({ ...f, par: Math.min(80, f.par + 1) }))}
                      className="w-9 h-10 rounded-xl text-white text-lg flex items-center justify-center"
                      style={{ background: 'rgba(34,197,94,0.1)' }}>+</button>
                  </div>
                </div>
              </div>
              {[
                { key: 'address',               label: ko ? '주소'           : 'Address',          ph: '' },
                { key: 'green_fee_weekday_vnd', label: ko ? '그린피 평일(VND)' : 'Weekday fee (VND)', ph: '2000000' },
                { key: 'green_fee_weekend_vnd', label: ko ? '그린피 주말(VND)' : 'Weekend fee (VND)', ph: '2800000' },
                { key: 'phone',                 label: ko ? '전화번호'        : 'Phone',             ph: '+84 28 ...' },
                { key: 'website',               label: 'Website',                                    ph: 'https://...' },
                { key: 'designer',              label: ko ? '설계자'          : 'Designer',          ph: 'Greg Norman' },
              ].map(({ key, label, ph }) => (
                <div key={key}>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{label}</label>
                  <input value={(courseForm as any)[key]} onChange={e => setCourseForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={ph} className="input-field text-sm"
                    type={['green_fee_weekday_vnd','green_fee_weekend_vnd'].includes(key) ? 'number' : 'text'} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: '#5a7a5a' }}>{ko ? '설명' : 'Description'}</label>
                <textarea rows={2} value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                  className="input-field text-sm resize-none" />
              </div>
            </div>
            <div className="flex-shrink-0 px-5 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
              <button onClick={() => setEditCourse(null)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.12)', color: '#86efac' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={saveCourse} disabled={courseSaving || !courseForm.name.trim()}
                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} />
                {courseSaving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 벌금 규정 읽기 전용 (비관리자용) ──────────────────────────────────────
function FineRulesReadOnly({ club, sym, ko }: { club: any; sym: string; ko: boolean }) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#fbbf24' }}>
        🏌️ {ko ? '벌금 규정' : 'Fine Rules'}
      </p>
      {club.fine_handicap_per_stroke && (
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
          <p className="text-sm" style={{ color: '#fde68a' }}>
            {ko ? '헨디오버' : 'Handicap over'}:{' '}
            <span className="font-bold">{sym}{Number(club.fine_handicap_per_stroke).toLocaleString()}</span>
            {ko ? ' 타당' : ' per stroke'}
            {club.fine_handicap_max && (
              <span style={{ color: '#a3b8a3' }}>
                {' · '}{ko ? '최고' : 'max'} <span className="font-bold text-white">{sym}{Number(club.fine_handicap_max).toLocaleString()}</span>
              </span>
            )}
          </p>
        </div>
      )}
      {club.fine_notes && (
        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#a3b8a3' }}>{club.fine_notes}</p>
      )}
    </div>
  )
}

// ── 비관리자용 골프장 목록 (읽기 전용) ────────────────────────────────────
function CourseListReadOnly({ courses, ko }: { courses: any[]; ko: boolean }) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const filtered = courses.filter(c =>
    search === '' ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.province ?? '').toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button className="w-full px-4 py-3.5 flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <MapPin size={17} className="text-green-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-white flex-1 text-left">
          {ko ? `등록 골프장 (${courses.length}개)` : `Golf Courses (${courses.length})`}
        </span>
        {open ? <ChevronUp size={16} style={{ color: '#5a7a5a' }} /> : <ChevronDown size={16} style={{ color: '#5a7a5a' }} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
          <div className="relative pt-3">
            <Search size={13} className="absolute left-3 top-1/2 translate-y-[4px]" style={{ color: '#5a7a5a' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={ko ? '골프장 검색...' : 'Search...'}
              className="input-field pl-8 text-sm py-2" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {filtered.map(c => (
              <div key={c.id} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.08)' }}>
                <p className="text-white text-sm font-medium">{c.name}</p>
                {c.name_vn && <p className="text-xs mt-0.5" style={{ color: '#5a7a5a' }}>{c.name_vn}</p>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs" style={{ color: '#5a7a5a' }}>{c.province}</span>
                  <span className="text-xs text-green-500">{c.holes}H / Par {c.par}</span>
                  {c.distance_km && <span className="text-xs" style={{ color: '#3a5a3a' }}>{c.distance_km}km</span>}
                  {c.green_fee_weekday_vnd && (
                    <span className="text-xs text-yellow-600">
                      {ko ? '평일' : 'WD'} ₫{(c.green_fee_weekday_vnd / 1000).toFixed(0)}K
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
