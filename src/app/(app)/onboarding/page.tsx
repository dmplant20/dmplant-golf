'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Plus, Search, ChevronRight, Users } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const { lang, user, setMyClubs, setCurrentClub } = useAuthStore()
  const ko = lang === 'ko'

  const [tab, setTab] = useState<'create' | 'join'>('create')

  // Create club form
  const [createForm, setCreateForm] = useState({ name: '', nameEn: '', currency: 'KRW' })
  const [creating, setCreating] = useState(false)

  // Join club
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [applied, setApplied] = useState<string[]>([])

  async function handleCreateClub(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name || !user) return
    setCreating(true)
    const supabase = createClient()
    const { data: club, error } = await supabase.from('clubs').insert({
      name: createForm.name,
      name_en: createForm.nameEn || null,
      currency: createForm.currency,
      created_by: user.id,
    }).select().single()

    if (error || !club) { setCreating(false); return }

    await supabase.from('club_memberships').insert({
      club_id: club.id, user_id: user.id,
      role: 'president', status: 'approved',
      joined_at: new Date().toISOString(),
    })

    setMyClubs([{ id: club.id, name: club.name, name_en: club.name_en, role: 'president' }])
    setCurrentClub(club.id)
    router.push('/dashboard')
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('clubs')
      .select('id, name, name_en')
      .ilike('name', `%${searchQuery}%`)
      .limit(10)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function handleApply(clubId: string) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('club_memberships').upsert({
      club_id: clubId, user_id: user.id,
      role: 'member', status: 'pending',
    }, { onConflict: 'club_id,user_id' })
    setApplied((prev) => [...prev, clubId])
  }

  const currencies = [
    { value: 'KRW', label: '원 (₩)' },
    { value: 'VND', label: '동 (₫)' },
    { value: 'IDR', label: '루피아 (Rp)' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">⛳</span>
          </div>
          <h1 className="text-xl font-bold text-white">{ko ? '시작하기' : 'Get Started'}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {ko ? '클럽을 만들거나 기존 클럽에 가입하세요' : 'Create a club or join an existing one'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('create')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'create' ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400'}`}>
            {ko ? '클럽 만들기' : 'Create Club'}
          </button>
          <button onClick={() => setTab('join')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${tab === 'join' ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400'}`}>
            {ko ? '클럽 가입하기' : 'Join Club'}
          </button>
        </div>

        {/* Create Club */}
        {tab === 'create' && (
          <form onSubmit={handleCreateClub} className="space-y-4">
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽 이름 *' : 'Club Name *'}</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  placeholder={ko ? '예: MGF 골프회' : 'e.g. MGF Golf Club'}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{ko ? '클럽 이름 (영문)' : 'Club Name (English)'}</label>
                <input
                  value={createForm.nameEn}
                  onChange={(e) => setCreateForm((f) => ({ ...f, nameEn: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                  placeholder="MGF Golf Club"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{ko ? '통화' : 'Currency'}</label>
                <select
                  value={createForm.currency}
                  onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                  {currencies.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
              <p className="text-green-300 text-xs">
                {ko
                  ? '✓ 클럽을 만들면 자동으로 회장으로 등록됩니다. 이후 다른 회원들이 가입신청하면 승인할 수 있습니다.'
                  : '✓ You will be registered as president. Other members can apply to join and you can approve them.'}
              </p>
            </div>

            <button type="submit" disabled={creating}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
              <Plus size={18} />
              {creating ? (ko ? '생성 중...' : 'Creating...') : (ko ? '클럽 만들기' : 'Create Club')}
            </button>
          </form>
        )}

        {/* Join Club */}
        {tab === 'join' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-gray-400 text-xs mb-3">
                {ko
                  ? '클럽 이름을 검색해서 가입 신청을 보내세요. 회장/총무가 승인하면 가입됩니다.'
                  : 'Search for a club and apply. President/Secretary will approve your request.'}
              </p>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={ko ? '클럽 이름 검색...' : 'Search club name...'}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
                <button onClick={handleSearch} disabled={searching}
                  className="bg-green-700 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
                  <Search size={16} />
                </button>
              </div>
            </div>

            {searching && (
              <p className="text-center text-gray-500 text-sm">{ko ? '검색 중...' : 'Searching...'}</p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((club) => {
                  const isApplied = applied.includes(club.id)
                  return (
                    <div key={club.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center text-lg flex-shrink-0">⛳</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{lang === 'ko' ? club.name : (club.name_en || club.name)}</p>
                        <p className="text-gray-500 text-xs">{ko ? '가입 신청 후 승인 대기' : 'Apply and wait for approval'}</p>
                      </div>
                      <button
                        onClick={() => handleApply(club.id)}
                        disabled={isApplied}
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition ${isApplied ? 'bg-gray-700 text-gray-500' : 'bg-green-700 hover:bg-green-600 text-white'}`}>
                        {isApplied ? (ko ? '신청완료' : 'Applied') : (ko ? '가입신청' : 'Apply')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <div className="text-center py-6 space-y-2">
                <Users size={32} className="text-gray-700 mx-auto" />
                <p className="text-gray-500 text-sm">{ko ? '검색 결과가 없습니다' : 'No clubs found'}</p>
                <button onClick={() => setTab('create')} className="text-green-400 text-sm hover:underline">
                  {ko ? '새 클럽 만들기 →' : 'Create a new club →'}
                </button>
              </div>
            )}

            {applied.length > 0 && (
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-3">
                <p className="text-green-300 text-xs">
                  {ko
                    ? '✓ 가입 신청이 완료됐습니다. 회장/총무가 승인하면 알림이 옵니다.'
                    : '✓ Application sent. You\'ll be notified when approved.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
