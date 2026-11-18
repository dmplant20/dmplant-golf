'use client'
// 푸시 알림 관리 — 회장/총무 전용
// 기능:
//  1) 회원별 구독 상태 + 마지막 구독 시각
//  2) 미구독 회원 명단 (회장이 직접 안내 가능)
//  3) 특정 회원에게 테스트 푸시 발송
//  4) 클럽 전체에게 테스트 푸시 발송
//  5) 최근 50건 발송 로그 (성공/실패/이유)
//  6) 30일 통계
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Bell, BellOff, Send, RefreshCw, CheckCircle, XCircle, AlertCircle, Activity, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { isSuperAdmin } from '@/lib/superAdmin'

type Diag = {
  members: Array<{
    user_id: string; role: string; full_name: string; full_name_en: string; email: string;
    subscribed: boolean; sub_count: number; sub_latest: string | null
  }>
  summary: { total: number; subscribed: number; unsubscribed: number }
  recent_logs: Array<{
    id: string; user_id: string | null; type: string; title: string;
    status: 'success'|'failed'|'skipped'; error_code: string | null; error_message: string | null;
    status_code: number | null; created_at: string
  }>
  stats_30d: { total: number; success: number; failed: number; skipped: number; by_error: Record<string, number> }
  env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: boolean; VAPID_PRIVATE_KEY: boolean; VAPID_EMAIL: string | null; SUPABASE_SERVICE_ROLE_KEY: boolean }
}

type TestResult = {
  ok: boolean; sent: number; failed: number; skipped: number; total: number
  details: Array<{
    user_id: string; name: string; email: string;
    status: 'success'|'failed'|'skipped';
    error_code?: string; error_message?: string; status_code?: number
  }>
}

