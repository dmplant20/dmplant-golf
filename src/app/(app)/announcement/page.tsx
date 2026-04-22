'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Bell, Plus, X, ChevronDown, ChevronUp,
  MapPin, Phone, FileText, Lock, Trash2, Calendar,
} from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'

// ── 경조사 유형 ──────────────────────────────────────────────────
const EVENT_TYPES = [
  {
    value: 'wedding',
    emoji: '💍',
    ko: '결혼',
    en: 'Wedding',
    theme: { bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.28)', badge: 'rgba(244,114,182,0.15)', text: '#f472b6', glow: 'rgba(244,114,182,0.08)' },
  },
  {
    value: 'condolence',
    emoji: '🕊️',
    ko: '부고',
    en: 'Condolence',
    theme: { bg: 'rgba(71,85,105,0.18)', border: 'rgba(100,116,139,0.3)', badge: 'rgba(100,116,139,0.2)', text: '#94a3b8', glow: 'rgba(100,116,139,0.06)' },
  },
  {
    value: 'birth',
    emoji: '👶',
    ko: '출산',
    en: 'Birth',
    theme: { bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.25)', badge: 'rgba(56,189,248,0.14)', text: '#38bdf8', glow: 'rgba(56,189,248,0.06)' },
  },
  {
    value: 'birthday',
    emoji: '🎂',
    ko: '환갑·칠순',
    en: 'Birthday',
    theme: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', badge: 'rgba(251,191,36,0.14)', text: '#fbbf24', glow: 'rgba(251,191,36,0.06)' },
  },
  {
    value: 'promotion',
    emoji: '🏆',
    ko: '승진·취임',
    en: 'Promotion',
    theme: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', badge: 'rgba(167,139,250,0.14)', text: '#a78bfa', glow: 'rgba(167,139,250,0.06)' },
  },
  {
    value: 'other',
    emoji: '✨',
    ko: '기타',
    en: 'Other',
    theme: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', badge: 'rgba(34,197,94,0.12)', text: '#22c55e', glow: 'rgba(34,197,94,0.04)' },
  },
]
const getET = (v: string) => EVENT_TYPES.find(t => t.value === v) ?? EVENT_TYPES[5]

// ── 공지사항 placeholder 텍스트 ──────────────────────────────────
const NOTICE_PLACEHOLDER_KO = `결혼식 안내말씀

저희 두 사람이 결혼합니다.
항상 저희를 아껴주신 분들을 모시고...`

const NOTICE_PLACEHOLDER_EN = `Enter the announcement content here...`

// ── 경조사 raw_text placeholder ──────────────────────────────────
const rawPlaceholder = (type: string, ko: boolean) => {
  if (type === 'wedding') return ko
    ? `카카오톡 청첩장을 여기에 붙여넣으세요.\n\n────────────────\n결혼합니다\n\n신랑 홍 길 동\n신부 김 영 희\n\n2025년 3월 15일 토요일 오전 11시\nOO 웨딩홀 2층 다이아몬드홀\n서울시 강남구 OO로 123\n\n문의 : 010-1234-5678\n────────────────`
    : `Paste the wedding invitation text (from KakaoTalk etc.) here...`
  if (type === 'condolence') return ko
    ? `부고장을 여기에 붙여넣으세요.\n\n────────────────\n부  고\n\n홍길동 선생님께서 별세하셨기에\n삼가 알려드립니다.\n\n빈  소 : OO병원 장례식장 1호실\n발  인 : 2025년 3월 15일 오전 9시\n장  지 : OO공원묘지\n\n유족 : 장남 홍길순  010-0000-0000\n────────────────`
    : `Paste the funeral notice text here...`
  return ko ? '관련 내용이나 메시지를 붙여넣으세요' : 'Paste the related message here...'
}

interface Notice {
  id: string; title: string; title_en?: string
  content?: string; content_en?: string; created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users?: any
}
interface LifeEvent {
  id: string; type: string; title: string; title_en?: string
  description?: string; event_date: string
  person_name?: string; location_name?: string; contact?: string; raw_text?: string
}

