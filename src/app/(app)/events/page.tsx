'use client'
// 경조사 전용 페이지 — 월별 접기/펼치기 + 유형 필터 + 한눈에 보기
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Calendar, Phone, MapPin, ChevronDown, ChevronUp, ArrowRight, Edit2,
} from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'
import { isSuperAdmin } from '@/lib/superAdmin'

interface LifeEvent {
  id: string
  type: 'wedding' | 'condolence' | 'birth' | 'birthday' | 'promotion' | 'other'
  title: string
  title_en?: string
  description?: string
  event_date: string
  person_name?: string
  location_name?: string
  contact?: string
  raw_text?: string
  created_at?: string
}

type FilterKey = 'all' | LifeEvent['type']

const EVENT_TYPES: { key: LifeEvent['type']; ko: string; en: string; emoji: string; color: string; bg: string }[] = [
  { key: 'wedding',    ko: '결혼', en: 'Wedding',    emoji: '🎊', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  { key: 'condolence', ko: '부고', en: 'Condolence', emoji: '🕊️', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  { key: 'birth',      ko: '출산', en: 'Birth',      emoji: '👶', color: '#f9a8d4', bg: 'rgba(249,168,212,0.15)' },
  { key: 'birthday',   ko: '생일', en: 'Birthday',   emoji: '🎂', color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
  { key: 'promotion',  ko: '승진', en: 'Promotion',  emoji: '🏆', color: '#fcd34d', bg: 'rgba(252,211,77,0.15)' },
  { key: 'other',      ko: '기타', en: 'Other',      emoji: '✨', color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)' },
]
const typeOf = (k?: string) => EVENT_TYPES.find(t => t.key === k) ?? EVENT_TYPES[5]

export default function EventsPage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const isAdmin = isSuperAdmin(user)
  const canEdit = OFFICER_ROLES.includes(myRole) || isAdmin

  const [events, setEvents] = useState<LifeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  // 월별 펼치기 상태 — 키: 'YYYY-MM'
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [expandedRaw, setExpandedRaw] = useState<string | null>(null)

  useEffect(() => {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    supabase.from('events')
      .select('id,type,title,title_en,description,event_date,person_name,location_name,contact,raw_text,created_at')
      .eq('club_id', currentClubId)
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        setEvents((data ?? []) as LifeEvent[])
        setLoading(false)
      })
  }, [currentClubId])

  // 통계
  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let thisMonthCount = 0
    let upcomingCount = 0
    const byType: Record<string, number> = {}
    events.forEach(e => {
      const ym = (e.event_date ?? '').slice(0, 7)
      if (ym === thisMonth) thisMonthCount++
      if (new Date(e.event_date) >= now) upcomingCount++
      byType[e.type] = (byType[e.type] ?? 0) + 1
    })
    return { total: events.length, thisMonth: thisMonthCount, upcoming: upcomingCount, byType }
  }, [events])

  // 필터링
  const filtered = useMemo(
    () => filter === 'all' ? events : events.filter(e => e.type === filter),
    [events, filter]
  )

  // 월별 그룹화
  const byMonth = useMemo(() => {
    const m: Record<string, LifeEvent[]> = {}
    filtered.forEach(e => {
      const ym = (e.event_date ?? '').slice(0, 7) || 'unknown'
      ;(m[ym] = m[ym] || []).push(e)
    })
    return m
  }, [filtered])

  const sortedMonths = useMemo(() => Object.keys(byMonth).sort().reverse(), [byMonth])

  function fmtDate(d?: string) {
    if (!d) return ''
    const x = new Date(d)
    return `${x.getMonth() + 1}월 ${x.getDate()}일 (${'일월화수목금토'[x.getDay()]})`
  }
  function fmtMonthLabel(ym: string) {
    if (ym === 'unknown') return ko ? '날짜 미정' : 'Undated'
    const [y, m] = ym.split('-')
    return ko ? `${y}년 ${parseInt(m, 10)}월` : `${y}.${m}`
  }
  function daysUntil(d?: string) {
    if (!d) return null
    const now = new Date(); now.setHours(0,0,0,0)
    const target = new Date(d); target.setHours(0,0,0,0)
    return Math.round((target.getTime() - now.getTime()) / 86400_000)
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">🎊 {ko ? '경조사' : 'Life Events'}</h1>
          <p className="text-[11px] mt-0.5" style={{ color: '#5a7a5a' }}>
            {ko ? '결혼·부고·생일 등 회원 가족의 행사 모음' : 'Weddings, condolences, birthdays'}
          </p>
        </div>
        {canEdit && (
          <Link href="/announcement?tab=event"
            className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-xl active:scale-95"
            style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}>
            <ArrowRight size={14} />
            {ko ? '등록·편집' : 'Add / Edit'}
          </Link>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: ko ? '이번 달' : 'This month', value: stats.thisMonth, color: '#fbbf24' },
          { label: ko ? '다가오는' : 'Upcoming',  value: stats.upcoming,  color: '#86efac' },
          { label: ko ? '전체'    : 'Total',      value: stats.total,     color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card rounded-xl px-3 py-2.5">
            <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 유형 필터 pills */}
      <div className="flex gap-1.5 overflow-x-auto scroll-hide pb-1 -mx-1 px-1">
        <button onClick={() => setFilter('all')}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
          style={filter === 'all'
            ? { background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff' }
            : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
          {ko ? '전체' : 'All'} <span className="text-[10px] opacity-70">{stats.total}</span>
        </button>
        {EVENT_TYPES.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition"
            style={filter === t.key
              ? { background: t.bg, color: t.color, border: `1px solid ${t.color}80` }
              : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span>{t.emoji}</span>
            {ko ? t.ko : t.en}
            <span className="text-[10px] opacity-70">{stats.byType[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* 월별 리스트 */}
      {loading ? (
        <p className="text-center text-gray-500 text-sm py-12">{ko ? '불러오는 중...' : 'Loading...'}</p>
      ) : sortedMonths.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-3xl mb-2 opacity-40">🎊</p>
          <p className="text-sm text-gray-500">{ko ? '등록된 경조사가 없습니다' : 'No events yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedMonths.map((ym, idx) => {
            const items = byMonth[ym]
            const isOpen = expandedMonth === ym || (expandedMonth === null && idx === 0)
            return (
              <div key={ym} className="glass-card rounded-xl overflow-hidden">
                <button onClick={() => setExpandedMonth(isOpen ? '' : ym)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left transition"
                  style={{ background: isOpen ? 'rgba(167,139,250,0.06)' : 'transparent' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{fmtMonthLabel(ym)}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {items.length}{ko ? '건' : ' events'}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(167,139,250,0.1)' }}>
                    {items.map(ev => {
                      const t = typeOf(ev.type)
                      const isRawOpen = expandedRaw === ev.id
                      const dUntil = daysUntil(ev.event_date)
                      return (
                        <div key={ev.id} className="rounded-xl overflow-hidden mt-2"
                          style={{
                            background: `linear-gradient(160deg, ${t.bg} 0%, rgba(6,13,6,0.95) 60%)`,
                            border: `1px solid ${t.color}40`,
                          }}>
                          <div className="px-3 py-3">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl flex-shrink-0">{t.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{ background: t.bg, color: t.color, border: `1px solid ${t.color}80` }}>
                                    {ko ? t.ko : t.en}
                                  </span>
                                  {dUntil != null && dUntil >= 0 && dUntil <= 14 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                      style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' }}>
                                      D-{dUntil}
                                    </span>
                                  )}
                                </div>
                                {ev.person_name && (
                                  <p className="text-white font-bold text-base mt-1 leading-tight">{ev.person_name}</p>
                                )}
                                <p className={`${ev.person_name ? 'text-xs mt-0.5 text-gray-400' : 'text-sm font-semibold text-white mt-1'}`}>
                                  {ko ? ev.title : (ev.title_en || ev.title)}
                                </p>
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#d0e0d0' }}>
                                    <Calendar size={11} style={{ color: t.color }} />
                                    {fmtDate(ev.event_date)}
                                  </div>
                                  {ev.location_name && (
                                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#c0d0c0' }}>
                                      <MapPin size={11} style={{ color: t.color }} />
                                      {ev.location_name}
                                    </div>
                                  )}
                                  {ev.contact && (
                                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#c0d0c0' }}>
                                      <Phone size={11} style={{ color: t.color }} />
                                      {ev.contact}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {(ev.raw_text || ev.description) && (
                            <div style={{ borderTop: `1px solid ${t.color}30` }}>
                              <button onClick={() => setExpandedRaw(isRawOpen ? null : ev.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-[11px] transition"
                                style={{ background: 'rgba(0,0,0,0.25)', color: t.color }}>
                                <span>{ko ? '원문 전체보기' : 'View full message'}</span>
                                {isRawOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                              {isRawOpen && (
                                <div className="px-3 py-3 text-[11px] whitespace-pre-wrap"
                                  style={{ background: 'rgba(0,0,0,0.35)', color: '#b8ccb8' }}>
                                  {ev.raw_text || ev.description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canEdit && (
        <Link href="/announcement?tab=event"
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px dashed rgba(167,139,250,0.5)' }}>
          <Edit2 size={14} />
          {ko ? '경조사 등록·편집은 공지사항 페이지에서' : 'Add/edit via Announcements'}
        </Link>
      )}
    </div>
  )
}
