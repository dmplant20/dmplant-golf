'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export default function RegisterPage() {
  const router = useRouter()
  const { lang } = useAuthStore()
  const ko = lang === 'ko'

  const [form, setForm] = useState({
    email: '', password: '', fullName: '', fullNameEn: '', nameAbbr: '', phone: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          full_name_en: form.fullNameEn,
          name_abbr: form.nameAbbr.toUpperCase(),
          phone: form.phone,
        }
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.fullName,
        full_name_en: form.fullNameEn || null,
        name_abbr: form.nameAbbr.toUpperCase() || null,
        phone: form.phone || null,
      }, { onConflict: 'id' })
    }
    router.push('/dashboard')
  }

  const fields = [
    { key: 'email', label: ko ? '이메일' : 'Email', type: 'email', placeholder: 'golf@email.com' },
    { key: 'password', label: ko ? '비밀번호' : 'Password', type: 'password', placeholder: '••••••••' },
    { key: 'fullName', label: ko ? '이름 (한글)' : 'Full Name (Korean)', type: 'text', placeholder: '홍길동' },
    { key: 'fullNameEn', label: ko ? '이름 (영문)' : 'Full Name (English)', type: 'text', placeholder: 'Hong Gil Dong' },
    { key: 'nameAbbr', label: ko ? '영문 약자' : 'Name Abbr.', type: 'text', placeholder: 'HGD' },
    { key: 'phone', label: ko ? '전화번호' : 'Phone', type: 'tel', placeholder: '+82 10-0000-0000' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xl">⛳</span>
          </div>
          <h1 className="text-lg font-bold text-white">Inter Stellar GOLF</h1>
        </div>

        <h2 className="text-xl font-semibold text-white mb-5">{ko ? '계정 만들기' : 'Create Account'}</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => update(f.key, e.target.value)}
                required={['email', 'password', 'fullName'].includes(f.key)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition"
                placeholder={f.placeholder}
                maxLength={f.key === 'nameAbbr' ? 5 : undefined}
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? (ko ? '가입 중...' : 'Signing up...') : (ko ? '회원가입' : 'Sign Up')}
          </button>
        </form>

        <p className="mt-5 text-center text-gray-500 text-sm">
          {ko ? '이미 계정이 있으신가요?' : 'Already have an account?'}{' '}
          <Link href="/login" className="text-green-400 hover:underline">{ko ? '로그인' : 'Sign In'}</Link>
        </p>
      </div>
    </div>
  )
}