export default function AnnouncementPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find(c => c.id === currentClubId)?.role ?? 'member'
  const canWrite = OFFICER_ROLES.includes(myRole)

  const [tab,        setTab]        = useState<'notice' | 'event'>('notice')
  const [notices,    setNotices]    = useState<Notice[]>([])
  const [events,     setEvents]     = useState<LifeEvent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedRaw,setExpandedRaw]= useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  // ── 폼 상태 ─────────────────────────────────────────────────────
  const emptyNForm = { title: '', content: '' }
  const emptyEForm = { type: 'wedding', title: '', date: '', time: '', person_name: '', location_name: '', contact: '', raw_text: '' }
  const [nForm, setNForm] = useState(emptyNForm)
  const [eForm, setEForm] = useState(emptyEForm)

  // ── 데이터 로드 ─────────────────────────────────────────────────
  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: n }, { data: e }] = await Promise.all([
      supabase.from('announcements')
        .select('id,title,title_en,content,content_en,created_at,users!author_id(full_name,full_name_en)')
        .eq('club_id', currentClubId).order('created_at', { ascending: false }),
      supabase.from('events')
        .select('id,type,title,title_en,description,event_date,person_name,location_name,contact,raw_text')
        .eq('club_id', currentClubId).order('event_date', { ascending: true }),
    ])
    setNotices(n ?? [])
    setEvents(e ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [currentClubId])

  // ── 공지 등록 ────────────────────────────────────────────────────
  async function submitNotice() {
    if (!nForm.title.trim() || !currentClubId) return
    const supabase = createClient()
    await supabase.from('announcements').insert({
      club_id: currentClubId, title: nForm.title.trim(),
      content: nForm.content.trim(), author_id: user!.id,
    })
    setShowAdd(false); setNForm(emptyNForm); load()
  }

  // ── 경조사 등록 ──────────────────────────────────────────────────
  async function submitEvent() {
    if (!eForm.title.trim() || !eForm.date || !currentClubId) return
    const supabase = createClient()
    const eventDate = eForm.time ? `${eForm.date}T${eForm.time}:00` : eForm.date
    const raw = eForm.raw_text.trim() || null
    await supabase.from('events').insert({
      club_id: currentClubId,
      type: eForm.type,
      title: eForm.title.trim(),
      event_date: eventDate,
      person_name: eForm.person_name.trim() || null,
      location_name: eForm.location_name.trim() || null,
      contact: eForm.contact.trim() || null,
      raw_text: raw,
      description: raw,          // fallback for older columns
      created_by: user!.id,
    })
    setShowAdd(false); setEForm(emptyEForm); load()
  }

  // ── 삭제 ─────────────────────────────────────────────────────────
  async function delNotice(id: string) {
    setDeleting(id)
    await createClient().from('announcements').delete().eq('id', id)
    setNotices(p => p.filter(n => n.id !== id)); setDeleting(null)
  }
  async function delEvent(id: string) {
    setDeleting(id)
    await createClient().from('events').delete().eq('id', id)
    setEvents(p => p.filter(e => e.id !== id)); setDeleting(null)
  }

  // ── 날짜 포맷 ────────────────────────────────────────────────────
  function fmtDate(d: string) {
    try { return new Date(d).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) }
    catch { return d }
  }
  function fmtTime(d: string) {
    try { return d.includes('T') ? new Date(d).toLocaleTimeString(ko ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '' }
    catch { return '' }
  }

  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-5 pb-6 space-y-4 animate-fade-in">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{ko ? '공지 · 경조사' : 'Notices & Events'}</h1>
          {!canWrite && (
            <div className="flex items-center gap-1 mt-0.5">
              <Lock size={10} style={{ color: '#5a7a5a' }} />
              <p className="text-xs" style={{ color: '#5a7a5a' }}>
                {ko ? '열람 전용 (임원 이상 작성 가능)' : 'View only — officers can post'}
              </p>
            </div>
          )}
        </div>
        {canWrite && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-xl transition"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
            <Plus size={15} />
            {tab === 'notice' ? (ko ? '공지 작성' : 'Write') : (ko ? '경조사 등록' : 'Add')}
          </button>
        )}
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-1.5 p-1 rounded-2xl"
        style={{ background: 'rgba(6,13,6,0.8)', border: '1px solid rgba(34,197,94,0.1)' }}>
        {([
          ['notice', ko ? '📢 공지사항' : '📢 Notices'],
          ['event',  ko ? '🎊 경조사'  : '🎊 Life Events'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition"
            style={tab === t
              ? { background: 'linear-gradient(135deg,rgba(22,163,74,0.28),rgba(14,53,29,0.6))', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)' }
              : { color: '#5a7a5a' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 로딩 ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
        </div>

      ) : tab === 'notice' ? (
        /* ═══ 공지사항 목록 ═══════════════════════════════════════════ */
        <div className="space-y-3">
          {notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm">{ko ? '공지사항이 없습니다' : 'No announcements yet'}</p>
            </div>
          ) : notices.map(n => {
            const isOpen  = expandedId === n.id
            const title   = ko ? n.title : (n.title_en || n.title)
            const content = ko ? n.content : (n.content_en || n.content)
            const u = Array.isArray(n.users) ? n.users[0] : n.users
            const author  = ko ? u?.full_name : (u?.full_name_en || u?.full_name)
            return (
              <div key={n.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(167,139,250,0.15)' }}>
                      <Bell size={13} style={{ color: '#a78bfa' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm leading-snug">{title}</p>
                      <p className="text-xs mt-1" style={{ color: '#5a7a5a' }}>
                        {author && <span>{author} · </span>}
                        {new Date(n.created_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {canWrite && (
                        <button onClick={() => delNotice(n.id)} disabled={deleting === n.id}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                      {content && (
                        <button onClick={() => setExpandedId(isOpen ? null : n.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {isOpen && content && (
                    <div className="mt-3 pt-3 text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ color: '#a3b8a3', borderTop: '1px solid rgba(34,197,94,0.1)' }}>
                      {content}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* ═══ 경조사 목록 ════════════════════════════════════════════ */
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#3a5a3a' }}>
              <span className="text-5xl mb-3 opacity-40">🎊</span>
              <p className="text-sm">{ko ? '등록된 경조사가 없습니다' : 'No life events yet'}</p>
            </div>
          ) : events.map(ev => {
            const et      = getET(ev.type)
            const isRawOpen = expandedRaw === ev.id
            const title   = ko ? ev.title : (ev.title_en || ev.title)
            const timeStr = fmtTime(ev.event_date)
            const rawBody = ev.raw_text || ev.description

            return (
              <div key={ev.id} className="rounded-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, ${et.theme.bg} 0%, rgba(6,13,6,0.97) 60%)`,
                  border: `1px solid ${et.theme.border}`,
                  boxShadow: `0 4px 20px ${et.theme.glow}`,
                }}>

                {/* 카드 본문 */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-3xl leading-none flex-shrink-0">{et.emoji}</span>
                      <div className="min-w-0 flex-1">
                        {/* 유형 배지 */}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block mb-1.5"
                          style={{ background: et.theme.badge, color: et.theme.text }}>
                          {ko ? et.ko : et.en}
                        </span>
                        {/* 당사자 이름 (굵게) */}
                        {ev.person_name && (
                          <p className="text-white font-bold text-base leading-tight">{ev.person_name}</p>
                        )}
                        {/* 제목 */}
                        <p className={`${ev.person_name ? 'text-xs mt-0.5' : 'text-sm font-semibold'} leading-snug`}
                          style={{ color: ev.person_name ? '#a3b8a3' : 'white' }}>
                          {title}
                        </p>
                      </div>
                    </div>
                    {canWrite && (
                      <button onClick={() => delEvent(ev.id)} disabled={deleting === ev.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* 날짜 · 장소 · 연락처 */}
                  <div className="mt-3 space-y-1.5 pl-1">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} style={{ color: et.theme.text }} className="flex-shrink-0" />
                      <span className="text-xs font-medium" style={{ color: '#d0e0d0' }}>
                        {fmtDate(ev.event_date)}{timeStr ? `  ${timeStr}` : ''}
                      </span>
                    </div>
                    {ev.location_name && (
                      <div className="flex items-center gap-2">
                        <MapPin size={12} style={{ color: et.theme.text }} className="flex-shrink-0" />
                        <span className="text-xs" style={{ color: '#c0d0c0' }}>{ev.location_name}</span>
                      </div>
                    )}
                    {ev.contact && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} style={{ color: et.theme.text }} className="flex-shrink-0" />
                        <span className="text-xs" style={{ color: '#c0d0c0' }}>{ev.contact}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 원문 전체보기 (청첩장·부고장 붙여넣기 내용) */}
                {rawBody && (
                  <div style={{ borderTop: `1px solid ${et.theme.border}` }}>
                    <button onClick={() => setExpandedRaw(isRawOpen ? null : ev.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition"
                      style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <div className="flex items-center gap-2">
                        <FileText size={12} style={{ color: et.theme.text }} />
                        <span className="text-xs font-medium" style={{ color: et.theme.text }}>
                          {ko ? '원문 전체보기' : 'View full message'}
                        </span>
                      </div>
                      {isRawOpen
                        ? <ChevronUp size={14} style={{ color: et.theme.text }} />
                        : <ChevronDown size={14} style={{ color: et.theme.text }} />}
                    </button>
                    {isRawOpen && (
                      <div className="px-4 pb-4 pt-1">
                        <div className="rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap"
                          style={{
                            background: 'rgba(0,0,0,0.35)',
                            color: '#b8ccb8',
                            border: '1px solid rgba(255,255,255,0.05)',
                            fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
                            letterSpacing: '0.01em',
                          }}>
                          {rawBody}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           등록 바텀시트 모달
      ══════════════════════════════════════════════════════════ */}
      {showAdd && (
        <div className="fixed inset-0 flex items-end z-[200]" style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={() => setShowAdd(false)}>
          <div className="w-full rounded-t-3xl p-5 space-y-4 animate-slide-up overflow-y-auto"
            style={{
              background: '#0a140a',
              border: '1px solid rgba(34,197,94,0.18)',
              borderBottom: 'none',
              maxHeight: '92dvh',
            }}
            onClick={e => e.stopPropagation()}>

            {/* 핸들 */}
            <div className="flex justify-center -mt-1 mb-0">
              <div className="w-10 h-1 rounded-full" style={{ background: '#1a3a1a' }} />
            </div>

            {/* 모달 헤더 */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {tab === 'notice' ? (ko ? '📢 공지 작성' : '📢 New Notice') : (ko ? '🎊 경조사 등록' : '🎊 Add Life Event')}
              </h3>
              <button onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#5a7a5a' }}>
                <X size={16} />
              </button>
            </div>

            {tab === 'notice' ? (
              /* ── 공지 폼 ──────────────────────────────────────── */
              <>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    {ko ? '제목 *' : 'Title *'}
                  </label>
                  <input value={nForm.title} onChange={e => setNForm(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && submitNotice()}
                    placeholder={ko ? '공지 제목을 입력하세요' : 'Enter notice title'}
                    className="input-field" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    {ko ? '내용' : 'Content'}
                  </label>
                  <textarea rows={6} value={nForm.content}
                    onChange={e => setNForm(f => ({ ...f, content: e.target.value }))}
                    placeholder={ko ? NOTICE_PLACEHOLDER_KO : NOTICE_PLACEHOLDER_EN}
                    className="input-field resize-none text-sm leading-relaxed" />
                </div>
                <div className="flex gap-3 pb-2">
                  <button onClick={() => setShowAdd(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
                    {ko ? '취소' : 'Cancel'}
                  </button>
                  <button onClick={submitNotice} disabled={!nForm.title.trim()}
                    className="flex-1 py-3 rounded-xl text-white text-sm font-semibold btn-primary disabled:opacity-50">
                    {ko ? '공지 등록' : 'Post Notice'}
                  </button>
                </div>
              </>
            ) : (
              /* ── 경조사 폼 ────────────────────────────────────── */
              <>
                {/* 유형 선택 */}
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#5a7a5a' }}>
                    {ko ? '유형 선택 *' : 'Event Type *'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {EVENT_TYPES.map(et => (
                      <button key={et.value} onClick={() => setEForm(f => ({ ...f, type: et.value }))}
                        className="py-3 rounded-xl text-xs font-medium flex flex-col items-center gap-1.5 transition"
                        style={eForm.type === et.value
                          ? { background: et.theme.badge, border: `1.5px solid ${et.theme.border}`, color: et.theme.text }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#4a6a4a' }}>
                        <span className="text-xl">{et.emoji}</span>
                        <span>{ko ? et.ko : et.en}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 제목 */}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    {ko ? '제목 *' : 'Title *'}
                  </label>
                  <input value={eForm.title} onChange={e => setEForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={
                      eForm.type === 'wedding'    ? (ko ? '예: 홍길동 · 김영희 결혼식'   : 'e.g. Gildong & Younghee Wedding') :
                      eForm.type === 'condolence' ? (ko ? '예: 故 홍길동 선생 부고'       : 'e.g. Passing of Mr. Hong') :
                      eForm.type === 'birth'      ? (ko ? '예: 홍길동 회원 득남 소식'     : 'e.g. New Baby Arrival') :
                      eForm.type === 'birthday'   ? (ko ? '예: 홍길동 회원 칠순 잔치'     : 'e.g. 70th Birthday Celebration') :
                      eForm.type === 'promotion'  ? (ko ? '예: 홍길동 이사 승진 축하'     : 'e.g. Congratulations on Promotion') :
                      ko ? '제목을 입력하세요' : 'Enter title'
                    }
                    className="input-field" />
                </div>

                {/* 당사자 이름 */}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    {eForm.type === 'wedding'    ? (ko ? '신랑 · 신부 이름'  : 'Bride & Groom') :
                     eForm.type === 'condolence' ? (ko ? '고인 성함'         : 'Deceased name') :
                     eForm.type === 'birth'      ? (ko ? '부모 이름'         : 'Parent name(s)') :
                     eForm.type === 'birthday'   ? (ko ? '주인공 이름'       : 'Honoree name') :
                     eForm.type === 'promotion'  ? (ko ? '당사자 이름 · 직위' : 'Name & Title') :
                     ko ? '당사자 이름' : 'Person name'}
                  </label>
                  <input value={eForm.person_name}
                    onChange={e => setEForm(f => ({ ...f, person_name: e.target.value }))}
                    placeholder={
                      eForm.type === 'wedding'    ? (ko ? '예: 신랑 홍길동 ♥ 신부 김영희' : 'e.g. Gildong ♥ Younghee') :
                      eForm.type === 'condolence' ? (ko ? '예: 故 홍길동 (1950 ~ 2025)'   : 'e.g. Hong Gildong (1950–2025)') :
                      eForm.type === 'birthday'   ? (ko ? '예: 홍길동 회장 칠순'          : 'e.g. Chairman Hong — 70th') :
                      ko ? '이름' : 'Name'
                    }
                    className="input-field" />
                </div>

                {/* 날짜 + 시간 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                      {eForm.type === 'condolence' ? (ko ? '발인 날짜 *' : 'Funeral Date *') : (ko ? '날짜 *' : 'Date *')}
                    </label>
                    <input type="date" value={eForm.date}
                      onChange={e => setEForm(f => ({ ...f, date: e.target.value }))}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                      {ko ? '시간' : 'Time'}
                    </label>
                    <input type="time" value={eForm.time}
                      onChange={e => setEForm(f => ({ ...f, time: e.target.value }))}
                      className="input-field" />
                  </div>
                </div>

                {/* 장소 */}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    <MapPin size={11} className="inline mr-1" />
                    {eForm.type === 'condolence' ? (ko ? '빈소 위치' : 'Funeral Hall') :
                     eForm.type === 'wedding'    ? (ko ? '예식장'    : 'Venue')        :
                     ko ? '장소' : 'Location'}
                  </label>
                  <input value={eForm.location_name}
                    onChange={e => setEForm(f => ({ ...f, location_name: e.target.value }))}
                    placeholder={
                      eForm.type === 'wedding'    ? (ko ? '예: OO웨딩홀 2층 다이아몬드홀'     : 'e.g. Grand Ballroom, 2F') :
                      eForm.type === 'condolence' ? (ko ? '예: OO병원 장례식장 1호실'          : 'e.g. St. Mary Hospital Funeral Hall') :
                      ko ? '장소명 및 주소' : 'Venue name / address'
                    }
                    className="input-field" />
                </div>

                {/* 연락처 */}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#5a7a5a' }}>
                    <Phone size={11} className="inline mr-1" />
                    {eForm.type === 'condolence' ? (ko ? '유족 연락처' : 'Family contact') : ko ? '연락처' : 'Contact'}
                  </label>
                  <input value={eForm.contact}
                    onChange={e => setEForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder={ko ? '예: 010-1234-5678' : 'e.g. 010-1234-5678'}
                    className="input-field" />
                </div>

                {/* ── 원문 붙여넣기 (청첩장/부고장) ── */}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#5a7a5a' }}>
                    <FileText size={11} className="inline mr-1" />
                    {eForm.type === 'wedding'    ? (ko ? '청첩장 원문 붙여넣기 (선택)' : 'Paste invitation text (optional)') :
                     eForm.type === 'condolence' ? (ko ? '부고장 원문 붙여넣기 (선택)' : 'Paste funeral notice (optional)') :
                     ko ? '원문 내용 붙여넣기 (선택)' : 'Paste original message (optional)'}
                  </label>
                  <p className="text-xs mb-2" style={{ color: '#3a5a3a' }}>
                    {ko
                      ? '카카오톡, 문자 등에서 복사한 내용을 그대로 붙여넣으세요. 카드에서 "원문 전체보기"로 표시됩니다.'
                      : 'Paste text copied from KakaoTalk, SMS etc. Shown as "View full message" on the card.'}
                  </p>
                  <textarea rows={7} value={eForm.raw_text}
                    onChange={e => setEForm(f => ({ ...f, raw_text: e.target.value }))}
                    placeholder={rawPlaceholder(eForm.type, ko)}
                    className="input-field resize-none text-xs leading-relaxed"
                    style={{ fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", monospace' }} />
                </div>

                <div className="flex gap-3 pb-2">
                  <button onClick={() => setShowAdd(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
                    {ko ? '취소' : 'Cancel'}
                  </button>
                  <button onClick={submitEvent} disabled={!eForm.title.trim() || !eForm.date}
                    className="flex-1 py-3 rounded-xl text-white text-sm font-semibold btn-primary disabled:opacity-50">
                    {ko ? '등록하기' : 'Register'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
