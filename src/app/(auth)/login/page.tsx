'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const router = useRouter()
  const { lang, setLang } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Lang toggle */}
      <button
        onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
        className="absolute top-4 right-4 text-xs text-green-400 border border-green-800 rounded-full px-3 py-1"
      >
        {lang === 'ko' ? 'EN' : '한국어'}
      </button>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⛳</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Inter Stellar GOLF</h1>
        <p className="text-green-400 text-sm mt-1">{ko ? '골프 모임 관리' : 'Golf Club Management'}</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-semibold text-white mb-6">{ko ? '로그인' : 'Sign In'}</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{ko ? '이메일' : 'Email'}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition"
              placeholder="golf@email.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{ko ? '비밀번호' : 'Password'}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? (ko ? '로그인 중...' : 'Signing in...') : (ko ? '로그인' : 'Sign In')}
          </button>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-green-400 transition">
              {ko ? '비밀번호를 잊으셨나요?' : 'Forgot password?'}
            </Link>
          </div>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-gray-500 text-sm">
            {ko ? '계정이 없으신가요?' : "Don't have an account?"}{' '}
            <Link href="/register" className="text-green-400 hover:underline">
              {ko ? '회원가입' : 'Sign Up'}
            </Link>
          </p>
          <p className="text-gray-600 text-sm">
            <Link href="/club-register" className="text-green-600 hover:underline">
              {ko ? '새 클럽 등록' : 'Register New Club'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
