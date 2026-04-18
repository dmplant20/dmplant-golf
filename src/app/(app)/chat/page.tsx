'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Send, MessageCircle } from 'lucide-react'

export default function ChatPage() {
  const { currentClubId, user, lang } = useAuthStore()
  const ko = lang === 'ko'
  const [rooms, setRooms] = useState<any[]>([])
  const [activeRoom, setActiveRoom] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentClubId) return
    const supabase = createClient()
    supabase.from('chat_rooms').select('*').eq('club_id', currentClubId).then(({ data }) => {
      setRooms(data ?? [])
      if (data && data.length > 0) setActiveRoom(data[0])
    })
  }, [currentClubId])

  useEffect(() => {
    if (!activeRoom) return
    const supabase = createClient()

    supabase.from('chat_messages')
      .select('*, users(full_name, full_name_en, avatar_url)')
      .eq('room_id', activeRoom.id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => { setMessages(data ?? []); setTimeout(() => bottomRef.current?.scrollIntoView(), 100) })

    const channel = supabase.channel(`room-${activeRoom.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeRoom.id}` },
        async (payload) => {
          const { data } = await supabase.from('chat_messages')
            .select('*, users(full_name, full_name_en, avatar_url)')
            .eq('id', payload.new.id).single()
          if (data) { setMessages((m) => [...m, data]); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50) }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeRoom])

  async function sendMessage() {
    if (!input.trim() || !activeRoom || !user) return
    const supabase = createClient()
    await supabase.from('chat_messages').insert({ room_id: activeRoom.id, user_id: user.id, content: input.trim() })
    setInput('')
  }

  const roomName = (r: any) => lang === 'ko' ? r.name : (r.name_en || r.name)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Room tabs */}
      {rooms.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scroll-hide flex-shrink-0">
          {rooms.map((r) => (
            <button key={r.id} onClick={() => setActiveRoom(r)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition ${activeRoom?.id === r.id ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {roomName(r)}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id
          const name = lang === 'ko' ? msg.users?.full_name : (msg.users?.full_name_en || msg.users?.full_name)
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center text-sm flex-shrink-0">👤</div>
              )}
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && <span className="text-xs text-gray-500 px-1">{name}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-green-700 text-white rounded-tr-sm' : 'bg-gray-800 text-white rounded-tl-sm'}`}>
                  {msg.content}
                </div>
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

      {/* Input */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-green-900/30 bg-gray-950">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={ko ? '메시지를 입력하세요...' : 'Type a message...'}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500"
        />
        <button onClick={sendMessage} disabled={!input.trim()} className="w-10 h-10 bg-green-700 disabled:opacity-50 rounded-full flex items-center justify-center flex-shrink-0">
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  )
}
