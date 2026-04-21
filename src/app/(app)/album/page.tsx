'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Plus, ChevronLeft, X, Upload, ImageIcon } from 'lucide-react'

interface Album {
  id: string
  title: string
  cover_url?: string
  created_at: string
  photo_count?: number
}

interface AlbumPhoto {
  id: string
  url: string
  caption?: string
  created_at: string
}

export default function AlbumPage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<AlbumPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadAlbums() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('albums')
      .select('id, title, cover_url, created_at')
      .eq('club_id', currentClubId)
      .order('created_at', { ascending: false })

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (a) => {
          const { count } = await supabase
            .from('album_photos')
            .select('*', { count: 'exact', head: true })
            .eq('album_id', a.id)
          return { ...a, photo_count: count ?? 0 }
        })
      )
      setAlbums(withCounts)
    }
    setLoading(false)
  }

  async function loadPhotos(albumId: string) {
    setPhotosLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('album_photos')
      .select('id, url, caption, created_at')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
    setPhotos(data ?? [])
    setPhotosLoading(false)
  }

  useEffect(() => { loadAlbums() }, [currentClubId])

  async function createAlbum() {
    if (!newTitle.trim() || !currentClubId) return
    setCreating(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('albums')
      .insert({ club_id: currentClubId, title: newTitle.trim() })
      .select()
      .single()
    if (data) {
      setShowCreate(false)
      setNewTitle('')
      await loadAlbums()
      openAlbum({ ...data, photo_count: 0 })
    }
    setCreating(false)
  }

  function openAlbum(album: Album) {
    setSelectedAlbum(album)
    loadPhotos(album.id)
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedAlbum || !user) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `albums/${selectedAlbum.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('club-media').upload(path, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('club-media').getPublicUrl(path)
      await supabase.from('album_photos').insert({
        album_id: selectedAlbum.id,
        url: urlData.publicUrl,
        uploaded_by: user.id,
      })
      // Update cover if first photo
      if (photos.length === 0) {
        await supabase.from('albums').update({ cover_url: urlData.publicUrl }).eq('id', selectedAlbum.id)
      }
      await loadPhotos(selectedAlbum.id)
      await loadAlbums()
    }
    setUploading(false)
    e.target.value = ''
  }

  // Album list view
  if (!selectedAlbum) {
    return (
      <div className="px-4 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">{ko ? '사진 앨범' : 'Photo Album'}</h1>
          {canManage && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={15} /> {ko ? '앨범 만들기' : 'New Album'}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-600 py-10">{ko ? '로딩 중...' : 'Loading...'}</p>
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <ImageIcon size={40} className="mb-3 opacity-40" />
            <p className="text-sm">{ko ? '앨범이 없습니다' : 'No albums yet'}</p>
            {canManage && (
              <button onClick={() => setShowCreate(true)} className="mt-4 text-green-400 text-sm underline">
                {ko ? '첫 앨범 만들기' : 'Create first album'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {albums.map((album) => (
              <button key={album.id} onClick={() => openAlbum(album)}
                className="glass-card rounded-2xl overflow-hidden text-left">
                <div className="aspect-square bg-gray-800 flex items-center justify-center">
                  {album.cover_url
                    ? <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                    : <ImageIcon size={32} className="text-gray-600" />}
                </div>
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{album.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {album.photo_count}{ko ? '장' : ' photos'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Create album modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowCreate(false)}>
            <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white">{ko ? '새 앨범' : 'New Album'}</h3>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createAlbum()}
                placeholder={ko ? '앨범 이름' : 'Album title'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">
                  {ko ? '취소' : 'Cancel'}
                </button>
                <button onClick={createAlbum} disabled={creating || !newTitle.trim()}
                  className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold disabled:opacity-50">
                  {creating ? (ko ? '만드는 중...' : 'Creating...') : (ko ? '만들기' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Photo grid view (inside album)
  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedAlbum(null)} className="text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-white flex-1 truncate">{selectedAlbum.title}</h1>
        {canManage && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50">
            <Upload size={15} />
            {uploading ? (ko ? '업로드 중...' : 'Uploading...') : (ko ? '사진 추가' : 'Add Photo')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadPhoto} />
      </div>

      {photosLoading ? (
        <p className="text-center text-gray-600 py-10">{ko ? '로딩 중...' : 'Loading...'}</p>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <ImageIcon size={40} className="mb-3 opacity-40" />
          <p className="text-sm">{ko ? '사진이 없습니다' : 'No photos yet'}</p>
          {canManage && (
            <button onClick={() => fileRef.current?.click()}
              className="mt-4 text-green-400 text-sm underline">
              {ko ? '첫 사진 업로드' : 'Upload first photo'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <button key={photo.id} onClick={() => setLightbox(photo.url)}
              className="aspect-square rounded-xl overflow-hidden bg-gray-800">
              <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
