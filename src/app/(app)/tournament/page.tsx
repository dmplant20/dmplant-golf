'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Trophy, Plus, Camera, Users, ChevronRight, Star } from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'

export default function TournamentPage() {
  const { currentClubId, user, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = OFFICER_ROLES.includes(myRole)

  const [tab, setTab] = useState<'list' | 'ranking'>('list')
  const [tournaments, setTournaments] = useState<any[]>([])
  const [rankings, setRankings] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTournament, setSelectedTournament] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ name: '', nameEn: '', date: '', venue: '', isOfficial: false, groupingMethod: 'auto_handicap' })

  async function load() {
    if (!currentClubId) return
    const supabase = createClient()
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('club_id', currentClubId).order('date', { ascending: false }),
      supabase.from('monthly_rankings').select('*, users(full_name, full_name_en)')
        .eq('club_id', currentClubId)
        .order('year', { ascending: false }).order('month', { ascending: false }).order('rank'),
    ])
    setTournaments(t ?? [])
    setRankings(r ?? [])
  }

  async function loadGroups(tournamentId: string) {
    const supabase = createClient()
    const { data } = await supabase.from('tournament_groups')
      .select('*, tournament_group_members(*, users(full_name, full_name_en, name_abbr))')
      .eq('tournament_id', tournamentId).order('group_number')
    setGroups(data ?? [])
  }

  useEffect(() => { load() }, [currentClubId])
  useEffect(() => { if (selectedTournament) loadGroups(selectedTournament.id) }, [selectedTournament])

  async function createTournament() {
    if (!form.name || !form.date) return
    const supabase = createClient()
    const { data } = await supabase.from('tournaments').insert({
      club_id: currentClubId, name: form.name, name_en: form.nameEn,
      date: form.date, venue: form.venue, is_official: form.isOfficial,
      grouping_method: form.groupingMethod, created_by: user!.id,
    }).select().single()
    setShowCreate(false)
    if (data && form.groupingMethod !== 'manual') await autoGroup(data.id, form.groupingMethod)
    load()
  }

  async function autoGroup(tournamentId: string, method: string) {
    const supabase = createClient()
    const { data: mems } = await supabase.from('club_memberships')
      .select('user_id, club_handicap, personal_handicap')
      .eq('club_id', currentClubId).eq('status', 'approved')

    if (!mems || mems.length === 0) return

    let sorted = [...mems]
    if (method === 'auto_handicap') {
      sorted.sort((a, b) => (a.club_handicap ?? 99) - (b.club_handicap ?? 99))
    } else {
      sorted.sort(() => Math.random() - 0.5)
    }

    const groupSize = 4
    const groupCount = Math.ceil(sorted.length / groupSize)
    for (let g = 0; g < groupCount; g++) {
      const { data: group } = await supabase.from('tournament_groups')
        .insert({ tournament_id: tournamentId, group_number: g + 1 }).select().single()
      if (!group) continue
      const slice = sorted.slice(g * groupSize, (g + 1) * groupSize)
      await supabase.from('tournament_group_members').insert(
        slice.map((m) => ({ group_id: group.id, user_id: m.user_id, handicap_used: m.club_handicap }))
      )
    }
  }

  async function updateScore(memberId: string, score: number, handicap: number) {
    const supabase = createClient()
    await supabase.from('tournament_group_members').update({
      score, net_score: score - handicap
    }).eq('id', memberId)
    if (selectedTournament) loadGroups(selectedTournament.id)
  }

  async function handleScorecardScan(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedTournament) return
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true)
    const supabase = createClient()
    const { data: mems } = await supabase.from('club_memberships')
      .select('user_id, users(full_name, full_name_en, name_abbr)')
      .eq('club_id', currentClubId).eq('status', 'approved')

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const res = await fetch('/api/ocr/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, members: mems?.map((m: any) => ({ ...m.users, user_id: m.user_id })), lang }),
      })
      const data = await res.json()
      // Handle ambiguous abbreviations via UI prompt
      // For now, auto-assign matched ones
      for (const s of (data.scores ?? [])) {
        if (s.user_id && s.score) {
          // Find group member
          const allGroupMembers = groups.flatMap((g) => g.tournament_group_members)
          const gm = allGroupMembers.find((m: any) => m.user_id === s.user_id)
          if (gm) await supabase.from('tournament_group_members').update({ score: s.score, net_score: s.score - (gm.handicap_used ?? 0) }).eq('id', gm.id)
        }
      }
      loadGroups(selectedTournament.id)
      setOcrLoading(false)
    }
    reader.readAsDataURL(file)
  }

  const statusLabel = (s: string) => {
    const m: Record<string, [string, string]> = { upcoming: ['예정', 'Upcoming'], ongoing: ['진행중', 'Ongoing'], completed: ['완료', 'Completed'] }
    return ko ? m[s]?.[0] : m[s]?.[1]
  }
  const statusColor = (s: string) => ({ upcoming: 'text-blue-400', ongoing: 'text-yellow-400', completed: 'text-gray-400' }[s] ?? 'text-gray-400')

  return (
    <div className="px-4 py-5">
      <div className="flex gap-2 mb-5">
        {(['list', 'ranking'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setSelectedTournament(null) }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400'}`}>
            {t === 'list' ? (ko ? '대회 목록' : 'Tournaments') : (ko ? '순위/기록' : 'Rankings')}
          </button>
        ))}
      </div>

      {tab === 'list' && !selectedTournament && (
        <>
          {canManage && (
            <button onClick={() => setShowCreate(true)} className="w-full flex items-center justify-center gap-2 bg-green-700/20 border border-green-800 text-green-400 py-2.5 rounded-xl text-sm mb-4">
              <Plus size={16} /> {ko ? '대회 생성' : 'Create Tournament'}
            </button>
          )}
          <div className="space-y-2">
            {tournaments.map((t) => (
              <button key={t.id} onClick={() => setSelectedTournament(t)} className="w-full glass-card rounded-xl px-4 py-3 flex items-center gap-3 text-left">
                <Trophy size={20} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm">{lang === 'ko' ? t.name : (t.name_en || t.name)}</p>
                    {t.is_official && <Star size={12} className="text-yellow-400" />}
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <span className={`text-xs ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                    <span className="text-xs text-gray-500">{t.date}</span>
                    {t.venue && <span className="text-xs text-gray-500">· {t.venue}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
              </button>
            ))}
            {tournaments.length === 0 && <p className="text-center text-gray-600 py-8">{ko ? '등록된 대회가 없습니다' : 'No tournaments'}</p>}
          </div>
        </>
      )}

      {tab === 'list' && selectedTournament && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setSelectedTournament(null)} className="text-green-400 text-sm">← {ko ? '목록' : 'Back'}</button>
            <h2 className="text-white font-bold">{lang === 'ko' ? selectedTournament.name : (selectedTournament.name_en || selectedTournament.name)}</h2>
          </div>
          {canManage && (
            <button onClick={() => fileRef.current?.click()} disabled={ocrLoading}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 text-gray-200 py-2.5 rounded-xl text-sm mb-4">
              <Camera size={16} /> {ocrLoading ? (ko ? '분석 중...' : 'Scanning...') : (ko ? '스코어카드 촬영' : 'Scan Scorecard')}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScorecardScan} />

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-green-400" />
                  <span className="text-green-400 text-sm font-medium">{ko ? `${g.group_number}조` : `Group ${g.group_number}`}</span>
                  {g.tee_time && <span className="text-gray-500 text-xs">{g.tee_time}</span>}
                </div>
                <div className="space-y-1.5">
                  {g.tournament_group_members?.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="text-white text-sm flex-1">{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</span>
                      {m.handicap_used != null && <span className="text-xs text-gray-500">HC:{m.handicap_used}</span>}
                      {canManage ? (
                        <input type="number" defaultValue={m.score ?? ''} onBlur={(e) => updateScore(m.id, parseInt(e.target.value), m.handicap_used ?? 0)}
                          className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs text-center" placeholder="Score" />
                      ) : (
                        <span className="text-green-400 text-sm font-medium w-12 text-right">{m.score ?? '-'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-center text-gray-600 py-4">{ko ? '조편성이 없습니다' : 'No groups formed'}</p>}
          </div>
        </div>
      )}

      {tab === 'ranking' && (
        <div className="space-y-2">
          {rankings.length === 0 ? (
            <p className="text-center text-gray-600 py-8">{ko ? '순위 기록이 없습니다' : 'No ranking data'}</p>
          ) : (
            (() => {
              const grouped: Record<string, any[]> = {}
              rankings.forEach((r) => { const key = `${r.year}-${String(r.month).padStart(2, '0')}`; if (!grouped[key]) grouped[key] = []; grouped[key].push(r) })
              return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([key, recs]) => (
                <div key={key}>
                  <p className="text-green-400 text-xs font-medium mb-2">{key.replace('-', ko ? '년 ' : '-')}{ko ? '월' : ''}</p>
                  {recs.map((r, i) => (
                    <div key={r.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 mb-1.5">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-400'}`}>{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-white text-sm">{lang === 'ko' ? r.users?.full_name : (r.users?.full_name_en || r.users?.full_name)}</p>
                        <p className="text-gray-500 text-xs">{r.tournaments_played}{ko ? '회 참가' : ' rounds'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold">{r.avg_score ?? '-'}</p>
                        <p className="text-gray-600 text-xs">{ko ? '평균' : 'avg'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            })()
          )}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">{ko ? '대회 생성' : 'Create Tournament'}</h3>
            {[
              { key: 'name', label: ko ? '대회명 (한글)' : 'Name (Korean)', type: 'text' },
              { key: 'nameEn', label: ko ? '대회명 (영문)' : 'Name (English)', type: 'text' },
              { key: 'date', label: ko ? '날짜' : 'Date', type: 'date' },
              { key: 'venue', label: ko ? '장소' : 'Venue', type: 'text' },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-sm text-gray-400 block mb-1">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
              </div>
            ))}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '조편성 방식' : 'Grouping Method'}</label>
              <select value={form.groupingMethod} onChange={(e) => setForm((f) => ({ ...f, groupingMethod: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                <option value="auto_handicap">{ko ? '자동 (핸디순)' : 'Auto (Handicap)'}</option>
                <option value="auto_random">{ko ? '자동 (랜덤)' : 'Auto (Random)'}</option>
                <option value="manual">{ko ? '수동' : 'Manual'}</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isOfficial} onChange={(e) => setForm((f) => ({ ...f, isOfficial: e.target.checked }))
              } className="w-5 h-5 rounded accent-green-600" />
              <span className="text-sm text-gray-300">{ko ? '공식 월례회 (핸디 적용)' : 'Official Monthly (Apply Handicap)'}</span>
            </label>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={createTournament} className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">{ko ? '생성' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
