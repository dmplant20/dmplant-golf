'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react'

export default function SetupPasswordPage() {
  const router = useRouter()
  const { lang } = useAuthStore()
  const ko = lang === 'ko'

  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [showPw,   setShowPw]     = useState(false)
  const [showCf,   setShowCf]     = useState(false)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState('')
  const [done,     setDone]       = useState(false)

  const strength = password.length === 0 ? 0
    : password.length < 6  ? 1
    : password.length < 10 ? 2
    : 3

  const strengthLabel = ['', ko ? '너무 짧음' : 'Too short', ko ? '보통' : 'Fair', ko ? '안전' : 'Strong']
  const strengthColor = ['', 'text-red-400', 'text-yellow-400', 'text-green-400']
  const strengthBar   = ['', 'w-1/3 bg-red-500', 'w-2/3 bg-yellow-500', 'w-full bg-green-500']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError(ko ? '비밀번호는 6자 이상이어야 합니다.' : 'Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError(ko ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError(ko ? '비밀번호 설정에 실패했습니다. 다시 시도해 주세요.' : 'Failed to set password. Please try again.')
      setLoading(false)
      return
    }

    // needs_password_reset = false 처리
    await fetch('/api/auth/complete-setup', { method: 'POST' })

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 배경 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-green-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-green-800/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 w-16 h-16">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center shadow-xl shadow-green-900/50">
              <span className="text-2xl">⛳</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Inter Stellar<span className="text-green-400"> GOLF</span>
          </h1>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-2xl">

            {done ? (
              /* 완료 */
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 size={48} className="text-green-400 mx-auto" />
                <p className="text-white font-bold text-lg">
                  {ko ? '비밀번호 설정 완료!' : 'Password Set!'}
                </p>
                <p className="text-gray-400 text-sm">
                  {ko ? '잠시 후 이동합니다...' : 'Redirecting...'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Lock size={18} className="text-green-400" />
                  <h2 className="text-lg font-bold text-white">
                    {ko ? '비밀번호 설정' : 'Set Your Password'}
                  </h2>
                </div>
                <p className="text-gray-500 text-xs mb-5">
                  {ko
                    ? '앞으로 사용할 비밀번호를 설정해 주세요. 6자 이상 입력하세요.'
                    : 'Create your password (min. 6 characters).'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* 새 비밀번호 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                      {ko ? '새 비밀번호' : 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoFocus
                        autoComplete="new-password"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {/* 강도 표시 */}
                    {password.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${strengthBar[strength]}`} />
                        </div>
                        <p className={`text-[11px] ${strengthColor[strength]}`}>{strengthLabel[strength]}</p>
                      </div>
                    )}
                  </div>

                  {/* 비밀번호 확인 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                      {ko ? '비밀번호 확인' : 'Confirm Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showCf ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={`w-full bg-gray-800 border rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none transition placeholder-gray-600 ${
                          confirm && confirm !== password
                            ? 'border-red-600 focus:border-red-500'
                            : confirm && confirm === password
                            ? 'border-green-600 focus:border-green-500'
                            : 'border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
                        }`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCf(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                      >
                        {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-red-400 text-[11px] mt-1">
                        {ko ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.'}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-2.5">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || password.length < 6 || password !== confirm}
                    className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-lg shadow-green-900/30"
                  >
                    {loading
                      ? (ko ? '저장 중...' : 'Saving...')
                      : (ko ? '비밀번호 저장하고 시작하기' : 'Save & Get Started')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
