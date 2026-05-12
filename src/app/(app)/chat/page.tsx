'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useChatNotify } from '@/lib/chatNotifications'
import {
  Send, MessageCircle, Plus, X, ArrowLeft, Users, User, Hash, Search, Check,
  Paperclip, Image as ImageIcon, FileText, Loader2,
} from 'lucide-react'

// ── 타입 ────────────────────────────────────────────────────────────────────
interface ChatRoom {
  id: string
  club_id: string
  name: string
  name_en: string | null
  type: 'club_wide' | 'group' | 'tournament_group' | 'dm'
  created_by?: string | null
  last_message_at?: string | null
  last_message_preview?: string | null
  // 클라이언트 계산: DM 일 때 상대방 이름
  display_name?: string
  member_count?: number
}
interface Member {
  user_id: string
  full_name: string
  full_name_en: string | null
  avatar_url: string | null
}
interface ChatMsg {
  id: string
  room_id: string
  user_id: string
  content: string | null
  created_at: string
  attachment_url?: string | null
  attachment_type?: 'image' | 'file' | null
  attachment_name?: string | null
  attachment_size?: number | null
  users?: { full_name: string; full_name_en: string | null; avatar_url: string | null } | null
}

export default function ChatPage() {
  const { currentClubId, user, lang } = useAuthStore()
  const ko = lang === 'ko'

  // ── 상태 ────────────────────────────────────────────────────────────────
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [members, setMembers] = useState<Member[]>([])  // 클럽 멤버 (DM·그룹 멤버 선택용)
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [activeRoomMemberIds, setActiveRoomMemberIds] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(true)

  // 모달
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showDmPicker, setShowDmPicker] = useState(false)
  const [showGroupCreator, setShowGroupCreator] = useState(false)
  // DM·그룹 룸 피커 (전체 대화에서 ☰ 탭 시 노출)
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── 룸 목록 로드 ─────────────────────────────────────────────────────────
  async function loadRooms() {
    if (!currentClubId || !user?.id) return
    setLoadingRooms(true)
    const supabase = createClient()

    // 1) club_wide 룸 (RLS 통과)
    const { data: clubRooms } = await supabase.from('chat_rooms')
      .select('id,club_id,name,name_en,type,created_by,last_message_at,last_message_preview')
      .eq('club_id', currentClubId).eq('type', 'club_wide')

    // 2) 내가 멤버인 dm·group 룸
    const { data: myMemberships } = await supabase.from('chat_room_members')
      .select('room_id, chat_rooms!inner(id,club_id,name,name_en,type,created_by,last_message_at,last_message_preview)')
      .eq('user_id', user.id)
    const dmGroupRooms: ChatRoom[] = (myMemberships ?? [])
      .map((m: any) => Array.isArray(m.chat_rooms) ? m.chat_rooms[0] : m.chat_rooms)
      .filter((r: any) => r && (r.type === 'dm' || r.type === 'group') && r.club_id === currentClubId)

    const allRooms: ChatRoom[] = [...(clubRooms ?? []), ...dmGroupRooms]

    // 3) DM 룸은 상대방 이름으로 표시 라벨 변경
    //    그룹 룸은 멤버 수 표시
    const dmRoomIds  = allRooms.filter(r => r.type === 'dm').map(r => r.id)
    const grpRoomIds = allRooms.filter(r => r.type === 'group').map(r => r.id)
    const memberRoomIds = [...dmRoomIds, ...grpRoomIds]

    const memberMap: Record<string, string[]> = {}
    if (memberRoomIds.length) {
      const { data: rms } = await supabase.from('chat_room_members')
        .select('room_id,user_id').in('room_id', memberRoomIds)
      ;(rms ?? []).forEach((r: any) => {
        if (!memberMap[r.room_id]) memberMap[r.room_id] = []
        memberMap[r.room_id].push(r.user_id)
      })
    }

    // 상대방 이름 조회 (DM)
    const otherUserIds = new Set<string>()
    dmRoomIds.forEach(rid => {
      ;(memberMap[rid] ?? []).forEach(uid => { if (uid !== user.id) otherUserIds.add(uid) })
    })
    let nameMap: Record<string, { full_name: string; full_name_en: string | null }> = {}
    if (otherUserIds.size) {
      const { data: us } = await supabase.from('users')
        .select('id,full_name,full_name_en').in('id', Array.from(otherUserIds))
      ;(us ?? []).forEach((u: any) => {
        nameMap[u.id] = { full_name: u.full_name, full_name_en: u.full_name_en }
      })
    }

    // 라벨링 + 정렬
    const enriched = allRooms.map(r => {
      const memberIds = memberMap[r.id] ?? []
      let display_name: string
      if (r.type === 'dm') {
        const otherId = memberIds.find(id => id !== user.id)
        const u = otherId ? nameMap[otherId] : null
        display_name = u ? (ko ? u.full_name : (u.full_name_en || u.full_name)) : (ko ? '대화' : 'Chat')
      } else if (r.type === 'group') {
        display_name = ko ? r.name : (r.name_en || r.name)
      } else {
        display_name = ko ? '전체 채팅' : 'Club Chat'
      }
      return { ...r, display_name, member_count: memberIds.length }
    })
    enriched.sort((a, b) => {
      // club_wide 우선 → 그 외 last_message_at desc
      if (a.type === 'club_wide' && b.type !== 'club_wide') return -1
      if (b.type === 'club_wide' && a.type !== 'club_wide') return 1
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return tb - ta
    })
    setRooms(enriched)
    setLoadingRooms(false)
  }
  useEffect(() => { loadRooms() }, [currentClubId, user?.id])

  // /chat 진입 시 자동으로 전체 대화방(club_wide) 활성화
  useEffect(() => {
    if (!rooms.length || activeRoom) return
    const club = rooms.find(r => r.type === 'club_wide')
    if (club) setActiveRoom(club)
  }, [rooms, activeRoom])

  // ── 클럽 멤버 로드 (DM/그룹 만들 때 사용) ────────────────────────────────
  useEffect(() => {
    if (!currentClubId || !user?.id) return
    const supabase = createClient()
    supabase.from('club_memberships')
      .select('user_id,users!inner(id,full_name,full_name_en,avatar_url)')
      .eq('club_id', currentClubId).eq('status', 'approved')
      .then(({ data }) => {
        const list: Member[] = (data ?? [])
          .map((r: any) => {
            const u = Array.isArray(r.users) ? r.users[0] : r.users
            return u ? {
              user_id: u.id,
              full_name: u.full_name,
              full_name_en: u.full_name_en ?? null,
              avatar_url: u.avatar_url ?? null,
            } : null
          })
          .filter((m: Member | null): m is Member => m !== null && m.user_id !== user.id)
        setMembers(list)
      })
  }, [currentClubId, user?.id])

  // ── 활성 룸 메시지 + 실시간 ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom) return
    const supabase = createClient()

    // 멤버 id 캐싱 (메시지 발송 시 푸시 대상)
    if (activeRoom.type === 'dm' || activeRoom.type === 'group') {
      supabase.from('chat_room_members').select('user_id').eq('room_id', activeRoom.id)
        .then(({ data }) => setActiveRoomMemberIds((data ?? []).map((r: any) => r.user_id)))
    } else if (activeRoom.type === 'club_wide') {
      supabase.from('club_memberships').select('user_id').eq('club_id', activeRoom.club_id).eq('status', 'approved')
        .then(({ data }) => setActiveRoomMemberIds((data ?? []).map((r: any) => r.user_id)))
    }

    supabase.from('chat_messages')
      .select('id,room_id,user_id,content,created_at,users(full_name,full_name_en,avatar_url)')
      .eq('room_id', activeRoom.id).order('created_at', { ascending: true }).limit(200)
      .then(({ data }) => {
        setMessages((data ?? []) as any)
        setTimeout(() => bottomRef.current?.scrollIntoView(), 80)
      })

    // last_read_at 갱신 — DM·group·club_wide 모두 (전역 unread 카운터 정확도 위해)
    supabase.from('chat_room_members').update({ last_read_at: new Date().toISOString() })
      .eq('room_id', activeRoom.id).eq('user_id', user!.id).then(() => {
        // 현재 활성 방 표시 — 전역 알림 핸들러가 이 방에선 소리·카운트 안 올림
        useChatNotify.getState().setActiveRoom(activeRoom.id)
        // 전역 unread 재계산
        recomputeGlobalUnread(supabase, user!.id)
      })

    const channel = supabase.channel(`room-${activeRoom.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` },
        async (payload) => {
          const { data } = await supabase.from('chat_messages')
            .select('id,room_id,user_id,content,created_at,users(full_name,full_name_en,avatar_url)')
            .eq('id', payload.new.id).single()
          if (data) {
            setMessages(m => [...m, data as any])
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        }
      ).subscribe()

    return () => {
      supabase.removeChannel(channel)
      // 방에서 나갈 때 activeRoomId 해제 → 다시 전역 알림 활성
      useChatNotify.getState().setActiveRoom(null)
    }
  }, [activeRoom?.id])

  // 전역 unread 재계산 헬퍼
  async function recomputeGlobalUnread(supabase: any, userId: string) {
    const { data: rooms } = await supabase
      .from('chat_room_members').select('room_id, last_read_at').eq('user_id', userId)
    if (!rooms) return
    let total = 0
    for (const r of rooms) {
      const since = r.last_read_at ?? new Date(0).toISOString()
      const { count } = await supabase.from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', r.room_id).gt('created_at', since).neq('user_id', userId)
      total += count ?? 0
    }
    useChatNotify.getState().setUnread(total)
  }

  // ── 메시지 전송 (텍스트만, 또는 첨부와 함께) + 푸시 ────────────────────
  async function sendMessageInternal(opts: {
    text?: string
    attachment?: { url: string; type: 'image' | 'file'; name: string; size: number }
  }) {
    if (!activeRoom || !user) return
    const text = opts.text?.trim() ?? null
    const att = opts.attachment ?? null
    if (!text && !att) return  // 둘 다 비면 전송 안 함
    const supabase = createClient()
    const { error } = await supabase.from('chat_messages').insert({
      room_id: activeRoom.id,
      user_id: user.id,
      content: text,
      attachment_url:  att?.url  ?? null,
      attachment_type: att?.type ?? null,
      attachment_name: att?.name ?? null,
      attachment_size: att?.size ?? null,
    })
    if (error) {
      console.error('[chat send]', error)
      return false
    }

    // 채팅 푸시 알림 비활성화 — 공지사항만 푸시, 채팅은 앱 내 배지 + 소리로 처리
    // (수신측은 supabase realtime 으로 메시지를 받아 즉시 카운트·소리 갱신)
    return true
  }

  async function sendMessage() {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    const ok = await sendMessageInternal({ text })
    if (ok === false) setInput(text)
  }

  // ── 사진/파일 업로드 → 메시지로 전송 ─────────────────────────────────────
  async function handleFileUpload(file: File, kind: 'image' | 'file') {
    if (!activeRoom || !user) return
    if (file.size > 20 * 1024 * 1024) {
      setUploadError(ko ? '20MB 이하만 업로드 가능합니다' : 'Max 20MB')
      return
    }
    setUploading(true); setUploadError(null)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop() ?? 'bin'
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
      const path = `${activeRoom.id}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(upErr.message)

      // 비공개 버킷 → signed URL (1년)
      const { data: signed } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      if (!signed?.signedUrl) throw new Error('signed url failed')

      await sendMessageInternal({
        attachment: {
          url:  signed.signedUrl,
          type: kind,
          name: file.name,
          size: file.size,
        },
      })
    } catch (e: any) {
      console.error('[chat upload]', e)
      setUploadError(e?.message ?? '업로드 실패')
    } finally {
      setUploading(false)
      if (fileInputRef.current)  fileInputRef.current.value  = ''
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  // ── DM 시작 ──────────────────────────────────────────────────────────────
  async function startDm(targetUserId: string) {
    if (!currentClubId) return
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, club_id: currentClubId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'DM 생성 실패')
      setShowDmPicker(false)
      await loadRooms()
      const next = rooms.find(r => r.id === data.room_id) ?? null
      if (!next) {
        // 새로 만든 룸이 rooms 에 아직 반영 안됐으면 다시 로드 후 활성화
        await new Promise(r => setTimeout(r, 200))
        await loadRooms()
      }
      // 활성화는 effect 가 rooms 갱신 후 잡지 못하므로 직접 추정
      setActiveRoom({ id: data.room_id, club_id: currentClubId, name: '', name_en: '', type: 'dm', display_name: '...' } as ChatRoom)
    } catch (e: any) {
      setCreateError(e?.message ?? '오류')
    } finally {
      setCreating(false)
    }
  }

  // ── 그룹 생성 ────────────────────────────────────────────────────────────
  async function createGroup() {
    if (!groupName.trim() || groupSelectedIds.length < 1 || !currentClubId) return
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/chat/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          club_id: currentClubId,
          member_ids: groupSelectedIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '그룹 생성 실패')
      setShowGroupCreator(false)
      setGroupName(''); setGroupSelectedIds([])
      await loadRooms()
      setActiveRoom({ id: data.room_id, club_id: currentClubId, name: groupName.trim(), name_en: groupName.trim(), type: 'group', display_name: groupName.trim() } as ChatRoom)
    } catch (e: any) {
      setCreateError(e?.message ?? '오류')
    } finally {
      setCreating(false)
    }
  }

  // ── URL ?room=<id> 자동 진입 (푸시 알림 클릭 시) ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !rooms.length) return
    const params = new URLSearchParams(window.location.search)
    const roomId = params.get('room')
    if (roomId) {
      const target = rooms.find(r => r.id === roomId)
      if (target) {
        setActiveRoom(target)
        const url = new URL(window.location.href)
        url.searchParams.delete('room')
        window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      }
    }
  }, [rooms])

  // ── 멤버 검색 필터 ───────────────────────────────────────────────────────
  const filteredMembers = members.filter(m => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return m.full_name.toLowerCase().includes(q) || (m.full_name_en?.toLowerCase().includes(q) ?? false)
  })

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // DM·그룹 룸만 필터 (전체 대화방은 자동 활성화되므로 리스트에서 제외)
  const dmGroupRooms = rooms.filter(r => r.type === 'dm' || r.type === 'group')

  // ── 공통 모달들 — chat·list 양쪽에서 노출 가능 ─────────────────────────
  const modals = (
    <>
      {/* 내 대화방 (DM·그룹) 피커 — 전체 대화 헤더 ☰ 버튼에서 호출 */}
      {showRoomPicker && (
        <div onClick={() => setShowRoomPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.7)' }}>
          <div onClick={e => e.stopPropagation()}
            className="absolute bottom-20 left-4 right-4 rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <p className="text-sm font-bold text-white">{ko ? '내 대화방' : 'My rooms'}</p>
              <button onClick={() => setShowRoomPicker(false)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <X size={14} className="text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {dmGroupRooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm flex flex-col items-center gap-2">
                  <MessageCircle size={28} className="opacity-30" />
                  <p className="text-xs">{ko ? 'DM·그룹 채팅이 없습니다' : 'No DM/group chats'}</p>
                </div>
              ) : dmGroupRooms.map(r => {
                const icon = r.type === 'dm' ? '💬' : '👥'
                const sub = r.last_message_preview ?? (r.type === 'group' ? `${r.member_count ?? '?'}${ko ? '명' : ' members'}` : '')
                const time = r.last_message_at ? new Date(r.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                return (
                  <button key={r.id} onClick={() => { setActiveRoom(r); setShowRoomPicker(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900/50 hover:bg-gray-800 transition active:scale-[0.98] text-left">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: r.type === 'dm' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)' }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{r.display_name}</p>
                      {sub && <p className="text-xs text-gray-500 truncate mt-0.5">{sub}</p>}
                    </div>
                    {time && <span className="text-[10px] text-gray-600 flex-shrink-0">{time}</span>}
                  </button>
                )
              })}
            </div>
            <button onClick={() => { setShowRoomPicker(false); setShowCreateMenu(true) }}
              className="flex-shrink-0 flex items-center justify-center gap-2 py-3 border-t border-gray-800 hover:bg-white/5 transition">
              <Plus size={14} className="text-green-400" />
              <span className="text-sm font-medium text-green-400">{ko ? '새 대화 시작' : 'Start new chat'}</span>
            </button>
          </div>
        </div>
      )}

      {/* + 메뉴 (DM·그룹 만들기 선택) */}
      {showCreateMenu && (
        <div onClick={() => setShowCreateMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)' }}>
          <div onClick={e => e.stopPropagation()}
            className="absolute bottom-20 left-4 right-4 rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
            <button onClick={() => { setShowCreateMenu(false); setShowDmPicker(true) }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition border-b border-gray-800">
              <User size={18} className="text-blue-400" />
              <span className="text-sm font-medium text-white">{ko ? '1:1 대화 시작' : 'Start 1:1 chat'}</span>
            </button>
            <button onClick={() => { setShowCreateMenu(false); setShowGroupCreator(true) }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition">
              <Users size={18} className="text-violet-400" />
              <span className="text-sm font-medium text-white">{ko ? '그룹 채팅 만들기' : 'Create group chat'}</span>
            </button>
          </div>
        </div>
      )}

      {/* DM 멤버 선택 모달 */}
      {showDmPicker && (
        <div onClick={() => setShowDmPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0a140a', display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()} className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <p className="text-sm font-bold text-white">{ko ? '대화할 회원 선택' : 'Pick a member'}</p>
              <button onClick={() => setShowDmPicker(false)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <X size={16} className="text-white" />
              </button>
            </div>
            <div className="px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-gray-700">
                <Search size={14} className="text-gray-500" />
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                  placeholder={ko ? '이름 검색...' : 'Search name...'}
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {filteredMembers.length === 0 && (
                <p className="text-center text-xs text-gray-500 py-8">{ko ? '회원이 없습니다' : 'No members'}</p>
              )}
              {filteredMembers.map(m => (
                <button key={m.user_id} onClick={() => startDm(m.user_id)} disabled={creating}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900/50 hover:bg-gray-800 transition disabled:opacity-50 active:scale-[0.98]">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: 'rgba(96,165,250,0.15)' }}>
                    👤
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{ko ? m.full_name : (m.full_name_en ?? m.full_name)}</p>
                  </div>
                </button>
              ))}
              {createError && <p className="text-xs text-red-400 text-center pt-2">{createError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 그룹 생성 모달 */}
      {showGroupCreator && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0a140a', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <p className="text-sm font-bold text-white">{ko ? '그룹 채팅 만들기' : 'New group chat'}</p>
            <button onClick={() => { setShowGroupCreator(false); setGroupName(''); setGroupSelectedIds([]); setCreateError(null) }}
              className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <X size={16} className="text-white" />
            </button>
          </div>
          <div className="px-4 py-3 flex-shrink-0 space-y-3">
            <div>
              <label className="text-xs font-semibold mb-1.5 block text-gray-400">
                <Hash size={11} className="inline mr-1" />{ko ? '그룹 이름' : 'Group name'}
              </label>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={60}
                placeholder={ko ? '예: 주말 라운딩 친구들' : 'e.g. Weekend buddies'}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500" />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-gray-700">
              <Search size={14} className="text-gray-500" />
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                placeholder={ko ? '이름 검색...' : 'Search name...'}
                className="flex-1 bg-transparent text-sm text-white focus:outline-none" />
            </div>
            <p className="text-xs text-gray-500">
              {ko ? `선택된 회원: ${groupSelectedIds.length}명` : `Selected: ${groupSelectedIds.length}`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-1.5">
            {filteredMembers.map(m => {
              const selected = groupSelectedIds.includes(m.user_id)
              return (
                <button key={m.user_id} onClick={() => setGroupSelectedIds(s => selected ? s.filter(id => id !== m.user_id) : [...s, m.user_id])}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition active:scale-[0.98]"
                  style={{ background: selected ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: selected ? 'rgba(34,197,94,0.40)' : 'rgba(255,255,255,0.05)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: 'rgba(167,139,250,0.15)' }}>
                    👤
                  </div>
                  <span className="flex-1 text-left text-sm font-semibold text-white truncate">{ko ? m.full_name : (m.full_name_en ?? m.full_name)}</span>
                  {selected && <Check size={16} className="text-green-400" />}
                </button>
              )
            })}
            {createError && <p className="text-xs text-red-400 text-center pt-2">{createError}</p>}
          </div>
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800 flex gap-2">
            <button onClick={() => { setShowGroupCreator(false); setGroupName(''); setGroupSelectedIds([]) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-gray-300 active:scale-[0.97]">
              {ko ? '취소' : 'Cancel'}
            </button>
            <button onClick={createGroup} disabled={creating || !groupName.trim() || groupSelectedIds.length < 1}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
              {creating ? (ko ? '만드는 중...' : 'Creating...') : (ko ? '만들기' : 'Create')}
            </button>
          </div>
        </div>
      )}
    </>
  )

  // 활성 룸이 있으면 채팅 뷰
  if (activeRoom) {
    const isClubWide = activeRoom.type === 'club_wide'
    const dmGroupCount = dmGroupRooms.length
    return (<>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* 헤더 — club_wide: ☰ 피커 + ➕ / DM·group: ← 백 + ➕ */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-green-900/30 flex-shrink-0">
          {isClubWide ? (
            <button onClick={() => setShowRoomPicker(true)} className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 relative"
              style={{ background: 'rgba(255,255,255,0.04)' }} title={ko ? '내 대화방' : 'My rooms'}>
              <MessageCircle size={16} className="text-white" />
              {dmGroupCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: '#16a34a', color: '#fff' }}>{dmGroupCount}</span>
              )}
            </button>
          ) : (
            <button onClick={() => {
              const club = rooms.find(r => r.type === 'club_wide')
              if (club) setActiveRoom(club); else setActiveRoom(null)
            }} className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <ArrowLeft size={16} className="text-white" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {activeRoom.type === 'dm' ? '💬 ' : activeRoom.type === 'group' ? '👥 ' : '🏌️ '}
              {activeRoom.display_name ?? (ko ? activeRoom.name : (activeRoom.name_en ?? activeRoom.name))}
            </p>
            {activeRoom.type === 'group' && activeRoom.member_count != null && (
              <p className="text-[11px] text-gray-500">{activeRoom.member_count}{ko ? '명' : ' members'}</p>
            )}
          </div>
          {/* + 새 대화 (DM·그룹 만들기) — 항상 사용 가능 */}
          <button onClick={() => setShowCreateMenu(true)} className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }} title={ko ? '새 대화' : 'New chat'}>
            <Plus size={16} className="text-white" />
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg) => {
            const isMe = msg.user_id === user?.id
            const name = ko ? msg.users?.full_name : (msg.users?.full_name_en || msg.users?.full_name)
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (
                  <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center text-sm flex-shrink-0">👤</div>
                )}
                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-xs text-gray-500 px-1">{name}</span>}
                  {/* 이미지 첨부 — 인라인 표시 */}
                  {msg.attachment_type === 'image' && msg.attachment_url && (
                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                      className="block rounded-2xl overflow-hidden border border-white/10 active:scale-[0.98] transition"
                      style={{ maxWidth: 240 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.attachment_url} alt={msg.attachment_name ?? 'image'}
                        loading="lazy" className="block w-full h-auto" style={{ maxHeight: 320, objectFit: 'cover' }} />
                    </a>
                  )}
                  {/* 파일 첨부 — 다운로드 카드 */}
                  {msg.attachment_type === 'file' && msg.attachment_url && (
                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" download={msg.attachment_name ?? undefined}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition active:scale-[0.98] ${isMe ? 'bg-green-700/40 border-green-700/60' : 'bg-gray-800 border-gray-700'}`}
                      style={{ maxWidth: 260 }}>
                      <FileText size={18} className="flex-shrink-0 text-blue-300" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{msg.attachment_name}</p>
                        {msg.attachment_size != null && (
                          <p className="text-[10px] text-gray-400">{(msg.attachment_size / 1024).toFixed(0)} KB</p>
                        )}
                      </div>
                    </a>
                  )}
                  {/* 텍스트 본문 (있을 때만) */}
                  {msg.content && (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm break-words ${isMe ? 'bg-green-700 text-white rounded-tr-sm' : 'bg-gray-800 text-white rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  )}
                  <span className="text-[10px] text-gray-600 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
              <MessageCircle size={40} />
              <p className="text-sm">{ko ? '첫 메시지를 보내보세요!' : 'Send the first message!'}</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 */}
        <div className="flex-shrink-0 border-t border-green-900/30 bg-gray-950">
          {uploadError && (
            <p className="text-xs text-red-400 px-4 pt-2">{uploadError}</p>
          )}
          <div className="flex items-center gap-2 px-4 py-3">
            {/* 숨겨진 file inputs */}
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'image') }} />
            <input ref={fileInputRef} type="file" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'file') }} />
            {/* 사진 버튼 */}
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}
              title={ko ? '사진' : 'Photo'}>
              {uploading ? <Loader2 size={16} className="text-blue-300 animate-spin" /> : <ImageIcon size={16} className="text-blue-300" />}
            </button>
            {/* 파일 버튼 */}
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}
              title={ko ? '파일' : 'File'}>
              <Paperclip size={16} className="text-violet-300" />
            </button>
            <input
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={ko ? '메시지를 입력하세요...' : 'Type a message...'}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500"
            />
            <button onClick={sendMessage} disabled={!input.trim() || uploading} className="w-10 h-10 bg-green-700 disabled:opacity-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>
      {modals}
    </>)
  }

  // 룸 리스트 뷰 — 전체 대화방이 없을 때만 보임 (fallback)
  // 정상 케이스에서는 위의 auto-select effect 가 club_wide 룸을 활성화
  return (<>
    <div className="px-4 pt-4 pb-6 space-y-3">
      {/* 헤더 + 새 대화 버튼 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">{ko ? '채팅' : 'Chat'}</h1>
        <button onClick={() => setShowCreateMenu(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition active:scale-95"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
          <Plus size={18} className="text-white" />
        </button>
      </div>

      {loadingRooms ? (
        <div className="text-center py-12 text-gray-500 text-sm">{ko ? '불러오는 중...' : 'Loading...'}</div>
      ) : dmGroupRooms.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm flex flex-col items-center gap-2">
          <MessageCircle size={36} className="opacity-30" />
          <p>{ko ? '대화방이 없습니다' : 'No chats yet'}</p>
          <p className="text-xs">{ko ? '＋ 버튼으로 시작하세요' : 'Tap + to start'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dmGroupRooms.map(r => {
            const icon = r.type === 'dm' ? '💬' : '👥'
            const subtitle = r.last_message_preview ?? (
              r.type === 'group' ? `${r.member_count ?? '?'}${ko ? '명' : ' members'}` : ''
            )
            const time = r.last_message_at ? new Date(r.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
            return (
              <button key={r.id} onClick={() => setActiveRoom(r)}
                className="w-full glass-card rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition active:scale-[0.98] hover:bg-white/[0.03]">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: r.type === 'dm' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)' }}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{r.display_name}</p>
                  {subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>}
                </div>
                {time && <span className="text-[10px] text-gray-600 flex-shrink-0">{time}</span>}
              </button>
            )
          })}
        </div>
      )}

    </div>
    {modals}
  </>)
}
