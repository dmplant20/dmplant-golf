'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Plus, ChevronLeft, X, Upload, ImageIcon, Camera,
  Trash2, Edit2, ChevronLeft as PrevIcon, ChevronRight as NextIcon, Loader2,
} from 'lucide-react'
import { isSuperAdmin } from '@/lib/superAdmin'
import { sendClubPush } from '@/lib/push'

// ── 테마 정의 ──────────────────────────────────────────────────────────────
type ThemeKey = 'awards' | 'tournament' | 'meeting' | 'event' | 'travel' | 'casual'
const THEMES: { key: ThemeKey; ko: string; en: string; emoji: string; color: string; bg: string }[] = [
  { key: 'awards',     ko: '시상식',  en: 'Awards',     emoji: '🏆', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  { key: 'tournament', ko: '라운드',  en: 'Tournament', emoji: '⛳', color: '#86efac', bg: 'rgba(34,197,94,0.15)'  },
  { key: 'meeting',    ko: '모임',    en: 'Meeting',    emoji: '🍽️', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)'  },
  { key: 'event',      ko: '행사',    en: 'Event',      emoji: '🎉', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)'},
  { key: 'travel',     ko: '여행',    en: 'Travel',     emoji: '✈️', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  { key: 'casual',     ko: '일상',    en: 'Casual',     emoji: '📸', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)'},
]
const themeOf = (k?: string) => THEMES.find(t => t.key === k) ?? THEMES[5]

interface Album {
  id: string; title: string; cover_url?: string; created_at: string
  theme?: ThemeKey; description?: string; created_by?: string
  event_date?: string | null
  photo_count?: number; creator_name?: string
}
interface AlbumPhoto {
  id: string; url: string; caption?: string; created_at: string
  taken_at?: string | null
  uploaded_by?: string; uploader?: { full_name?: string } | null
}

// 날짜·시간 포맷
function fmtDate(d?: string | null) {
  if (!d) return ''
  const x = new Date(d)
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')}`
}
function fmtDateTime(d?: string | null) {
  if (!d) return ''
  const x = new Date(d)
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`
}

export default function AlbumPage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const isAdmin = isSuperAdmin(user)
  const isManager = ['president', 'secretary'].includes(myRole) || isAdmin

  // ── 상태 ────────────────────────────────────────────────────────────────
  const [albums,        setAlbums]        = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos,        setPhotos]        = useState<AlbumPhoto[]>([])
  const [loading,       setLoading]       = useState(true)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [filterTheme,   setFilterTheme]   = useState<'all' | ThemeKey>('all')

  // 모달
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<{ title: string; theme: ThemeKey; description: string; event_date: string }>({
    title: '', theme: 'casual', description: '', event_date: '',
  })
  const [creating, setCreating] = useState(false)
  const [showEditAlbum, setShowEditAlbum] = useState(false)

  // 업로드
  const [uploading, setUploading] = useState(false)
  const [uploadProg, setUploadProg] = useState({ done: 0, total: 0 })
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  // 라이트박스 + 캡션 편집
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft, setCaptionDraft] = useState('')

  // ── 로드 ────────────────────────────────────────────────────────────────
  async function loadAlbums() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('albums')
      .select('id,title,cover_url,created_at,theme,description,created_by,event_date,users:users!created_by(full_name)')
      .eq('club_id', currentClubId)
      // 행사일이 있으면 우선 정렬, 없으면 생성일
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (data) {
      const withCounts = await Promise.all(data.map(async (a: any) => {
        const { count } = await supabase.from('album_photos')
          .select('*', { count: 'exact', head: true }).eq('album_id', a.id)
        const u = Array.isArray(a.users) ? a.users[0] : a.users
        return { ...a, photo_count: count ?? 0, creator_name: u?.full_name ?? null }
      }))
      setAlbums(withCounts as Album[])
    }
    setLoading(false)
  }
  async function loadPhotos(albumId: string) {
    setPhotosLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('album_photos')
      .select('id,url,caption,created_at,taken_at,uploaded_by,uploader:users!uploaded_by(full_name)')
      .eq('album_id', albumId).order('created_at', { ascending: false })
    setPhotos((data ?? []) as AlbumPhoto[])
    setPhotosLoading(false)
  }
  useEffect(() => { loadAlbums() }, [currentClubId])

  // 테마 필터링
  const filteredAlbums = useMemo(
    () => filterTheme === 'all' ? albums : albums.filter(a => (a.theme ?? 'casual') === filterTheme),
    [albums, filterTheme]
  )
  // 테마별 카운트
  const themeCounts = useMemo(() => {
    const m: Record<string, number> = { all: albums.length }
    THEMES.forEach(t => { m[t.key] = albums.filter(a => (a.theme ?? 'casual') === t.key).length })
    return m
  }, [albums])

  // ── 앨범 생성 ──────────────────────────────────────────────────────────
  async function createAlbum() {
    if (!createForm.title.trim() || !currentClubId || !user) return
    setCreating(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('albums').insert({
      club_id: currentClubId,
      title: createForm.title.trim(),
      theme: createForm.theme,
      description: createForm.description.trim() || null,
      event_date: createForm.event_date || null,
      created_by: user.id,
    }).select().single()
    setCreating(false)
    if (error) { alert(ko ? `생성 실패: ${error.message}` : `Failed: ${error.message}`); return }
    setShowCreate(false)
    setCreateForm({ title: '', theme: 'casual', description: '', event_date: '' })
    await loadAlbums()
    if (data) openAlbum({ ...data, photo_count: 0 } as Album)

    // 푸시 — 새 앨범 알림 (작성자 자동 제외)
    try {
      const themeLabel = themeOf(data?.theme ?? createForm.theme)
      await sendClubPush({
        club_id: currentClubId,
        title: `📷 ${ko ? '새 앨범' : 'New Album'}: ${createForm.title.trim()}`,
        body: `${themeLabel.emoji} ${ko ? themeLabel.ko : themeLabel.en}${user.full_name ? ` · ${user.full_name}` : ''}${createForm.event_date ? ` · ${createForm.event_date}` : ''}`,
        url: '/album',
      })
    } catch (e) { console.warn('[album push]', e) }
  }
  function openAlbum(album: Album) { setSelectedAlbum(album); loadPhotos(album.id) }

  // ── 앨범 수정 / 삭제 ─────────────────────────────────────────────────
  async function saveAlbumEdit() {
    if (!selectedAlbum) return
    const supabase = createClient()
    const { error } = await supabase.from('albums').update({
      title: createForm.title.trim() || selectedAlbum.title,
      theme: createForm.theme,
      description: createForm.description.trim() || null,
      event_date: createForm.event_date || null,
    }).eq('id', selectedAlbum.id)
    if (error) { alert(ko ? `저장 실패: ${error.message}` : `Failed: ${error.message}`); return }
    setShowEditAlbum(false)
    await loadAlbums()
    setSelectedAlbum(prev => prev ? {
      ...prev,
      title: createForm.title.trim() || prev.title,
      theme: createForm.theme,
      description: createForm.description.trim(),
      event_date: createForm.event_date || null,
    } : prev)
  }
  async function deleteAlbum() {
    if (!selectedAlbum) return
    if (!confirm(ko ? `'${selectedAlbum.title}' 앨범을 삭제하시겠습니까? 안의 사진도 모두 사라집니다.` : `Delete album '${selectedAlbum.title}' and all its photos?`)) return
    const supabase = createClient()
    // 사진 먼저 삭제
    await supabase.from('album_photos').delete().eq('album_id', selectedAlbum.id)
    const { error } = await supabase.from('albums').delete().eq('id', selectedAlbum.id)
    if (error) { alert(ko ? `삭제 실패: ${error.message}` : `Failed: ${error.message}`); return }
    setSelectedAlbum(null)
    await loadAlbums()
  }

  // ── 사진 업로드 ─────────────────────────────────────────────────────
  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !files.length || !selectedAlbum || !user) return
    setUploading(true)
    setUploadProg({ done: 0, total: files.length })
    const supabase = createClient()
    let firstUrl: string | null = null
    const arr = Array.from(files)
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i]
      try {
        if (file.size > 20 * 1024 * 1024) { console.warn('skip 20MB+:', file.name); continue }
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `albums/${selectedAlbum.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('club-media').upload(path, file, { contentType: file.type })
        if (upErr) { console.error('upload', upErr); continue }
        const { data: urlData } = supabase.storage.from('club-media').getPublicUrl(path)
        const url = urlData.publicUrl
        // file.lastModified 가 0 이거나 너무 옛날이면 무시 (브라우저별 차이)
        const lm = file.lastModified
        const takenAt = (lm && lm > 0 && lm < Date.now() + 86400_000)
          ? new Date(lm).toISOString() : null
        await supabase.from('album_photos').insert({
          album_id: selectedAlbum.id, url, uploaded_by: user.id,
          taken_at: takenAt,
        })
        if (!firstUrl) firstUrl = url
      } catch (err) { console.error('upload err', err) }
      setUploadProg({ done: i + 1, total: arr.length })
    }
    // 첫 사진이면 커버 자동 설정
    if (firstUrl && photos.length === 0) {
      await supabase.from('albums').update({ cover_url: firstUrl }).eq('id', selectedAlbum.id)
    }
    await loadPhotos(selectedAlbum.id)
    await loadAlbums()
    setUploading(false)
    setUploadProg({ done: 0, total: 0 })
    e.target.value = ''

    // 푸시 — 업로드 세션 종료 시 한 번만 (개별 사진마다 발송하면 스팸)
    if (currentClubId && arr.length > 0) {
      try {
        await sendClubPush({
          club_id: currentClubId,
          title: `📸 ${selectedAlbum.title}`,
          body: `${user.full_name ?? ''} ${ko ? `님이 사진 ${arr.length}장을 추가했습니다` : `added ${arr.length} photo(s)`}`,
          url: '/album',
        })
      } catch (e) { console.warn('[photo push]', e) }
    }
  }

  // ── 사진 삭제 / 캡션 ──────────────────────────────────────────────
  async function deletePhoto(p: AlbumPhoto) {
    if (!confirm(ko ? '이 사진을 삭제하시겠습니까?' : 'Delete this photo?')) return
    const supabase = createClient()
    const { error } = await supabase.from('album_photos').delete().eq('id', p.id)
    if (error) { alert(ko ? `삭제 실패: ${error.message}` : `Failed: ${error.message}`); return }
    // 라이트박스가 열린 사진을 지운 거면 닫기
    if (lightboxIdx != null && photos[lightboxIdx]?.id === p.id) setLightboxIdx(null)
    if (selectedAlbum) { await loadPhotos(selectedAlbum.id); await loadAlbums() }
  }
  async function saveCaption() {
    if (lightboxIdx == null) return
    const p = photos[lightboxIdx]
    if (!p) return
    const supabase = createClient()
    const { error } = await supabase.from('album_photos').update({ caption: captionDraft.trim() || null }).eq('id', p.id)
    if (error) { alert(ko ? `저장 실패: ${error.message}` : `Failed: ${error.message}`); return }
    setEditingCaption(false)
    if (selectedAlbum) await loadPhotos(selectedAlbum.id)
  }

  // ── 라이트박스 키보드 ─────────────────────────────────────────────
  useEffect(() => {
    if (lightboxIdx == null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIdx(null)
      else if (e.key === 'ArrowLeft') setLightboxIdx(i => i != null && i > 0 ? i - 1 : i)
      else if (e.key === 'ArrowRight') setLightboxIdx(i => i != null && i < photos.length - 1 ? i + 1 : i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, photos.length])

  // ────────────────────────────────────────────────────────────────────
  // 앨범 목록 뷰
  // ────────────────────────────────────────────────────────────────────
  if (!selectedAlbum) {
    return (
      <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{ko ? '갤러리' : 'Gallery'}</h1>
            <p className="text-xs mt-0.5" style={{ color: '#5a7a5a' }}>
              {ko ? '회원 누구나 앨범 만들고 사진 올릴 수 있어요' : 'Any member can create albums and add photos'}
            </p>
          </div>
          <button onClick={() => { setCreateForm({ title: '', theme: 'casual', description: '', event_date: new Date().toISOString().slice(0,10) }); setShowCreate(true) }}
            className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-xl transition active:scale-95"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
            <Plus size={15} /> {ko ? '앨범 만들기' : 'New Album'}
          </button>
        </div>

        {/* 테마 필터 pills */}
        <div className="flex gap-1.5 overflow-x-auto scroll-hide pb-1 -mx-1 px-1">
          <button onClick={() => setFilterTheme('all')}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={filterTheme === 'all'
              ? { background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff' }
              : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
            {ko ? '전체' : 'All'} <span className="text-[10px] opacity-70">{themeCounts.all}</span>
          </button>
          {THEMES.map(t => (
            <button key={t.key} onClick={() => setFilterTheme(t.key)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
              style={filterTheme === t.key
                ? { background: t.bg, color: t.color, border: `1px solid ${t.color}80` }
                : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span>{t.emoji}</span>
              {ko ? t.ko : t.en}
              <span className="text-[10px] opacity-70">{themeCounts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* 앨범 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
          </div>
        ) : filteredAlbums.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
            <ImageIcon size={44} className="mb-3 opacity-30" />
            <p className="text-sm">{ko ? '아직 앨범이 없습니다' : 'No albums yet'}</p>
            <button onClick={() => { setCreateForm({ title: '', theme: 'casual', description: '', event_date: new Date().toISOString().slice(0,10) }); setShowCreate(true) }}
              className="mt-4 text-sm" style={{ color: '#22c55e' }}>
              {ko ? '+ 첫 앨범 만들기' : '+ Create first album'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredAlbums.map(album => {
              const t = themeOf(album.theme)
              return (
                <button key={album.id} onClick={() => openAlbum(album)}
                  className="glass-card rounded-2xl overflow-hidden text-left transition-all active:scale-[0.97]">
                  <div className="aspect-square relative" style={{ background: '#0c160c' }}>
                    {album.cover_url
                      ? <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" loading="lazy" />
                      : (
                        <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: t.bg }}>
                          {t.emoji}
                        </div>
                      )}
                    {/* 테마 뱃지 */}
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
                      style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}80` }}>
                      {t.emoji} {ko ? t.ko : t.en}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                      style={{ background: 'linear-gradient(to top, rgba(6,13,6,0.95), transparent)' }} />
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-white text-sm font-semibold truncate">{album.title}</p>
                    {album.event_date && (
                      <p className="text-[11px] mt-0.5 font-semibold" style={{ color: '#fbbf24' }}>
                        📅 {fmtDate(album.event_date)}
                      </p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color: '#5a7a5a' }}>
                      {album.photo_count ?? 0}{ko ? '장' : ' photos'}
                      {album.creator_name && <> · {album.creator_name}</>}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 앨범 생성 모달 — Portal 로 document.body 에 직접 렌더 (stacking context 우회) */}
        {showCreate && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 flex items-end" style={{ zIndex: 99999, background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowCreate(false)}>
            <div className="w-full rounded-t-3xl flex flex-col animate-slide-up"
              style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.2)', borderBottom: 'none', maxHeight: '92dvh' }}
              onClick={e => e.stopPropagation()}>
              {/* 헤더 (고정) */}
              <div className="flex-shrink-0 px-6 pt-4">
                <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} /></div>
                <h3 className="text-base font-bold text-white">{ko ? '새 앨범 만들기' : 'New Album'}</h3>
                <p className="text-[11px] mt-1" style={{ color: '#86efac' }}>
                  💡 {ko ? '먼저 앨범을 만들고, 다음 화면에서 사진을 올립니다' : 'Create album first, then add photos'}
                </p>
              </div>

              {/* 본문 (스크롤 가능) */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>
                    {ko ? '제목' : 'Title'} *
                  </label>
                  <input type="text" value={createForm.title}
                    onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={ko ? '예: 2026년 5월 라운드' : 'e.g. May 2026 Round'}
                    className="input-field" autoFocus />
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>
                    {ko ? '테마' : 'Theme'}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {THEMES.map(t => (
                      <button key={t.key} onClick={() => setCreateForm(f => ({ ...f, theme: t.key }))}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition active:scale-95"
                        style={createForm.theme === t.key
                          ? { background: t.bg, color: t.color, border: `1.5px solid ${t.color}` }
                          : { background: 'rgba(255,255,255,0.03)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xl">{t.emoji}</span>
                        <span className="text-[11px] font-semibold">{ko ? t.ko : t.en}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>
                    📅 {ko ? '행사일 (선택)' : 'Event date (optional)'}
                  </label>
                  <input type="date" value={createForm.event_date}
                    onChange={e => setCreateForm(f => ({ ...f, event_date: e.target.value }))}
                    className="input-field" />
                  <p className="text-[10px] mt-1" style={{ color: '#5a7a5a' }}>
                    {ko ? '시상식·라운드가 실제 있었던 날짜' : 'When the event actually happened'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>
                    {ko ? '설명 (선택)' : 'Description (optional)'}
                  </label>
                  <textarea rows={2} value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={ko ? '간단한 메모를 적어두세요' : 'Optional note'}
                    className="input-field resize-none text-sm" />
                </div>
              </div>

              {/* 하단 버튼 (고정) */}
              <div className="flex-shrink-0 flex gap-3 px-6 py-4"
                style={{ borderTop: '1px solid rgba(34,197,94,0.15)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button onClick={createAlbum} disabled={creating || !createForm.title.trim()}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.4)' }}>
                  {creating ? (ko ? '만드는 중...' : 'Creating...') : (ko ? '만들기 →' : 'Create →')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────
  // 앨범 상세 (사진 그리드 + 라이트박스)
  // ────────────────────────────────────────────────────────────────────
  const t = themeOf(selectedAlbum.theme)
  const isOwner = isManager || selectedAlbum.created_by === user?.id

  return (
    <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedAlbum(null)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}80` }}>
              {t.emoji} {ko ? t.ko : t.en}
            </span>
            <h1 className="text-base font-bold text-white truncate">{selectedAlbum.title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {selectedAlbum.event_date && (
              <span className="text-[11px] font-semibold" style={{ color: '#fbbf24' }}>
                📅 {fmtDate(selectedAlbum.event_date)}
              </span>
            )}
            {selectedAlbum.description && (
              <span className="text-[11px] truncate" style={{ color: '#86efac' }}>{selectedAlbum.description}</span>
            )}
          </div>
        </div>
        {isOwner && (
          <button onClick={() => {
            setCreateForm({
              title: selectedAlbum.title,
              theme: selectedAlbum.theme ?? 'casual',
              description: selectedAlbum.description ?? '',
              event_date: selectedAlbum.event_date ? String(selectedAlbum.event_date).slice(0,10) : '',
            })
            setShowEditAlbum(true)
          }}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>

      {/* 업로드 버튼 행 — 모든 회원 */}
      <div className="flex items-center gap-2">
        <button onClick={() => cameraRef.current?.click()} disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
          <Camera size={15} />
          {ko ? '카메라' : 'Camera'}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading
            ? `${uploadProg.done}/${uploadProg.total}`
            : (ko ? '사진 추가' : 'Add Photos')}
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={uploadPhoto} />
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadPhoto} />

      {/* 사진 그리드 */}
      {photosLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
          <ImageIcon size={44} className="mb-3 opacity-30" />
          <p className="text-sm">{ko ? '사진이 없습니다 — 첫 사진을 올려보세요!' : 'No photos yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo, idx) => (
            <button key={photo.id} onClick={() => { setLightboxIdx(idx); setEditingCaption(false) }}
              className="aspect-square rounded-xl overflow-hidden transition-all active:scale-[0.97] relative"
              style={{ background: '#0c160c' }}>
              <img src={photo.url} alt={photo.caption ?? ''}
                className="w-full h-full object-cover" loading="lazy" />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] text-white truncate"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                  {photo.caption}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <p className="text-center text-xs" style={{ color: '#3a5a3a' }}>
          {photos.length}{ko ? '장의 사진' : ' photos'}
        </p>
      )}

      {/* 앨범 수정 모달 — Portal */}
      {showEditAlbum && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-end" style={{ zIndex: 99999, background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setShowEditAlbum(false)}>
          <div className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.2)', borderBottom: 'none', maxHeight: '92dvh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 px-6 pt-4">
              <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} /></div>
              <h3 className="text-base font-bold text-white">{ko ? '앨범 편집' : 'Edit Album'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>{ko ? '제목' : 'Title'}</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>{ko ? '테마' : 'Theme'}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {THEMES.map(tt => (
                    <button key={tt.key} onClick={() => setCreateForm(f => ({ ...f, theme: tt.key }))}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition active:scale-95"
                      style={createForm.theme === tt.key
                        ? { background: tt.bg, color: tt.color, border: `1.5px solid ${tt.color}` }
                        : { background: 'rgba(255,255,255,0.03)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-xl">{tt.emoji}</span>
                      <span className="text-[11px] font-semibold">{ko ? tt.ko : tt.en}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>📅 {ko ? '행사일' : 'Event date'}</label>
                <input type="date" value={createForm.event_date}
                  onChange={e => setCreateForm(f => ({ ...f, event_date: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>{ko ? '설명' : 'Description'}</label>
                <textarea rows={2} value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  className="input-field resize-none text-sm" />
              </div>
            </div>
            <div className="flex-shrink-0 flex gap-3 px-6 py-4"
              style={{ borderTop: '1px solid rgba(34,197,94,0.15)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => deleteAlbum()} className="px-3 py-3 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                <Trash2 size={14} /> {ko ? '삭제' : 'Delete'}
              </button>
              <button onClick={() => setShowEditAlbum(false)} className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={saveAlbumEdit} className="flex-1 py-3 rounded-xl text-white text-sm font-bold active:scale-95"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                {ko ? '저장' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 라이트박스 */}
      {lightboxIdx != null && photos[lightboxIdx] && (() => {
        const cur = photos[lightboxIdx]
        const isMyPhoto = cur.uploaded_by === user?.id || isManager
        return (
          <div className="fixed inset-0 z-[300]" style={{ background: 'rgba(0,0,0,0.95)' }}
            onClick={() => { setLightboxIdx(null); setEditingCaption(false) }}>
            {/* 닫기 */}
            <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(null) }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
              <X size={20} />
            </button>
            {/* 카운터 + 업로더 */}
            <div className="absolute top-4 left-4 z-10 text-white text-xs flex flex-wrap gap-1.5 max-w-[calc(100%-72px)]">
              <span className="px-2 py-1 rounded-md" style={{ background: 'rgba(0,0,0,0.5)' }}>
                {lightboxIdx + 1} / {photos.length}
              </span>
              {cur.uploader?.full_name && (
                <span className="px-2 py-1 rounded-md" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  📸 {cur.uploader.full_name}
                </span>
              )}
              {(cur.taken_at || cur.created_at) && (
                <span className="px-2 py-1 rounded-md" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  🕒 {fmtDateTime(cur.taken_at || cur.created_at)}
                </span>
              )}
            </div>
            {/* 이미지 */}
            <div className="absolute inset-0 flex items-center justify-center p-6" onClick={e => e.stopPropagation()}>
              <img src={cur.url} alt={cur.caption ?? ''} className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            {/* 좌우 화살표 */}
            {lightboxIdx > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i! - 1); setEditingCaption(false) }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                <PrevIcon size={22} />
              </button>
            )}
            {lightboxIdx < photos.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i! + 1); setEditingCaption(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                <NextIcon size={22} />
              </button>
            )}
            {/* 하단 — 캡션 + 액션 */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10 space-y-2"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}
              onClick={e => e.stopPropagation()}>
              {editingCaption && isMyPhoto ? (
                <div className="flex gap-2">
                  <input autoFocus value={captionDraft} onChange={e => setCaptionDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCaption() }}
                    placeholder={ko ? '캡션 입력...' : 'Caption...'}
                    className="flex-1 bg-black/50 border border-white/30 rounded-lg px-3 py-2 text-white text-sm" />
                  <button onClick={saveCaption} className="px-3 py-2 rounded-lg text-sm font-bold text-white"
                    style={{ background: '#16a34a' }}>
                    {ko ? '저장' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <p className="flex-1 text-white text-sm">{cur.caption || (isMyPhoto ? (ko ? '캡션 추가하려면 ✏️ 클릭' : 'Tap ✏️ to add caption') : '')}</p>
                  {isMyPhoto && (
                    <>
                      <button onClick={() => { setCaptionDraft(cur.caption ?? ''); setEditingCaption(true) }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deletePhoto(cur)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
