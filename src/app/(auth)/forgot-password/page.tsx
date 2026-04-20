'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const { lang } = useAuthStore()
  const ko = lang === 'ko'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(ko ? '이메일 전송에 실패했습니다.' : 'Failed to send email.')
    } else {
      setSent(true)
    }
    setLoading(false)
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

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto">
              <Mail size={28} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {ko ? '이메일을 확인하세요' : 'Check your email'}
            </h2>
            <p className="text-gray-400 text-sm">
              {ko
                ? `${email} 으로 비밀번호 재설정 링크를 보냈습니다.`
                : `We sent a password reset link to ${email}`}
            </p>
            <p className="text-gray-600 text-xs">
              {ko ? '이메일이 안 보이면 스팸함을 확인하세요.' : 'Check your spam folder if you don\'t see it.'}
            </p>
            <Link href="/login" className="block mt-6 text-green-400 text-sm hover:underline">
              {ko ? '로그인으로 돌아가기' : 'Back to login'}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Link href="/login" className="flex items-center gap-1 text-gray-400 text-sm hover:text-green-400 transition">
                <ArrowLeft size={16} /> {ko ? '로그인으로' : 'Back to login'}
              </Link>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {ko ? '비밀번호 찾기' : 'Forgot Password'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {ko
                ? '가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.'
                : 'Enter your email and we\'ll send you a reset link.'}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
              >
                {loading
                  ? (ko ? '전송 중...' : 'Sending...')
                  : (ko ? '재설정 링크 보내기' : 'Send Reset Link')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