export default function PushAdminPage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const club = myClubs.find(c => c.id === currentClubId)
  const myRole = club?.role ?? 'member'
  const isAdmin = isSuperAdmin(user)
  const canManage = ['president','secretary'].includes(myRole) || isAdmin

  const [data, setData]       = useState<Diag | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [lastTest, setLastTest] = useState<TestResult | null>(null)
  const [testMsg, setTestMsg] = useState('')

  async function load() {
    if (!currentClubId) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/push/diagnostics?club_id=${currentClubId}`)
      if (!res.ok) { setError((await res.json()).error || 'load failed'); setLoading(false); return }
      setData(await res.json())
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  async function sendTest(mode: 'self' | 'user' | 'club_all', target_user_id?: string) {
    if (!currentClubId) return
    setTesting(true); setLastTest(null)
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, club_id: currentClubId, target_user_id,
          title: '🔔 IS Golf 테스트 알림',
          body: testMsg || `${new Date().toLocaleTimeString('ko-KR')} · 정상 도착되면 성공`,
        }),
      })
      const result = await res.json()
      setLastTest(result)
    } catch (e: any) {
      setLastTest({ ok: false, sent: 0, failed: 0, skipped: 0, total: 0, details: [] } as any)
      setError(e.message)
    }
    setTesting(false)
    // 통계 갱신
    setTimeout(load, 500)
  }

  if (!canManage) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400 text-sm">{ko ? '회장 또는 총무만 접근 가능합니다.' : 'President/Secretary only.'}</p>
      </div>
    )
  }

  const errCodeLabel: Record<string, string> = {
    server_key_error: 'VAPID 서버키 오류',
    no_token: '구독 없음 (회원 미활성화)',
    token_expired: '토큰 만료 (자동 정리됨)',
    preference_off: '회원이 카테고리 끔',
    rate_limited: 'FCM 속도 제한',
    api_error: 'FCM/푸시 서버 에러',
  }

  return (
    <div className="px-4 pt-4 pb-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="p-1" style={{ color: 'var(--text-3)' }}><ChevronLeft size={20} /></Link>
        <Bell size={18} style={{ color: 'var(--gold-l, #c9a84c)' }} />
        <h1 className="text-base font-bold flex-1" style={{ color: 'var(--text)' }}>
          {ko ? '푸시 알림 진단' : 'Push Diagnostics'}
        </h1>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>⚠ {error}</p>}

      {/* 환경 변수 */}
      {data?.env && (
        <div className="glass-card rounded-2xl p-3">
          <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-3)' }}>{ko ? '서버 환경' : 'Server Env'}</p>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {[
              ['VAPID 공개키', data.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY],
              ['VAPID 비밀키', data.env.VAPID_PRIVATE_KEY],
              ['Service Role', data.env.SUPABASE_SERVICE_ROLE_KEY],
              ['VAPID Email', !!data.env.VAPID_EMAIL],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between rounded-md px-2 py-1"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--text-2)' }}>{k}</span>
                <span style={{ color: v ? '#4ade80' : '#f87171' }}>{v ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 통계 */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label={ko ? '전체 회원' : 'Total'} value={data.summary.total} color="#94a3b8" />
          <Stat label={ko ? '구독 ✓' : 'Subscribed'} value={data.summary.subscribed} color="#4ade80" />
          <Stat label={ko ? '미구독' : 'Unsubscribed'} value={data.summary.unsubscribed} color="#f87171" />
        </div>
      )}

      {/* 테스트 발송 */}
      <div className="glass-card rounded-2xl p-3 space-y-2.5">
        <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          {ko ? '🧪 테스트 발송' : '🧪 Test Send'}
        </p>
        <input
          type="text" value={testMsg} onChange={e => setTestMsg(e.target.value)}
          placeholder={ko ? '메시지 내용 (비우면 시간 자동)' : 'Message body (optional)'}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => sendTest('self')} disabled={testing}
            className="py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#60a5fa' }}>
            <Send size={12} />{ko ? '내 폰으로 테스트' : 'Send to me'}
          </button>
          <button onClick={() => {
            if (confirm(ko ? '클럽 전체에게 테스트 알림을 발송합니다. 계속?' : 'Send test to entire club?')) sendTest('club_all')
          }} disabled={testing}
            className="py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold-l)' }}>
            <Send size={12} />{ko ? '전체 회원' : 'Send to all'}
          </button>
        </div>
      </div>

      {/* 마지막 테스트 결과 */}
      {lastTest && (
        <div className="glass-card rounded-2xl p-3 space-y-2">
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            {ko ? '📊 마지막 테스트 결과' : 'Last test result'}
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
            <ResultPill label={ko ? '대상' : 'Total'} value={lastTest.total} color="#94a3b8" />
            <ResultPill label="✓" value={lastTest.sent} color="#4ade80" />
            <ResultPill label="✗" value={lastTest.failed} color="#f87171" />
            <ResultPill label={ko ? '스킵' : 'Skip'} value={lastTest.skipped} color="#fbbf24" />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {lastTest.details.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[11px]"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {d.status === 'success' ? <CheckCircle size={11} style={{ color: '#4ade80' }} />
                    : d.status === 'failed' ? <XCircle size={11} style={{ color: '#f87171' }} />
                    : <AlertCircle size={11} style={{ color: '#fbbf24' }} />}
                  <span className="truncate" style={{ color: 'var(--text)' }}>{d.name}</span>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                  {d.status === 'success' ? '✓' : (errCodeLabel[d.error_code ?? ''] ?? d.error_code ?? '?')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미구독 회원 명단 */}
      {data && data.summary.unsubscribed > 0 && (
        <div className="glass-card rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>
              ⚠️ {ko ? `미구독 회원 (${data.summary.unsubscribed}명)` : `Unsubscribed (${data.summary.unsubscribed})`}
            </p>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            {ko ? '아래 회원은 푸시 알림을 받지 못합니다. 직접 안내 부탁드립니다.' : 'These members will not receive any push.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.members.filter(m => !m.subscribed).map(m => (
              <button key={m.user_id}
                onClick={() => sendTest('user', m.user_id)}
                disabled={testing}
                className="text-[11px] px-2 py-1 rounded-full active:scale-95"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
                title={ko ? '클릭하면 이 회원에게 테스트 발송 시도 (실패 예상)' : 'Tap to send (will fail with no_token)'}>
                {m.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 구독 회원 명단 (개별 테스트용) */}
      {data && data.summary.subscribed > 0 && (
        <div className="glass-card rounded-2xl p-3 space-y-2">
          <p className="text-sm font-bold" style={{ color: '#4ade80' }}>
            ✓ {ko ? `구독 회원 — 클릭하여 개별 테스트 (${data.summary.subscribed}명)` : `Subscribed — tap to test (${data.summary.subscribed})`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.members.filter(m => m.subscribed).map(m => (
              <button key={m.user_id}
                onClick={() => sendTest('user', m.user_id)}
                disabled={testing}
                className="text-[11px] px-2 py-1 rounded-full active:scale-95"
                style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }}>
                {m.full_name} ({m.sub_count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 30일 통계 */}
      {data?.stats_30d && data.stats_30d.total > 0 && (
        <div className="glass-card rounded-2xl p-3 space-y-1.5">
          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <Activity size={13} />{ko ? '최근 30일 발송' : 'Last 30 days'}
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
            <ResultPill label={ko ? '총 발송' : 'Total'} value={data.stats_30d.total} color="#94a3b8" />
            <ResultPill label="✓" value={data.stats_30d.success} color="#4ade80" />
            <ResultPill label="✗" value={data.stats_30d.failed} color="#f87171" />
            <ResultPill label={ko ? '스킵' : 'Skip'} value={data.stats_30d.skipped} color="#fbbf24" />
          </div>
          {Object.keys(data.stats_30d.by_error).length > 0 && (
            <div className="text-[10px] pt-1 space-y-0.5" style={{ color: 'var(--text-3)' }}>
              {Object.entries(data.stats_30d.by_error).map(([code, count]) => (
                <div key={code} className="flex justify-between">
                  <span>{errCodeLabel[code] ?? code}</span><span>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 최근 로그 */}
      {data && data.recent_logs.length > 0 && (
        <div className="glass-card rounded-2xl p-3 space-y-1.5">
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            {ko ? '📜 최근 발송 50건' : 'Last 50 logs'}
          </p>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {data.recent_logs.map(l => {
              const nm = data.members.find(m => m.user_id === l.user_id)?.full_name ?? '?'
              return (
                <div key={l.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px]"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {l.status === 'success' ? <CheckCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
                    : l.status === 'failed' ? <XCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                    : <AlertCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold" style={{ color: 'var(--text)' }}>{nm}</span>
                      <span style={{ color: 'var(--text-3)' }}>·</span>
                      <span style={{ color: 'var(--text-3)' }}>{l.type}</span>
                    </div>
                    <p className="truncate" style={{ color: 'var(--text-2)' }}>{l.title}</p>
                    {l.error_code && (
                      <p className="text-[10px]" style={{ color: '#fca5a5' }}>{errCodeLabel[l.error_code] ?? l.error_code} {l.status_code ? `(${l.status_code})` : ''}</p>
                    )}
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                    {new Date(l.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass-card rounded-xl px-2 py-2 text-center">
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  )
}

function ResultPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md px-2 py-1 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <p className="font-bold" style={{ color }}>{value}</p>
      <p style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  )
}
