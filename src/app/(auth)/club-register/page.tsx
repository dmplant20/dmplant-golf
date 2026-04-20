'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'

export default function ClubRegisterPage() {
  const router = useRouter()
  const { lang } = useAuthStore()
  const ko = lang === 'ko'

  const [form, setForm] = useState({ name: '', nameEn: '', currency: 'KRW' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: club, error: clubError } = await supabase.from('clubs').insert({
      name: form.name,
      name_en: form.nameEn || null,
      currency: form.currency,
      created_by: user.id,
    }).select().single()

    if (clubError) { setError(clubError.message); setLoading(false); return }

    await supabase.from('club_memberships').insert({
      club_id: club.id, user_id: user.id, role: 'president', status: 'approved', joined_at: new Date().toISOString()
    })

    router.push('/dashboard')
  }

  const currencies = [
    { value: 'KRW', label: '원 (₩) - KRW' },
    { value: 'VND', label: '동 (₫) - VND' },
    { value: 'IDR', label: '루피아 (Rp) - IDR' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-2 text-xl">⛳</div>
          <h1 className="text-lg font-bold text-white">Inter Stellar GOLF</h1>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">{ko ? '새 클럽 등록' : 'Register New Club'}</h2>
        <p className="text-gray-500 text-xs mb-5">
          {ko
            ? '회비 금액은 로그인 후 클럽 설정에서 회장/총무가 지정할 수 있습니다.'
            : 'Fee amounts can be set by president/secretary in Club Settings after login.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽명 (한글) *' : 'Club Name *'}</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              placeholder={ko ? '예: MGF 골프회' : 'e.g. MGF Golf Club'}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽명 (영문)' : 'Club Name (English)'}</label>
            <input
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              placeholder="MGF Golf Club"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">{ko ? '통화' : 'Currency'}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white">
              {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition">
            {loading ? (ko ? '등록 중...' : 'Registering...') : (ko ? '클럽 등록' : 'Register Club')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-600">
          {ko ? '클럽을 등록하면 자동으로 회장으로 등록됩니다' : 'You will be registered as president upon club creation'}
        </p>
      </div>
    </div>
  )
}
