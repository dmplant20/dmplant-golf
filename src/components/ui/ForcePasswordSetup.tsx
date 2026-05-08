'use client'
// 첫 로그인 후 강제 비밀번호 설정 모달
// users.password_set === false 일 때 화면 전체를 덮어 사용 차단
// 비밀번호를 설정해야만 닫힘 (X 버튼·바깥 클릭으로 닫을 수 없음)
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lock, Eye, EyeOff, Check } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'

export default function ForcePasswordSetup() {
  const { user, setUser, lang } = useAuthStore()
  const ko = lang === 'ko'

  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 모달이 열려있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (user?.password_set === false) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [user?.password_set])

  if (typeof document === 'undefined') return null
  if (!user) return null
  if (user.password_set !== false) return null  // 이미 설정됨 → 표시 안 함

  async function submit() {
    setError(null)
    if (pw1.length < 8) { setError(ko ? '비밀번호는 8자 이상이어야 합니다' : 'At least 8 characters'); return }
    if (pw1 !== pw2) { setError(ko ? '비밀번호가 일치하지 않습니다' : 'Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '비밀번호 설정 실패')
      // 성공 — 스토어에 password_set=true 반영 + DB 재조회로 확정
      setSuccess(true)
      setUser({ ...(user as any), password_set: true })
      // 한 박자 보여주고 닫기
      setTimeout(async () => {
        // 새로 발급된 토큰으로 세션 갱신 시도 (어드민 update 가 비밀번호만 갱신해서 세션 자체는 유효함)
        const supabase = createClient()
        const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).single()
        if (profile) setUser(profile)
      }, 800)
    } catch (e: any) {
      setError(e?.message ?? '오류')
      setLoading(false)
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: '#0f1a0f', border: '1px solid rgba(34,197,94,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="px-6 pt-6 pb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(22,163,74,0.1))', border: '1px solid rgba(34,197,94,0.4)' }}>
            <Lock size={22} className="text-green-300" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {ko ? '비밀번호를 설정해 주세요' : 'Set Your Password'}
          </h2>
          <p className="text-xs mt-1.5" style={{ color: '#86efac' }}>
            {ko
              ? '관리자가 사전 등록한 계정입니다. 안전한 사용을 위해 비밀번호를 등록해야 앱을 이용하실 수 있습니다.'
              : 'Admin pre-registered your account. Please set a password to continue.'}
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* 비밀번호 */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>
              {ko ? '새 비밀번호 (8자 이상)' : 'New password (8+ chars)'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={pw1}
                onChange={e => setPw1(e.target.value)}
                disabled={loading || success}
                autoFocus
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-green-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {/* 확인 */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86efac' }}>
              {ko ? '비밀번호 확인' : 'Confirm password'}
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              disabled={loading || success}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-xl px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-800/50 rounded-xl px-3 py-2 flex items-center gap-2">
              <Check size={14} className="text-green-400" />
              <p className="text-xs text-green-400">
                {ko ? '비밀번호가 설정됐습니다. 정상 사용하실 수 있습니다.' : 'Password set. You can now use the app.'}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={submit}
            disabled={loading || success || !pw1 || !pw2}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 active:scale-[0.97] transition"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}
          >
            {loading ? (ko ? '설정 중...' : 'Saving...') : success ? (ko ? '✓ 완료' : '✓ Done') : (ko ? '비밀번호 등록' : 'Save Password')}
          </button>
          <p className="text-[10px] mt-3 text-center" style={{ color: '#5a7a5a' }}>
            {ko ? '비밀번호를 등록해야 앱을 사용할 수 있습니다.' : 'Password registration is required to use the app.'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
