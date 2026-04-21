'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Plus, ChevronLeft, X, Upload, ImageIcon, Lock, Camera } from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'

interface Album { id: string; title: string; cover_url?: string; created_at: string; photo_count?: number }
interface AlbumPhoto { id: string; url: string; caption?: string; created_at: string; uploader?: any }

export default function AlbumPage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'

  // 권한 분리: 앨범 생성/삭제 = 회장·총무 / 사진 업로드 = 임원 이상 / 열람 = 전체
  const canManageAlbum = ['president', 'secretary'].includes(myRole)
  const canUploadPhoto = OFFICER_ROLES.includes(myRole)   // member 역할 제외
  const isReadOnly     = !canUploadPhoto                   // 일반회원 = 열람 전용

  const [albums,        setAlbums]        = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos,        setPhotos]        = useState<AlbumPhoto[]>([])
  const [loading,       setLoading]       = useState(true)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [showCreate,    setShowCreate]    = useState(false)
  const [newTitle,      setNewTitle]      = useState('')
  const [creating,      setCreating]      = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [lightbox,      setLightbox]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function loadAlbums() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('albums').select('id,title,cover_url,created_at')
      .eq('club_id', currentClubId).order('created_at', { ascending: false })
    if (data) {
      const withCounts = await Promise.all(data.map(async a => {
        const { count } = await supabase.from('album_photos').select('*', { count: 'exact', head: true }).eq('album_id', a.id)
        return { ...a, photo_count: count ?? 0 }
      }))
      setAlbums(withCounts)
    }
    setLoading(false)
  }

  async function loadPhotos(albumId: string) {
    setPhotosLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('album_photos')
      .select('id,url,caption,created_at,uploader:users!uploaded_by(full_name)')
      .eq('album_id', albumId).order('created_at', { ascending: false })
    setPhotos(data ?? [])
    setPhotosLoading(false)
  }

  useEffect(() => { loadAlbums() }, [currentClubId])

  async function createAlbum() {
    if (!newTitle.trim() || !currentClubId) return
    setCreating(true)
    const supabase = createClient()
    const { data } = await supabase.from('albums')
      .insert({ club_id: currentClubId, title: newTitle.trim() }).select().single()
    if (data) { setShowCreate(false); setNewTitle(''); await loadAlbums(); openAlbum({ ...data, photo_count: 0 }) }
    setCreating(false)
  }

  function openAlbum(album: Album) { setSelectedAlbum(album); loadPhotos(album.id) }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !selectedAlbum || !user) return
    // 일반회원 업로드 방어
    if (!canUploadPhoto) return
    setUploading(true)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `albums/${selectedAlbum.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('club-media').upload(path, file)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('club-media').getPublicUrl(path)
        await supabase.from('album_photos').insert({
          album_id: selectedAlbum.id, url: urlData.publicUrl, uploaded_by: user.id,
        })
        if (photos.length === 0) {
          await supabase.from('albums').update({ cover_url: urlData.publicUrl }).eq('id', selectedAlbum.id)
        }
      }
    }
    await loadPhotos(selectedAlbum.id)
    await loadAlbums()
    setUploading(false)
    e.target.value = ''
  }

  // ── 앨범 목록 ──────────────────────────────────────────────────────────
  if (!selectedAlbum) {
    return (
      <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{ko ? '사진 앨범' : 'Photo Album'}</h1>
            {isReadOnly && (
              <div className="flex items-center gap-1 mt-0.5">
                <Lock size={10} style={{ color: '#5a7a5a' }} />
                <p className="text-xs" style={{ color: '#5a7a5a' }}>
                  {ko ? '열람 전용 (임원 이상 업로드 가능)' : 'View only — officers can upload'}
                </p>
              </div>
            )}
          </div>
          {canManageAlbum && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-xl transition"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
              <Plus size={15} /> {ko ? '앨범 만들기' : 'New Album'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
          </div>
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
            <ImageIcon size={44} className="mb-3 opacity-30" />
            <p className="text-sm">{ko ? '앨범이 없습니다' : 'No albums yet'}</p>
            {canManageAlbum && (
              <button onClick={() => setShowCreate(true)} className="mt-4 text-sm" style={{ color: '#22c55e' }}>
                {ko ? '첫 앨범 만들기' : 'Create first album'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {albums.map(album => (
              <button key={album.id} onClick={() => openAlbum(album)}
                className="glass-card rounded-2xl overflow-hidden text-left transition-all active:scale-[0.97]">
                <div className="aspect-square relative" style={{ background: '#0c160c' }}>
                  {album.cover_url
                    ? <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={36} style={{ color: '#1a3a1a' }} />
                      </div>
                    )}
                  <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, rgba(6,13,6,0.9), transparent)' }} />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-white text-sm font-semibold truncate">{album.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#5a7a5a' }}>
                    {album.photo_count}{ko ? '장' : ' photos'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 앨범 생성 모달 */}
        {showCreate && (
          <div className="fixed inset-0 flex items-end z-[200]" style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setShowCreate(false)}>
            <div className="w-full rounded-t-3xl p-6 space-y-4 animate-slide-up"
              style={{ background: '#0c160c', border: '1px solid rgba(34,197,94,0.2)', borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-1"><div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} /></div>
              <h3 className="text-base font-bold text-white">{ko ? '새 앨범' : 'New Album'}</h3>
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAlbum()}
                placeholder={ko ? '앨범 이름' : 'Album title'}
                className="input-field" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button onClick={createAlbum} disabled={creating || !newTitle.trim()}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold btn-primary disabled:opacity-50">
                  {creating ? (ko ? '만드는 중...' : 'Creating...') : (ko ? '만들기' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 사진 그리드 (앨범 내부) ────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedAlbum(null)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-white flex-1 truncate">{selectedAlbum.title}</h1>

        {canUploadPhoto && (
          <div className="flex items-center gap-2">
            {/* 카메라 직접 촬영 */}
            <button onClick={() => cameraRef.current?.click()} disabled={uploading}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
              title={ko ? '카메라 촬영' : 'Camera'}>
              <Camera size={17} />
            </button>
            {/* 갤러리 업로드 */}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-xl transition disabled:opacity-50"
              style={{ background: uploading ? 'rgba(22,163,74,0.4)' : 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
              <Upload size={14} />
              {uploading ? (ko ? '업로드 중...' : 'Uploading...') : (ko ? '사진 추가' : 'Add')}
            </button>
          </div>
        )}

        {/* 일반회원 열람 전용 표시 */}
        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
            <Lock size={11} style={{ color: '#5a7a5a' }} />
            <span className="text-xs" style={{ color: '#5a7a5a' }}>{ko ? '열람 전용' : 'View only'}</span>
          </div>
        )}
      </div>

      {/* hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={uploadPhoto} />
      <input ref={fileRef}   type="file" accept="image/*" multiple className="hidden" onChange={uploadPhoto} />

      {photosLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
          <ImageIcon size={44} className="mb-3 opacity-30" />
          <p className="text-sm">{ko ? '사진이 없습니다' : 'No photos yet'}</p>
          {canUploadPhoto && (
            <button onClick={() => fileRef.current?.click()} className="mt-4 text-sm" style={{ color: '#22c55e' }}>
              {ko ? '첫 사진 업로드' : 'Upload first photo'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map(photo => (
            <button key={photo.id} onClick={() => setLightbox(photo.url)}
              className="aspect-square rounded-xl overflow-hidden transition-all active:scale-[0.97]"
              style={{ background: '#0c160c' }}>
              <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* 사진 개수 + 업로더 정보 */}
      {photos.length > 0 && (
        <p className="text-center text-xs" style={{ color: '#3a5a3a' }}>
          {photos.length}{ko ? '장의 사진' : ' photos'}
        </p>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div className="fixed inset-0 flex items-center justify-center z-[300] p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightbox(null)}>
          <button className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            <X size={22} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
