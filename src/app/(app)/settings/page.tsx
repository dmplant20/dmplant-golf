'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Settings, Save, ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const { currentClubId, lang, myClubs, setMyClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [club, setClub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    name: '',
    name_en: '',
    currency: 'KRW',
    annual_fee: '',
    monthly_fee: '',
  })

  useEffect(() => {
    if (!currentClubId) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.from('clubs').select('*').eq('id', currentClubId).single()
      if (data) {
        setClub(data)
        setForm({
          name: data.name ?? '',
          name_en: data.name_en ?? '',
          currency: data.currency ?? 'KRW',
          annual_fee: data.annual_fee != null ? String(data.annual_fee) : '',
          monthly_fee: data.monthly_fee != null ? String(data.monthly_fee) : '',
        })
      }
      setLoading(false)
    }
    load()
  }, [currentClubId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!currentClubId || !canManage) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('clubs').update({
      name: form.name,
      name_en: form.name_en || null,
      currency: form.currency,
      annual_fee: form.annual_fee ? parseInt(form.annual_fee) : null,
      monthly_fee: form.monthly_fee ? parseInt(form.monthly_fee) : null,
    }).eq('id', currentClubId)

    // Update club name in local store
    setMyClubs(myClubs.map((c) =>
      c.id === currentClubId ? { ...c, name: form.name, name_en: form.name_en } : c
    ))

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const currencies = [
    { value: 'KRW', label: '원 (₩) - KRW' },
    { value: 'VND', label: '동 (₫) - VND' },
    { value: 'IDR', label: '루피아 (Rp) - IDR' },
  ]

  const currSymbol = form.currency === 'KRW' ? '₩' : form.currency === 'VND' ? '₫' : 'Rp'

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <p className="text-gray-500">{ko ? '로딩 중...' : 'Loading...'}</p>
    </div>
  )

  return (
    <div className="px-4 py-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-green-400" />
          <h1 className="text-lg font-bold text-white">{ko ? '클럽 설정' : 'Club Settings'}</h1>
        </div>
      </div>

      {!canManage ? (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-gray-400 text-sm">
            {ko ? '회장 또는 총무만 클럽 설정을 변경할 수 있습니다.' : 'Only president or secretary can modify club settings.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Club Info */}
          <div className="glass-card rounded-2xl p-4 space-y-4">
            <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
              {ko ? '클럽 정보' : 'Club Info'}
            </h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽명 (한글) *' : 'Club Name *'}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽명 (영문)' : 'Club Name (English)'}</label>
              <input
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{ko ? '통화' : 'Currency'}</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Fee Settings */}
          <div className="glass-card rounded-2xl p-4 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
                {ko ? '회비 설정' : 'Fee Settings'}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {ko
                  ? '년회비와 월회비를 모두 설정할 수 있습니다. 회원별로 회비 유형을 따로 지정하세요.'
                  : 'Set both annual and monthly fee amounts. Assign fee type per member individually.'}
              </p>
            </div>

            {/* Annual Fee */}
            <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <span className="text-sm font-medium text-white">{ko ? '년회비' : 'Annual Fee'}</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currSymbol}</span>
                <input
                  type="number"
                  min="0"
                  value={form.annual_fee}
                  onChange={(e) => setForm((f) => ({ ...f, annual_fee: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-600">
                {ko ? '설정하지 않으면 년회비를 사용하지 않습니다.' : 'Leave empty to disable annual fees.'}
              </p>
            </div>

            {/* Monthly Fee */}
            <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-sm font-medium text-white">{ko ? '월회비' : 'Monthly Fee'}</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currSymbol}</span>
                <input
                  type="number"
                  min="0"
                  value={form.monthly_fee}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none focus:border-green-500"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-600">
                {ko ? '설정하지 않으면 월회비를 사용하지 않습니다.' : 'Leave empty to disable monthly fees.'}
              </p>
            </div>

            {/* Preview */}
            {(form.annual_fee || form.monthly_fee) && (
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3 space-y-1">
                {form.annual_fee && (
                  <p className="text-xs text-green-300">
                    {ko ? '년회비' : 'Annual'}: {currSymbol}{parseInt(form.annual_fee).toLocaleString()}
                  </p>
                )}
                {form.monthly_fee && (
                  <p className="text-xs text-green-300">
                    {ko ? '월회비' : 'Monthly'}: {currSymbol}{parseInt(form.monthly_fee).toLocaleString()}
                    {ko ? ' (연간 ' : ' ('}
                    {currSymbol}{(parseInt(form.monthly_fee) * 12).toLocaleString()}
                    {ko ? ')' : '/yr)'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
            <Save size={18} />
            {saving
              ? (ko ? '저장 중...' : 'Saving...')
              : saved
                ? (ko ? '✓ 저장됨' : '✓ Saved')
                : (ko ? '설정 저장' : 'Save Settings')}
          </button>
        </form>
      )}

      {/* Club info display for non-managers */}
      {!canManage && club && (
        <div className="mt-4 glass-card rounded-2xl p-4 space-y-3">
          <p className="text-sm text-gray-400">{ko ? '클럽명' : 'Club'}: <span className="text-white">{club.name}</span></p>
          {club.annual_fee && (
            <p className="text-sm text-gray-400">{ko ? '년회비' : 'Annual Fee'}: <span className="text-yellow-300">{currSymbol}{club.annual_fee.toLocaleString()}</span></p>
          )}
          {club.monthly_fee && (
            <p className="text-sm text-gray-400">{ko ? '월회비' : 'Monthly Fee'}: <span className="text-blue-300">{currSymbol}{club.monthly_fee.toLocaleString()}</span></p>
          )}
        </div>
      )}
    </div>
  )
}
