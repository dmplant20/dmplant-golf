'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Eye, EyeOff } from 'lucide-react'

// 자동 채우기 — 로컬 스토리지 키 (개인 기기 PWA 가정)
// 비밀번호는 btoa 로 미세 난독화. 진짜 암호화는 아니지만, 회원이 같은 기기에서
// 매번 타이핑하지 않게 하려는 목적. 공용 기기에서는 위험할 수 있음을 사용자가 인지.
const LS_EMAIL = 'isgolf-saved-email'
const LS_PW    = 'isgolf-saved-pw'

function readSaved() {
  if (typeof window === 'undefined') return { email: '', password: '' }
  try {
    const e = localStorage.getItem(LS_EMAIL) ?? ''
    const p = localStorage.getItem(LS_PW)
    return { email: e, password: p ? atob(p) : '' }
  } catch { return { email: '', password: '' } }
}
function saveCreds(email: string, password: string) {
  try {
    if (email) localStorage.setItem(LS_EMAIL, email)
    if (password) localStorage.setItem(LS_PW, btoa(password))
  } catch {}
}

export default function LoginPage() {
  const router = useRouter()
  const { lang, setLang } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const ko = lang === 'ko'

  // 마운트 시 저장된 이메일·비밀번호 자동 로드
  useEffect(() => {
    const saved = readSaved()
    if (saved.email) setEmail(saved.email)
    if (saved.password) setPassword(saved.password)
  }, [])

  // 이미 로그인된 세션 있으면 대시보드로 자동 이동 (불필요한 로그인 화면 노출 방지)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    // 비밀번호가 비어있으면 → 첫 로그인 시도 (관리자 사전 등록 회원만 통과)
    if (!password) {
      try {
        const res = await fetch('/api/auth/first-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.already_set
            ? (ko ? '이미 비밀번호가 설정된 계정입니다. 비밀번호를 입력해 주세요.' : 'Password already set. Please enter your password.')
            : (data.error ?? (ko ? '첫 로그인 실패' : 'First-login failed')))
          setLoading(false); return
        }
        // 받은 hashed_token 으로 OTP 검증 → 세션 획득
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash, type: 'magiclink',
        })
        if (otpErr) {
          setError(ko ? '인증 실패: ' + otpErr.message : 'Verification failed: ' + otpErr.message)
          setLoading(false); return
        }
        saveCreds(email, '')  // 첫 로그인은 비밀번호 없으니 이메일만 저장
        router.push('/dashboard')
        return
      } catch (err: any) {
        setError(ko ? '오류: ' + (err?.message ?? '') : 'Error: ' + (err?.message ?? ''))
        setLoading(false); return
      }
    }

    // 비밀번호가 있으면 → 일반 로그인
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(ko ? '이메일 또는 비밀번호가 올바르지 않습니다.' : 'Invalid email or password.')
      setLoading(false)
    } else {
      // 다음 로그인부터 자동 채우기 — 같은 기기에서는 클릭 한 번으로 입장
      saveCreds(email, password)
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
                    autoComplete="current-password"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition placeholder-gray-600"
                    placeholder={ko ? '처음이면 비워두세요' : 'Leave blank if first login'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition"
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
                disabled={loading || !email}
                className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-lg shadow-green-900/30"
              >
                {loading
                  ? (ko ? '로그인 중...' : 'Signing in...')
                  : (ko ? '로그인' : 'Sign In')}
              </button>
              <p className="text-[11px] text-center" style={{ color: '#86efac' }}>
                {ko
                  ? '✨ 처음이면 비밀번호 비워두고 로그인 → 화면에서 비밀번호 등록'
                  : '✨ First time? Leave password blank → set password on screen'}
              </p>
            </form>

            <div className="mt-4 text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-gray-400 hover:text-green-400 transition"
              >
                {ko ? '비밀번호를 잊으셨나요?' : 'Forgot password?'}
              </Link>
            </div>
          </div>

          {/* 회원가입 링크 */}
          <div className="mt-5 text-center space-y-2">
            <p className="text-gray-400 text-sm">
              {ko ? '계정이 없으신가요?' : "Don't have an account?"}
              {' '}
              <Link href="/register" className="text-green-400 font-medium hover:text-green-300 transition">
                {ko ? '회원가입' : 'Sign Up'}
              </Link>
            </p>
            <p>
              <Link href="/club-register" className="text-xs text-gray-400 hover:text-green-500 transition">
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
        <p className="text-gray-400 text-xs">Inter Stellar GOLF v1.0.0</p>
      </div>
    </div>
  )
}
