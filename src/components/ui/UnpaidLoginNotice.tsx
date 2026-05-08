'use client'
// 로그인 후 1회 노출 — 본인 회비/벌금 미납 내역 팝업
// sessionStorage 로 1세션 1회만 노출 (탭 닫고 새 세션이면 다시 노출)
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, X, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import Link from 'next/link'

interface UnpaidFee {
  club_id: string
  club_name: string
  fee_type: 'annual' | 'monthly'
  amount: number
  currency: string
  unpaid_months?: number[]
}
interface UnpaidFine {
  club_id: string
  club_name: string
  count: number
  total: number
  currency: string
}

const SYM: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp ' }

export default function UnpaidLoginNotice() {
  const { user, lang } = useAuthStore()
  const ko = lang === 'ko'
  const [show, setShow] = useState(false)
  const [fees, setFees] = useState<UnpaidFee[]>([])
  const [fines, setFines] = useState<UnpaidFine[]>([])

  useEffect(() => {
    if (!user?.id) return
    // 1세션 1회 — 본인 비밀번호 미설정 상태(password_set=false)에서는 우선 비밀번호 팝업이 떠야 하므로 패스
    if (user.password_set === false) return
    const key = `unpaid-notice-${user.id}`
    if (sessionStorage.getItem(key) === '1') return

    fetch('/api/finance/my-unpaid')
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (!data || !data.has_any) return
        setFees(data.unpaidFees ?? [])
        setFines(data.unpaidFines ?? [])
        setShow(true)
        sessionStorage.setItem(key, '1')
      })
      .catch(() => {})
  }, [user?.id, user?.password_set])

  if (typeof document === 'undefined') return null
  if (!show) return null

  function close() { setShow(false) }

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: '#1a0f0f', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <AlertCircle size={20} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-base font-bold text-white">
              {ko ? '미납 안내' : 'Unpaid Notice'}
            </h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#fca5a5' }}>
              {ko ? '본인의 미납 내역을 확인해 주세요' : 'Please check your unpaid items'}
            </p>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <X size={14} className="text-white" />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-2">
          {fees.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#fca5a5' }}>
                💰 {ko ? '회비 미납' : 'Unpaid Fees'}
              </p>
              <div className="space-y-1.5">
                {fees.map((f, i) => (
                  <div key={i} className="rounded-xl px-3 py-2"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-sm font-semibold text-white">{f.club_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#fcd34d' }}>
                      {f.fee_type === 'annual'
                        ? (ko ? '연회비' : 'Annual')
                        : `${ko ? '월회비' : 'Monthly'} · ${(f.unpaid_months ?? []).join(', ')}${ko ? '월' : ''}`}
                      {' · '}
                      <span className="font-bold" style={{ color: '#f87171' }}>
                        {SYM[f.currency] ?? ''}{f.amount.toLocaleString()}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {fines.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#fca5a5' }}>
                ⚠️ {ko ? '벌금 미납' : 'Unpaid Fines'}
              </p>
              <div className="space-y-1.5">
                {fines.map((f, i) => (
                  <div key={i} className="rounded-xl px-3 py-2"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p className="text-sm font-semibold text-white">{f.club_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#fcd34d' }}>
                      {f.count}{ko ? '건' : ' fines'}
                      {' · '}
                      <span className="font-bold" style={{ color: '#f87171' }}>
                        {SYM[f.currency] ?? ''}{f.total.toLocaleString()}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 flex gap-2">
          <button onClick={close}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-gray-300 active:scale-[0.97]">
            {ko ? '확인' : 'OK'}
          </button>
          <Link href="/finance" onClick={close}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white text-center active:scale-[0.97] flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
            {ko ? '재무 보기' : 'Finance'}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
