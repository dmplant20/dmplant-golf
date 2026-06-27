'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { getPushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push'
import { useAuthStore } from '@/stores/authStore'

/**
 * 알림 활성/비활성 토글 — 모바일/PWA에서 푸시 권한 요청 + 구독 관리.
 *
 * variant:
 *  - 'card'   : 풀 카드 형태 (settings 페이지)
 *  - 'banner' : 활성화되지 않았을 때만 보이는 dashboard 상단 배너
 *  - 'compact': 작은 인라인 토글 (헤더 등)
 */
export default function PushNotificationToggle({
  variant = 'card',
  hideWhenSubscribed = false,
}: {
  variant?: 'card' | 'banner' | 'compact'
  hideWhenSubscribed?: boolean
}) {
  const lang = useAuthStore(s => s.lang)
  const ko = lang === 'ko'
  const [status, setStatus]   = useState<PushStatus>('unsupported')
  const [busy,   setBusy]     = useState(false)
  const [error,  setError]    = useState<string | null>(null)

  useEffect(() => {
    getPushStatus().then(setStatus)
  }, [])

  async function enable() {
    setBusy(true); setError(null)
    const r = await subscribePush()
    setBusy(false)
    if (r.ok) setStatus('subscribed')
    else setError(r.reason ?? 'Failed')
  }

  async function disable() {
    setBusy(true); setError(null)
    await unsubscribePush()
    setStatus('default')
    setBusy(false)
  }

  if (status === 'unsupported') return null
  if (status === 'subscribed' && hideWhenSubscribed) return null

  // ── banner 변형: default 상태에서만 표시 ─────────────────────────────
  if (variant === 'banner') {
    if (status !== 'default') return null
    return (
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.10), rgba(34,197,94,0.06))', border: '1px solid rgba(201,168,76,0.25)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.14)' }}>
          <BellRing size={16} style={{ color: 'var(--gold-l)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {ko ? '🔔 알림 받기' : '🔔 Get notifications'}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {ko ? '새 공지·경조사·모임을 모바일로 바로 받아보세요' : 'Get pushes for new notices, events & meetings'}
          </p>
          {error && <p className="text-[11px] text-red-400 mt-0.5">⚠ {error}</p>}
        </div>
        <button
          onClick={enable}
          disabled={busy}
          className="text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' }}
        >
          {busy ? (ko ? '활성화 중...' : 'Enabling...') : (ko ? '활성화' : 'Enable')}
        </button>
      </div>
    )
  }

  // ── compact 변형 ───────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <button
        onClick={status === 'subscribed' ? disable : enable}
        disabled={busy || status === 'denied'}
        title={status === 'subscribed' ? (ko ? '알림 끄기' : 'Disable') : (ko ? '알림 켜기' : 'Enable')}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-50"
        style={
          status === 'subscribed'
            ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
            : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-3)', border: '1px solid var(--border)' }
        }
      >
        {status === 'subscribed' ? <Bell size={15} /> : <BellOff size={15} />}
      </button>
    )
  }

  // ── card 변형 (settings) ───────────────────────────────────────────
  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: status === 'subscribed' ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.10)' }}>
          {status === 'subscribed'
            ? <Bell size={18} style={{ color: '#4ade80' }} />
            : <BellOff size={18} style={{ color: 'var(--gold-l)' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {ko ? '푸시 알림' : 'Push Notifications'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {status === 'subscribed'  ? (ko ? '✅ 새 공지·경조사·모임 알림이 활성화되어 있습니다' : '✅ Active for new notices, events, meetings')
             : status === 'denied'    ? (ko ? '브라우저 설정에서 알림 권한을 허용해주세요' : 'Allow notifications in browser settings')
             :                          (ko ? '활성화하면 새 공지를 모바일로 바로 받아볼 수 있습니다' : 'Enable to receive notifications on this device')}
          </p>
          {error && <p className="text-[11px] text-red-400 mt-0.5">⚠ {error}</p>}
        </div>
        <button
          onClick={status === 'subscribed' ? disable : enable}
          disabled={busy || status === 'denied'}
          className="text-xs font-bold px-3.5 py-2 rounded-lg flex-shrink-0 disabled:opacity-50"
          style={
            status === 'subscribed'
              ? { background: 'rgba(255,255,255,0.06)', color: 'var(--text-3)', border: '1px solid var(--border)' }
              : { background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#fff' }
          }
        >
          {busy
            ? (ko ? '...' : '...')
            : status === 'subscribed'
              ? (ko ? '끄기' : 'Disable')
              : (ko ? '켜기' : 'Enable')}
        </button>
      </div>
    </div>
  )
}
