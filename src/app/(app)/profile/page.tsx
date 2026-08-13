'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Camera, ChevronLeft, Save, Phone, User, Calendar, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ProfilePage() {
  const router = useRouter()
  const { user, lang, setUser } = useAuthStore()
  const ko = lang === 'ko'
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name_en: '',
    name_abbr:    '',
    phone:        '',
    birth_month:  '' as string | number,
    birth_day:    '' as string | number,
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'ok' | 'err'>('idle')
  const [errMsg,  setErrMsg]  = useState('')

  // user 로드되면 form 동기화
  useEffect(() => {
    if (!user) return
    setForm({
      full_name_en: user.full_name_en ?? '',
      name_abbr:    user.name_abbr    ?? '',
      phone:        (user as any).phone ?? '',
      birth_month:  (user as any).birth_month ?? '',
      birth_day:    (user as any).birth_day   ?? '',
    })
    setAvatarPreview((user as any).avatar_url ?? null)
  }, [user?.id])

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    setStatus('idle')
    setErrMsg('')

    const supabase = createClient()
    let avatar_url = (user as any).avatar_url ?? null

    // ── 아바타 업로드 ────────────────────────────────────────────
    if (avatarFile) {
      try {
        const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/avatar.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
          avatar_url = publicUrl + `?t=${Date.now()}`
        }
      } catch { /* storage 버킷 미설정 시 무시, 나머지는 저장 */ }
    }

    const updates: Record<string, any> = {
      full_name_en: form.full_name_en || null,
      name_abbr:    form.name_abbr    || null,
      phone:        form.phone        || null,
      birth_month:  form.birth_month  ? Number(form.birth_month) : null,
      birth_day:    form.birth_day    ? Number(form.birth_day)   : null,
      ...(avatar_url ? { avatar_url } : {}),
    }

    // 최대 3회 재시도 — 강력 저장
    let retries = 3
    let lastErr: any = null

    while (retries > 0) {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)

      if (!error) {
        setUser({ ...user, ...updates } as any)
        setAvatarFile(null)
        setSaving(false)
        setStatus('ok')
        setTimeout(() => setStatus('idle'), 3000)
        return
      }
      lastErr = error
      retries--
      if (retries > 0) await new Promise(r => setTimeout(r, 800))
    }

    setSaving(false)
    setStatus('err')
    setErrMsg(lastErr?.message ?? (ko ? '저장 실패. 다시 시도해주세요.' : 'Save failed. Please try again.'))
  }

  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="min-h-screen pb-28 animate-fade-in" style={{ background: 'var(--bg)' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white transition"
          style={{ background: 'var(--surface)' }}>
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-bold text-white flex-1">{ko ? '내 프로필' : 'My Profile'}</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)' }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {ko ? '저장' : 'Save'}
        </button>
      </div>

      {/* ── 상태 배너 ────────────────────────────────────────────── */}
      {status === 'ok' && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
          <CheckCircle size={16} />
          {ko ? '저장되었습니다 ✓' : 'Saved successfully ✓'}
        </div>
      )}
      {status === 'err' && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
          <AlertCircle size={16} />
          {errMsg}
        </div>
      )}

      <div className="px-4 pt-6 space-y-4">

        {/* ── 아바타 ───────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.08)', border: '2px solid rgba(201,168,76,0.3)' }}>
              {avatarPreview
                ? <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
                : <User size={48} className="text-gray-600" />}
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition active:scale-95"
              style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)', border: '2px solid var(--bg)' }}>
              <Camera size={15} className="text-white" />
            </button>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-lg">{user?.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gold)' }}>
              {ko ? '📷 사진을 탭해 변경' : '📷 Tap to change photo'}
            </p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onAvatarChange} />
        </div>

        {/* ── 영문 이름 ─────────────────────────────────────────────── */}
        <FieldCard icon={<User size={14} />} title={ko ? '영문 이름' : 'English Name'}>
          <input
            type="text"
            value={form.full_name_en}
            onChange={e => setForm(f => ({ ...f, full_name_en: e.target.value }))}
            placeholder="Hong Gil-dong"
            className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
          />
        </FieldCard>

        {/* ── 약자 ─────────────────────────────────────────────────── */}
        <FieldCard icon={<User size={14} />} title={ko ? '약자 · 이니셜' : 'Abbreviation'}>
          <input
            type="text"
            value={form.name_abbr}
            onChange={e => setForm(f => ({ ...f, name_abbr: e.target.value }))}
            placeholder={ko ? '예: HGD, CSB' : 'e.g. HGD, CSB'}
            className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
          />
        </FieldCard>

        {/* ── 전화번호 ─────────────────────────────────────────────── */}
        <FieldCard icon={<Phone size={14} />} title={ko ? '전화번호' : 'Phone Number'}>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="010-0000-0000"
            className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
            inputMode="tel"
          />
        </FieldCard>

        {/* ── 생월 · 생일 ───────────────────────────────────────────── */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gold)' }}>
              {ko ? '생월 · 생일 (연도 제외)' : 'Birth Month & Day'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-2)' }}>{ko ? '월' : 'Month'}</p>
              <select
                value={form.birth_month}
                onChange={e => setForm(f => ({ ...f, birth_month: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', colorScheme: 'dark' }}
              >
                <option value="">{ko ? '선택' : 'Select'}</option>
                {MONTHS_KO.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{ko ? m : MONTHS_EN[i]}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-2)' }}>{ko ? '일' : 'Day'}</p>
              <select
                value={form.birth_day}
                onChange={e => setForm(f => ({ ...f, birth_day: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', colorScheme: 'dark' }}
              >
                <option value="">{ko ? '선택' : 'Select'}</option>
                {days.map(d => <option key={d} value={d}>{d}{ko ? '일' : ''}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── 하단 저장 버튼 ────────────────────────────────────────── */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition active:scale-[0.98] disabled:opacity-60 mt-2"
          style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)' }}
        >
          {saving
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                {ko ? '저장 중...' : 'Saving...'}
              </span>
            : ko ? '💾  저장하기' : '💾  Save Profile'}
        </button>

        <p className="text-center text-xs pb-4" style={{ color: 'var(--text-3)' }}>
          {ko
            ? '비어있는 항목은 그대로 유지됩니다. 일부만 입력해도 저장됩니다.'
            : 'Empty fields stay as-is. Partial saves are supported.'}
        </p>
      </div>
    </div>
  )
}

function FieldCard({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl px-4 py-3.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: 'var(--gold)' }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gold)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
