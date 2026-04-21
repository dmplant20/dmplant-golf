'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  ChevronLeft, Camera, Save, Check, User,
  Phone, Mail, AtSign, Languages, Trash2,
} from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { user, setUser, lang, myClubs, currentClubId } = useAuthStore()
  const ko = lang === 'ko'

  const [form, setForm] = useState({
    full_name:    user?.full_name    ?? '',
    full_name_en: user?.full_name_en ?? '',
    name_abbr:    user?.name_abbr    ?? '',
    phone:        user?.phone        ?? '',
  })

  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [showSheet,     setShowSheet]     = useState(false)  // photo source picker

  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  // 클럽 역할 정보
  const myMembership = myClubs.find(c => c.id === currentClubId)
  const ROLE_MAP: Record<string, [string, string]> = {
    president:      ['회장',   'President'],
    vice_president: ['부회장', 'Vice President'],
    secretary:      ['총무',   'Secretary'],
    auditor:        ['감사',   'Auditor'],
    advisor:        ['고문',   'Advisor'],
    officer:        ['임원',   'Officer'],
    member:         ['회원',   'Member'],
  }
  const roleLabel = myMembership
    ? (ko ? (ROLE_MAP[myMembership.role]?.[0] ?? myMembership.role) : (ROLE_MAP[myMembership.role]?.[1] ?? myMembership.role))
    : null

  // 아바타 파일 선택 처리
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)
    setShowSheet(false)
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = ''
  }

  // 아바타 제거
  function removeAvatar() {
    if (avatarPreview) { URL.revokeObjectURL(avatarPreview); setAvatarPreview(null) }
    setAvatarFile(null)
    setShowSheet(false)
  }

  // 저장
  async function save() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()

    let avatar_url = user.avatar_url ?? null

    // 새 사진 업로드
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `avatars/${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('club-media')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('club-media').getPublicUrl(path)
        // 캐시 버스팅 파라미터 추가
        avatar_url = `${urlData.publicUrl}?v=${Date.now()}`
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update({ ...form, avatar_url })
      .eq('id', user.id)
      .select()
      .single()

    if (!error && data) {
      setUser(data)
      // preview URL 해제
      if (avatarPreview) { URL.revokeObjectURL(avatarPreview); setAvatarPreview(null) }
      setAvatarFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  // 언마운트 시 preview URL 정리
  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }
  }, [])

  const displayAvatar = avatarPreview ?? user?.avatar_url
  const hasChanges = avatarFile !== null ||
    form.full_name    !== (user?.full_name    ?? '') ||
    form.full_name_en !== (user?.full_name_en ?? '') ||
    form.name_abbr    !== (user?.name_abbr    ?? '') ||
    form.phone        !== (user?.phone        ?? '')

  return (
    <div className="min-h-screen pb-28">

      {/* ── Top Header ── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white p-1">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">
          {ko ? '프로필 수정' : 'Edit Profile'}
        </h1>
        {hasChanges && !saved && (
          <span className="text-xs text-yellow-400 animate-pulse">{ko ? '변경됨' : 'Modified'}</span>
        )}
        {saved && (
          <span className="text-xs text-green-400 flex items-center gap-1"><Check size={12} />{ko ? '저장됨' : 'Saved'}</span>
        )}
      </div>

      {/* ── Avatar Section ── */}
      <div className="flex flex-col items-center gap-3 py-6 bg-gradient-to-b from-green-900/20 to-transparent">
        {/* 아바타 원 */}
        <div className="relative">
          <button
            onClick={() => setShowSheet(true)}
            className="relative w-28 h-28 rounded-full overflow-hidden bg-gray-800 border-4 border-green-700/60 hover:border-green-500 transition shadow-lg shadow-green-900/30"
          >
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User size={44} className="text-gray-500" />
              </div>
            )}
            {/* 어두운 오버레이 + 카메라 아이콘 */}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera size={28} className="text-white" />
            </div>
          </button>
          {/* 카메라 배지 */}
          <button
            onClick={() => setShowSheet(true)}
            className="absolute bottom-0.5 right-0.5 w-8 h-8 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-950 transition shadow"
          >
            <Camera size={14} className="text-white" />
          </button>
        </div>

        {/* 사진 미리보기 안내 */}
        {avatarPreview && (
          <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded-full px-3 py-1.5">
            <span>📷 {ko ? '새 사진 선택됨 — 저장 시 적용됩니다' : 'New photo selected — save to apply'}</span>
          </div>
        )}

        <p className="text-xs text-gray-400">
          {ko ? '사진을 탭해서 변경하세요' : 'Tap photo to change'}
        </p>
      </div>

      {/* ── Form ── */}
      <div className="px-4 space-y-4">

        <div className="glass-card rounded-2xl divide-y divide-gray-800/60 overflow-hidden">

          {/* 이름(한글) */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <AtSign size={16} className="text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{ko ? '이름 (한글)' : 'Name (Korean)'}</p>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
                placeholder={ko ? '한글 이름' : 'Korean name'}
              />
            </div>
          </div>

          {/* 이름(영문) */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Languages size={16} className="text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{ko ? '이름 (영문)' : 'Name (English)'}</p>
              <input
                type="text"
                value={form.full_name_en}
                onChange={e => setForm(f => ({ ...f, full_name_en: e.target.value }))}
                className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
                placeholder="Hong Gil-dong"
              />
            </div>
          </div>

          {/* 약칭 */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-gray-500 text-sm flex-shrink-0 w-4 text-center font-bold">A</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{ko ? '약칭 · 이니셜' : 'Abbreviation'}</p>
              <input
                type="text"
                value={form.name_abbr}
                onChange={e => setForm(f => ({ ...f, name_abbr: e.target.value }))}
                className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
                placeholder={ko ? '예: 홍GD' : 'e.g. HGD'}
              />
            </div>
          </div>

          {/* 전화번호 */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Phone size={16} className="text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{ko ? '전화번호' : 'Phone'}</p>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
                placeholder="+84 90 000 0000"
              />
            </div>
          </div>
        </div>

        {/* 읽기 전용 정보 */}
        <div className="glass-card rounded-2xl divide-y divide-gray-800/60 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail size={16} className="text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{ko ? '이메일' : 'Email'}</p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          {myMembership && (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-gray-500 text-base flex-shrink-0 w-4 text-center">⛳</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{ko ? '클럽 역할' : 'Club Role'}</p>
                <p className="text-sm text-gray-300">{roleLabel} · {myMembership.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={save}
          disabled={saving || (!hasChanges && !saved)}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all ${
            saved
              ? 'bg-green-800 text-green-200'
              : hasChanges
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/40 active:scale-95'
              : 'bg-gray-800 text-gray-600 cursor-default'
          }`}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {ko ? '저장 중...' : 'Saving...'}
            </>
          ) : saved ? (
            <><Check size={16} />{ko ? '저장 완료!' : 'Saved!'}</>
          ) : (
            <><Save size={16} />{ko ? '저장하기' : 'Save Changes'}</>
          )}
        </button>

      </div>

      {/* ── 숨겨진 파일 인풋 ── */}
      {/* 카메라 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* 갤러리 */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── 사진 소스 선택 시트 ── */}
      {showSheet && (
        <div className="fixed inset-0 z-[200]" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl px-5 pt-3 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <p className="text-sm font-semibold text-white text-center mb-4">
              {ko ? '프로필 사진 변경' : 'Change Profile Photo'}
            </p>

            <div className="space-y-2">
              {/* 카메라 촬영 */}
              <button
                onClick={() => { cameraRef.current?.click() }}
                className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3.5 transition"
              >
                <div className="w-10 h-10 bg-green-900/60 rounded-full flex items-center justify-center flex-shrink-0">
                  <Camera size={20} className="text-green-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{ko ? '카메라로 촬영' : 'Take Photo'}</p>
                  <p className="text-xs text-gray-500">{ko ? '셀피 카메라를 사용합니다' : 'Use front camera'}</p>
                </div>
              </button>

              {/* 갤러리 선택 */}
              <button
                onClick={() => { galleryRef.current?.click() }}
                className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3.5 transition"
              >
                <div className="w-10 h-10 bg-blue-900/60 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{ko ? '갤러리에서 선택' : 'Choose from Gallery'}</p>
                  <p className="text-xs text-gray-500">{ko ? '사진 앨범에서 선택합니다' : 'Pick from your photos'}</p>
                </div>
              </button>

              {/* 사진 제거 (현재 사진이 있을 때만) */}
              {(displayAvatar) && (
                <button
                  onClick={removeAvatar}
                  className="w-full flex items-center gap-4 bg-gray-800 hover:bg-red-900/30 rounded-xl px-4 py-3.5 transition"
                >
                  <div className="w-10 h-10 bg-red-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <Trash2 size={18} className="text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-400">{ko ? '사진 제거' : 'Remove Photo'}</p>
                    <p className="text-xs text-gray-500">{ko ? '기본 아이콘으로 변경됩니다' : 'Revert to default icon'}</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => setShowSheet(false)}
                className="w-full py-3 rounded-xl text-gray-400 text-sm hover:text-white transition"
              >
                {ko ? '취소' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
