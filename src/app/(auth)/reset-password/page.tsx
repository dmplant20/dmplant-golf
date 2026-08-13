'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { lang } = useAuthStore()
  const ko = lang === 'ko'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()
    // 1) onAuthStateChange — 리디렉트 직후 PASSWORD_RECOVERY 이벤트
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'INITIAL_SESSION')) {
        setReady(true)
        if (session?.user?.email) setEmail(session.user.email)
      }
    })
    // 2) 페이지 진입 즉시 세션도 확인 (이벤트 미스 케이스 대비)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setReady(true); if (session.user?.email) setEmail(session.user.email) }
    })
    return () => sub.data.subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(ko ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError(ko ? '비밀번호는 8자 이상이어야 합니다.' : 'Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(ko ? '비밀번호 변경에 실패했습니다.' : 'Failed to reset password.')
      setLoading(false)
      return
    }
    // password_set=true 마킹 → 강제 비밀번호 설정 팝업 다시 안 뜸
    try {
      if (user?.id) {
        await supabase.from('users').update({ password_set: true }).eq('id', user.id)
      }
    } catch { /* ignore — 다음 로그인 시 자동 복구 */ }
    // 저장된 자격증명도 갱신 (자동 채우기 호환)
    try {
      if (email) localStorage.setItem('isgolf-saved-email', email)
      localStorage.setItem('isgolf-saved-pw', btoa(password))
    } catch { /* ignore */ }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">⛳</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Inter Stellar GOLF</h1>
        </div>

        <h2 className="text-xl font-semibold text-white mb-6">
          {ko ? '새 비밀번호 설정' : 'Set New Password'}
        </h2>

        {!ready ? (
          <p className="text-gray-400 text-sm text-center">
            {ko ? '링크를 확인 중입니다...' : 'Verifying link...'}
          </p>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{ko ? '새 비밀번호' : 'New Password'}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{ko ? '비밀번호 확인' : 'Confirm Password'}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
            >
              {loading ? (ko ? '변경 중...' : 'Updating...') : (ko ? '비밀번호 변경' : 'Update Password')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
