'use client'
// 헤더 알림 벨 패널 — 최근 공지·경조사 + 본인 미납·미응답 정기모임 통합 표시
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Bell, Calendar, AlertCircle, MessageCircle, Wallet, X, Sparkles } from 'lucide-react'

const SYM: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp ' }

interface NoticeItem { id: string; title: string; created_at: string; is_meeting?: boolean }
interface EventItem  { id: string; title: string; type: string; event_date: string; created_at: string; person_name?: string | null }
interface UnpaidFee  { club_id: string; club_name: string; fee_type: 'annual' | 'monthly'; amount: number; currency: string; unpaid_months?: number[] }
interface UnpaidFine { club_id: string; club_name: string; count: number; total: number; currency: string }
interface PendingMeeting { clubId: string; clubName: string; year: number; month: number; meetingDate: string; daysUntil: number; venue: string | null; time: string | null }

export default function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentClubId, lang, user } = useAuthStore()
  const ko = lang === 'ko'
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const [events,  setEvents]  = useState<EventItem[]>([])
  const [unpaidFees,  setUnpaidFees]  = useState<UnpaidFee[]>([])
  const [unpaidFines, setUnpaidFines] = useState<UnpaidFine[]>([])
  const [pendingMeeting, setPendingMeeting] = useState<PendingMeeting | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !user?.id || !currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const sinceDate = new Date(Date.now() - 14 * 86400_000).toISOString()
    Promise.all([
      // 최근 14일 공지
      supabase.from('announcements')
        .select('id,title,created_at,is_meeting')
        .eq('club_id', currentClubId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .gt('created_at', sinceDate)
        .order('is_meeting', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      // 최근 14일 경조사
      supabase.from('events')
        .select('id,title,type,event_date,created_at,person_name')
        .eq('club_id', currentClubId)
        .gt('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(5),
      // 본인 미납
      fetch('/api/finance/my-unpaid').then(r => r.ok ? r.json() : null).catch(() => null),
      // 미응답 정기모임
      fetch('/api/notifications/pending').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([n, e, unpaid, pend]: any[]) => {
      setNotices(n.data ?? [])
      setEvents(e.data ?? [])
      setUnpaidFees(unpaid?.unpaidFees ?? [])
      setUnpaidFines(unpaid?.unpaidFines ?? [])
      setPendingMeeting(pend?.meeting ?? null)
      setLoading(false)
    })
  }, [open, user?.id, currentClubId])

  if (!open) return null

  const hasAny = notices.length || events.length || unpaidFees.length || unpaidFines.length || pendingMeeting

  return (
    <>
      {/* 백드롭 */}
      <div onClick={onClose} className="fixed inset-0 z-[150]" style={{ background: 'rgba(0,0,0,0.4)' }} />
      {/* 패널 */}
      <div
        className="fixed z-[160] rounded-2xl overflow-hidden"
        style={{
          top: 64, right: 12,
          width: 'min(380px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 84px)',
          background: '#0f1a0f',
          border: '1px solid rgba(34,197,94,0.25)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(34,197,94,0.15)' }}>
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-amber-300" />
            <p className="text-sm font-bold text-white">{ko ? '알림' : 'Notifications'}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <p className="text-center text-xs text-gray-500 py-8">{ko ? '불러오는 중...' : 'Loading...'}</p>
          ) : !hasAny ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
              <Sparkles size={28} className="opacity-40" />
              <p className="text-xs">{ko ? '새 알림이 없습니다' : 'No new notifications'}</p>
            </div>
          ) : (
            <>
              {/* 미납 회비 — 본인 알림 */}
              {unpaidFees.map((f, i) => (
                <Link key={'fee'+i} href="/finance" onClick={onClose}
                  className="block rounded-xl p-3 transition active:scale-[0.98]"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div className="flex items-start gap-2">
                    <Wallet size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{ko ? '회비 미납' : 'Unpaid fee'}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#fca5a5' }}>
                        {f.club_name} · {f.fee_type === 'annual' ? (ko ? '연회비' : 'Annual') : `${(f.unpaid_months ?? []).join(',')}${ko ? '월' : ''}`}
                        {' · '}{SYM[f.currency] ?? ''}{f.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {/* 미납 벌금 */}
              {unpaidFines.map((f, i) => (
                <Link key={'fine'+i} href="/finance" onClick={onClose}
                  className="block rounded-xl p-3 transition active:scale-[0.98]"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{ko ? '벌금 미납' : 'Unpaid fine'}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#fca5a5' }}>
                        {f.club_name} · {f.count}{ko ? '건' : ' fines'} · {SYM[f.currency] ?? ''}{f.total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {/* 정기모임 응답 대기 */}
              {pendingMeeting && (
                <Link href="/meetings" onClick={onClose}
                  className="block rounded-xl p-3 transition active:scale-[0.98]"
                  style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.3)' }}>
                  <div className="flex items-start gap-2">
                    <Calendar size={14} className="text-amber-300 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {ko ? `${pendingMeeting.month}월 정기모임 응답하기` : `Meeting RSVP`}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#fcd34d' }}>
                        {pendingMeeting.meetingDate}
                        {pendingMeeting.venue ? ` · ${pendingMeeting.venue}` : ''}
                        {pendingMeeting.daysUntil >= 0 ? ` · D-${pendingMeeting.daysUntil}` : ''}
                      </p>
                    </div>
                  </div>
                </Link>
              )}

              {/* 최근 공지 */}
              {notices.map(n => (
                <Link key={n.id} href={`/announcement?notice=${n.id}`} onClick={onClose}
                  className="block rounded-xl p-3 transition active:scale-[0.98]"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <div className="flex items-start gap-2">
                    <Bell size={14} className="text-violet-300 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {n.is_meeting && '📌 '}{n.title}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#a78bfa' }}>
                        {ko ? '공지사항' : 'Notice'} · {new Date(n.created_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {/* 최근 경조사 */}
              {events.map(e => {
                const emoji = e.type === 'wedding' ? '🎊' : e.type === 'condolence' ? '🕊️' : e.type === 'birth' ? '👶' : e.type === 'birthday' ? '🎂' : e.type === 'promotion' ? '🏆' : '✨'
                return (
                  <Link key={e.id} href={`/announcement?event=${e.id}`} onClick={onClose}
                    className="block rounded-xl p-3 transition active:scale-[0.98]"
                    style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {e.person_name ?? e.title}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#f9a8d4' }}>
                          {ko ? '경조사' : 'Event'} · {String(e.event_date).slice(0, 10)}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </>
          )}
        </div>

        {/* 하단 — 채팅 바로가기 */}
        <Link href="/chat" onClick={onClose}
          className="flex items-center justify-center gap-2 py-3 flex-shrink-0 transition hover:bg-white/5"
          style={{ borderTop: '1px solid rgba(34,197,94,0.15)' }}>
          <MessageCircle size={14} className="text-green-400" />
          <span className="text-sm font-medium text-green-400">{ko ? '채팅 열기' : 'Open Chat'}</span>
        </Link>
      </div>
    </>
  )
}
