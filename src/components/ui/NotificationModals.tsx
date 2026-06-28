'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

// ── Types ────────────────────────────────────────────────────────────────

interface MeetingNotif {
  clubId: string
  clubName: string
  year: number
  month: number
  meetingDate: string   // YYYY-MM-DD
  daysUntil: number
  venue: string | null
  time: string | null
}

interface UnpaidFee {
  clubId: string
  clubName: string
  feeType: string
  amount: number
  currency: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

const SESSION_KEY = (clubId: string, year: number, month: number) =>
  `mtg_notif_${clubId}_${year}_${month}`

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function formatMeetingDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const dow = WEEKDAY_KO[d.getUTCDay()]
  return `${y}년 ${m}월 ${day}일 (${dow})`
}

function formatAmount(amount: number, currency: string): string {
  if (currency === 'KRW') return amount.toLocaleString('ko-KR') + '원'
  if (currency === 'VND') return amount.toLocaleString('vi-VN') + '₫'
  if (currency === 'IDR') return 'Rp ' + amount.toLocaleString('id-ID')
  return amount.toLocaleString() + ' ' + currency
}

// ── Styles ───────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.65)',
  zIndex: 9000,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
}

const sheet: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: '#0c1a0c',
  borderTop: '1px solid rgba(74,222,128,0.25)',
  borderRadius: '16px 16px 0 0',
  padding: '24px 20px 36px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const badge: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(74,222,128,0.15)',
  border: '1px solid rgba(74,222,128,0.4)',
  color: '#4ade80',
  borderRadius: 6,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 700,
}

const unpaidBadge: React.CSSProperties = {
  ...badge,
  background: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.4)',
  color: '#f87171',
}

const btnBase: React.CSSProperties = {
  flex: 1,
  padding: '10px 0',
  borderRadius: 8,
  border: 'none',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
}

// ── Main Component ────────────────────────────────────────────────────────

export default function NotificationModals() {
  const { user } = useAuthStore()

  const [meeting, setMeeting] = useState<MeetingNotif | null>(null)
  const [unpaidFees, setUnpaidFees] = useState<UnpaidFee[]>([])
  const [showMeeting, setShowMeeting] = useState(false)
  const [showFees, setShowFees] = useState(false)

  // Meeting modal sub-state
  const [notAttendingMode, setNotAttendingMode] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch pending notifications when user loads
  useEffect(() => {
    if (!user) return

    async function fetchPending() {
      try {
        const res = await fetch('/api/notifications/pending')
        if (!res.ok) return
        const data = await res.json()

        if (data.meeting) {
          const m: MeetingNotif = data.meeting
          const key = SESSION_KEY(m.clubId, m.year, m.month)
          // Don't show if dismissed this session
          if (!sessionStorage.getItem(key)) {
            setMeeting(m)
            setShowMeeting(true)
          }
        }

        if (data.unpaidFees?.length) {
          const feesKey = `fee_notif_dismissed`
          if (!sessionStorage.getItem(feesKey)) {
            setUnpaidFees(data.unpaidFees)
            setShowFees(true)
          }
        }
      } catch (_e) {
        // Silent fail
      }
    }

    fetchPending()
  }, [user])

  const handleRespond = useCallback(async (status: 'attending' | 'not_attending') => {
    if (!meeting) return
    setSubmitting(true)
    try {
      await fetch('/api/notifications/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: meeting.clubId,
          year: meeting.year,
          month: meeting.month,
          status,
          reason: status === 'not_attending' ? reason : undefined,
        }),
      })
    } catch (_e) {
      // Silent fail — still close modal
    }
    setMeeting(null)
    setShowMeeting(false)
    setSubmitting(false)
  }, [meeting, reason])

  const handleMeetingDismiss = useCallback(() => {
    if (!meeting) return
    const key = SESSION_KEY(meeting.clubId, meeting.year, meeting.month)
    sessionStorage.setItem(key, '1')
    setShowMeeting(false)
  }, [meeting])

  const handleFeesDismiss = useCallback(() => {
    sessionStorage.setItem('fee_notif_dismissed', '1')
    setShowFees(false)
  }, [])

  if (!user) return null

  return (
    <>
      {/* ── Meeting attendance modal ── */}
      {showMeeting && meeting && (
        <div style={overlay} onClick={handleMeetingDismiss}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📅</span>
              <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 17 }}>
                정기모임 참석 확인
              </span>
            </div>

            {/* Club + date info */}
            <div
              style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.15)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>
                {meeting.clubName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8', fontSize: 14 }}>
                  {formatMeetingDate(meeting.meetingDate)}
                </span>
                <span style={badge}>D-{meeting.daysUntil}</span>
              </div>
              {meeting.time && (
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  ⏰ {meeting.time}
                </div>
              )}
              {meeting.venue && (
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  📍 {meeting.venue}
                </div>
              )}
            </div>

            {/* Not attending reason input */}
            {notAttendingMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ color: '#94a3b8', fontSize: 13 }}>불참 사유 (선택)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="불참 사유를 입력하세요"
                  rows={3}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(74,222,128,0.2)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                    padding: '10px 12px',
                    fontSize: 14,
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: '#94a3b8', flex: 'none', padding: '10px 16px' }}
                    onClick={() => { setNotAttendingMode(false); setReason('') }}
                    disabled={submitting}
                  >
                    취소
                  </button>
                  <button
                    style={{ ...btnBase, background: '#ef4444', color: '#fff' }}
                    onClick={() => handleRespond('not_attending')}
                    disabled={submitting}
                  >
                    {submitting ? '전송 중...' : '불참 제출'}
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!notAttendingMode && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...btnBase, background: '#16a34a', color: '#fff' }}
                  onClick={() => handleRespond('attending')}
                  disabled={submitting}
                >
                  {submitting ? '...' : '참석'}
                </button>
                <button
                  style={{ ...btnBase, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                  onClick={() => setNotAttendingMode(true)}
                  disabled={submitting}
                >
                  불참
                </button>
                <button
                  style={{ ...btnBase, background: 'rgba(255,255,255,0.07)', color: '#94a3b8', flex: 'none', padding: '10px 16px' }}
                  onClick={handleMeetingDismiss}
                  disabled={submitting}
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Unpaid fee reminder ── */}
      {showFees && unpaidFees.length > 0 && !showMeeting && (
        <div style={overlay} onClick={handleFeesDismiss}>
          <div style={sheet} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💳</span>
              <span style={{ color: '#f87171', fontWeight: 800, fontSize: 17 }}>
                회비 미납 안내
              </span>
            </div>

            {/* Fee items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unpaidFees.map((fee) => (
                <div
                  key={fee.clubId}
                  style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>
                      {fee.clubName}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                      {fee.feeType === 'monthly' ? '월회비' : '연회비'}{' '}
                      {formatAmount(fee.amount, fee.currency)}
                    </span>
                  </div>
                  <span style={unpaidBadge}>미납</span>
                </div>
              ))}
            </div>

            <button
              style={{ ...btnBase, background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}
              onClick={handleFeesDismiss}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  )
}
