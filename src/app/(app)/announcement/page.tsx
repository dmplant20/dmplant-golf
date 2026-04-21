'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Bell, Plus, Calendar, Heart, Users, X } from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'

const EVENT_ICONS: Record<string, any> = { meeting: Users, celebration: Heart, condolence: Bell, other: Calendar }
const EVENT_COLORS: Record<string, string> = { meeting: 'text-blue-400', celebration: 'text-yellow-400', condolence: 'text-gray-400', other: 'text-purple-400' }

export default function AnnouncementPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = OFFICER_ROLES.includes(myRole)

  const [tab, setTab] = useState<'notice' | 'event'>('notice')
  const [notices, setNotices] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', titleEn: '', content: '', contentEn: '', type: 'meeting', date: '' })

  async function load() {
    if (!currentClubId) return
    const supabase = createClient()
    const [{ data: n }, { data: e }] = await Promise.all([
      supabase.from('announcements').select('*, users(full_name, full_name_en)').eq('club_id', currentClubId).order('created_at', { ascending: false }),
      supabase.from('events').select('*').eq('club_id', currentClubId).order('event_date', { ascending: true }),
    ])
    setNotices(n ?? [])
    setEvents(e ?? [])
  }

  useEffect(() => { load() }, [currentClubId])

  async function addNotice() {
    if (!form.title) return
    const supabase = createClient()
    await supabase.from('announcements').insert({
      club_id: currentClubId, title: form.title, title_en: form.titleEn,
      content: form.content, content_en: form.contentEn, author_id: user!.id,
    })
    setShowAdd(false)
    setForm({ title: '', titleEn: '', content: '', contentEn: '', type: 'meeting', date: '' })
    load()
  }

  async function addEvent() {
    if (!form.title || !form.date) return
    const supabase = createClient()
    await supabase.from('events').insert({
      club_id: currentClubId, type: form.type, title: form.title,
      title_en: form.titleEn, description: form.content, event_date: form.date, created_by: user!.id,
    })
    setShowAdd(false)
    setForm({ title: '', titleEn: '', content: '', contentEn: '', type: 'meeting', date: '' })
    load()
  }

  const eventTypeLabel = (t: string) => {
    const m: Record<string, [string, string]> = { meeting: ['회의', 'Meeting'], celebration: ['경사', 'Celebration'], condolence: ['조사', 'Condolence'], other: ['기타', 'Other'] }
    return ko ? m[t]?.[0] : m[t]?.[1]
  }

  return (
    <div className="px-4 py-5">
      <div className="flex gap-2 mb-5">
        {(['notice', 'event'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400'}`}>
            {t === 'notice' ? (ko ? '공지사항' : 'Announcements') : (ko ? '경조사/회의' : 'Events')}
          </button>
        ))}
      </div>

      {canManage && (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 bg-green-700/20 border border-green-800 text-green-400 py-2.5 rounded-xl text-sm mb-4 hover:bg-green-700/30 transition">
          <Plus size={16} /> {tab === 'notice' ? (ko ? '공지 작성' : 'New Notice') : (ko ? '일정 등록' : 'Add Event')}
        </button>
      )}

      {tab === 'notice' ? (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="glass-card rounded-xl p-4">
              <div className="flex items-start gap-2">
                <Bell size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{lang === 'ko' ? n.title : (n.title_en || n.title)}</p>
                  {n.content && <p className="text-gray-400 text-xs mt-1 line-clamp-2">{lang === 'ko' ? n.content : (n.content_en || n.content)}</p>}
                  <p className="text-gray-600 text-xs mt-2">{lang === 'ko' ? n.users?.full_name : (n.users?.full_name_en || n.users?.full_name)} · {new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
          {notices.length === 0 && <p className="text-center text-gray-600 py-8">{ko ? '공지사항이 없습니다' : 'No announcements'}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const Icon = EVENT_ICONS[e.type] ?? Calendar
            return (
              <div key={e.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <Icon size={20} className={`${EVENT_COLORS[e.type]} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{lang === 'ko' ? e.title : (e.title_en || e.title)}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-green-400">{eventTypeLabel(e.type)}</span>
                    <span className="text-xs text-gray-500">{new Date(e.event_date).toLocaleDateString()}</span>
                  </div>
                  {e.description && <p className="text-gray-400 text-xs mt-1">{e.description}</p>}
                </div>
              </div>
            )
          })}
          {events.length === 0 && <p className="text-center text-gray-600 py-8">{ko ? '등록된 일정이 없습니다' : 'No events'}</p>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{tab === 'notice' ? (ko ? '공지 작성' : 'New Notice') : (ko ? '일정 등록' : 'Add Event')}</h3>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            {tab === 'event' && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">{ko ? '유형' : 'Type'}</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                  {['meeting', 'celebration', 'condolence', 'other'].map((t) => <option key={t} value={t}>{eventTypeLabel(t)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '제목 (한글)' : 'Title (Korean)'}</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '제목 (영문)' : 'Title (English)'}</label>
              <input value={form.titleEn} onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>
            {tab === 'event' && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">{ko ? '날짜' : 'Date'}</label>
                <input type="datetime-local" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '내용' : 'Content'}</label>
              <textarea rows={3} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={tab === 'notice' ? addNotice : addEvent} className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">{ko ? '등록' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
