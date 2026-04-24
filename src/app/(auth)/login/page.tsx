'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { lang, setLang } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const ko = lang === 'ko'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(ko ? '이메일 또는 비밀번호가 올바르지 않습니다.' : 'Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 배경 장식 */}
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

      {/* 메인 컨텐츠 */}
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
            Inter Stellar
            <span className="text-green-400"> GOLF</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1.5">
            {ko ? '골프 모임 관리' : 'Golf Club Management'}
          </p>
        </div>

        {/* 폼 카드 */}
        <div className="w-full max-w-sm">
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5">
              {ko ? '로그인' : 'Sign In'}
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* 이메일 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  {ko ? '이메일' : 'Email'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
                  placeholder="golf@email.com"
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  {ko ? '비밀번호' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
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

              {error && (
                <div className="bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-2.5">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-lg shadow-green-900/30"
              >
                {loading
                  ? (ko ? '로그인 중...' : 'Signing in...')
                  : (ko ? '로그인' : 'Sign In')}
              </button>
            </form>

            <div className="mt-4 text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-gray-500 hover:text-green-400 transition"
              >
                {ko ? '비밀번호를 잊으셨나요?' : 'Forgot password?'}
              </Link>
            </div>
          </div>

          {/* 회원가입 링크 */}
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

          {/* 앱 설치 안내 */}
          <div className="mt-4 text-center">
            <Link href="/install"
              className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-500 transition border border-green-900/60 rounded-full px-3 py-1.5">
              📲 {ko ? '앱 설치 방법' : 'Install App'}
            </Link>
          </div>
        </div>
      </div>

      {/* 하단 */}
      <div className="relative z-10 pb-6 text-center">
        <p className="text-gray-700 text-xs">Inter Stellar GOLF v1.0.0</p>
      </div>
    </div>
  )
}
