'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

type Step = 'email' | 'password' | 'setup'

export default function LoginPage() {
  const router = useRouter()
  const { lang, setLang } = useAuthStore()
  const ko = lang === 'ko'

  const [step,     setStep]     = useState<Step>('email')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [showCf,   setShowCf]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // ── Step 1: 이메일 확인 ────────────────────────────────────────────────────
  async function handleEmailNext(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/check-first-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!data.exists) {
        setError(ko ? '등록되지 않은 이메일입니다.' : 'Email not registered.')
      } else if (data.firstTime) {
        setStep('setup')   // 첫 로그인 → 비밀번호 설정 화면 바로 표시
      } else {
        setStep('password') // 기존 회원 → 비밀번호 입력
      }
    } catch {
      setError(ko ? '오류가 발생했습니다. 다시 시도해 주세요.' : 'An error occurred.')
    }
    setLoading(false)
  }

  // ── Step 2a: 기존 회원 로그인 ──────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (loginErr) {
      setError(ko ? '비밀번호가 올바르지 않습니다.' : 'Incorrect password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  // ── Step 2b: 첫 로그인 비밀번호 설정 ──────────────────────────────────────
  async function handleSetup(e: React.FormEvent) {
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

    // 서버에서 비밀번호 설정
    const res = await fetch('/api/auth/set-first-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? (ko ? '비밀번호 설정에 실패했습니다.' : 'Failed to set password.'))
      setLoading(false)
      return
    }

    // 설정 완료 후 자동 로그인
    const supabase = createClient()
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (loginErr) {
      setError(ko ? '로그인에 실패했습니다. 방금 설정한 비밀번호로 다시 로그인해 주세요.' : 'Login failed. Please sign in with your new password.')
      setLoading(false)
      setStep('password')
    } else {
      router.push('/dashboard')
    }
  }

  const strengthScore = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthBar   = ['', 'w-1/3 bg-red-500', 'w-2/3 bg-yellow-500', 'w-full bg-green-500'][strengthScore]
  const strengthLabel = ['', ko ? '너무 짧음' : 'Too short', ko ? '보통' : 'Fair', ko ? '안전' : 'Strong'][strengthScore]
  const strengthColor = ['', 'text-red-400', 'text-yellow-400', 'text-green-400'][strengthScore]

  const back = () => { setStep('email'); setError(''); setPassword(''); setConfirm('') }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-green-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-green-800/10 rounded-full blur-3xl" />
      </div>

      {/* 언어 토글 */}
      <div className="relative z-10 flex justify-end p-4">
        <button
          onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
          className="text-xs text-green-400 border border-green-800/60 rounded-full px-3 py-1.5 hover:bg-green-900/30 transition"
        >
          {lang === 'ko' ? 'EN' : '한국어'}
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10">
        {/* 로고 */}
        <div className="mb-10 text-center">
          <div className="relative mx-auto mb-4 w-20 h-20">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center shadow-xl shadow-green-900/50">
              <span className="text-3xl">⛳</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Inter Stellar<span className="text-green-400"> GOLF</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1.5">
            {ko ? '골프 모임 관리' : 'Golf Club Management'}
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-2xl">

            {/* ── STEP: 이메일 ── */}
            {step === 'email' && (
              <>
                <h2 className="text-lg font-bold text-white mb-1">{ko ? '로그인' : 'Sign In'}</h2>
                <p className="text-gray-500 text-xs mb-5">
                  {ko ? '등록된 이메일을 입력하세요.' : 'Enter your registered email.'}
                </p>
                <form onSubmit={handleEmailNext} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                      {ko ? '이메일' : 'Email'}
                    </label>
                    <input
                      type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      required autoFocus autoComplete="email"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
                      placeholder="golf@email.com"
                    />
                  </div>
                  {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading || !email.trim()}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-lg shadow-green-900/30">
                    {loading ? (ko ? '확인 중...' : 'Checking...') : (ko ? '다음' : 'Next')}
                  </button>
                </form>
              </>
            )}

            {/* ── STEP: 기존 회원 비밀번호 로그인 ── */}
            {step === 'password' && (
              <>
                <button onClick={back} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs mb-4 transition">
                  <ArrowLeft size={13} /> {email}
                </button>
                <h2 className="text-lg font-bold text-white mb-5">{ko ? '비밀번호 입력' : 'Enter Password'}</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                      {ko ? '비밀번호' : 'Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        required autoFocus autoComplete="current-password"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}
                  <button type="submit" disabled={loading || !password}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-lg shadow-green-900/30">
                    {loading ? (ko ? '로그인 중...' : 'Signing in...') : (ko ? '로그인' : 'Sign In')}
                  </button>
                </form>
                <div className="mt-4 text-right">
                  <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-green-400 transition">
                    {ko ? '비밀번호를 잊으셨나요?' : 'Forgot password?'}
                  </Link>
                </div>
              </>
            )}

            {/* ── STEP: 첫 로그인 비밀번호 설정 ── */}
            {step === 'setup' && (
              <>
                <button onClick={back} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs mb-4 transition">
                  <ArrowLeft size={13} /> {email}
                </button>
                <h2 className="text-lg font-bold text-white mb-1">
                  {ko ? '비밀번호 설정' : 'Set Password'}
                </h2>
                <p className="text-gray-500 text-xs mb-5">
                  {ko ? '처음 로그인입니다. 사용할 비밀번호를 만들어 주세요.' : 'First login. Please create your password.'}
                </p>
                <form onSubmit={handleSetup} className="space-y-4">
                  {/* 새 비밀번호 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                      {ko ? '새 비밀번호' : 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        required autoFocus autoComplete="new-password"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${strengthBar}`} />
                        </div>
                        <p className={`text-[11px] ${strengthColor}`}>{strengthLabel}</p>
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
                        type={showCf ? 'text' : 'password'} value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required autoComplete="new-password"
                        className={`w-full bg-gray-800 border rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none transition placeholder-gray-600 ${
                          confirm && confirm !== password ? 'border-red-600' :
                          confirm && confirm === password ? 'border-green-600' :
                          'border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
                        }`}
                        placeholder="••••••••"
                      />
                      <button type="button" onClick={() => setShowCf(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                        {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-red-400 text-[11px] mt-1">
                        {ko ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.'}
                      </p>
                    )}
                  </div>

                  {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">{error}</p>}

                  <button type="submit"
                    disabled={loading || password.length < 6 || password !== confirm}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-lg shadow-green-900/30">
                    {loading
                      ? (ko ? '설정 중...' : 'Setting up...')
                      : (ko ? '비밀번호 설정하고 시작하기' : 'Set Password & Start')}
                  </button>
                </form>
              </>
            )}
          </div>

          {step === 'email' && (
            <div className="mt-5 text-center space-y-2">
              <p className="text-gray-500 text-sm">
                {ko ? '계정이 없으신가요?' : "Don't have an account?"}
                {' '}
                <Link href="/register" className="text-green-400 font-medium hover:text-green-300 transition">
                  {ko ? '회원가입' : 'Sign Up'}
                </Link>
              </p>
              <p>
                <Link href="/club-register" className="text-xs text-gray-600 hover:text-green-500 transition">
                  {ko ? '+ 새 클럽 등록' : '+ Register New Club'}
                </Link>
              </p>
            </div>
          )}

          <div className="mt-4 text-center">
            <Link href="/install"
              className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-500 transition border border-green-900/60 rounded-full px-3 py-1.5">
              📲 {ko ? '앱 설치 방법' : 'Install App'}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-6 text-center">
        <p className="text-gray-700 text-xs">Inter Stellar GOLF v1.0.0</p>
      </div>
    </div>
  )
}
