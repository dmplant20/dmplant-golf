'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { UserCheck, Clock, UserX, ChevronRight, Edit2 } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  president: 'bg-yellow-900/60 text-yellow-300',
  secretary: 'bg-blue-900/60 text-blue-300',
  officer: 'bg-purple-900/60 text-purple-300',
  member: 'bg-gray-800 text-gray-300',
}

export default function MembersPage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [tab, setTab] = useState<'approved' | 'pending'>('approved')
  const [members, setMembers] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [editMember, setEditMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: approved }, { data: pend }] = await Promise.all([
      supabase.from('club_memberships')
        .select('*, users(full_name, full_name_en, name_abbr, avatar_url, phone)')
        .eq('club_id', currentClubId).eq('status', 'approved')
        .order('role'),
      supabase.from('club_memberships')
        .select('*, users(full_name, full_name_en, name_abbr, phone)')
        .eq('club_id', currentClubId).eq('status', 'pending'),
    ])
    setMembers(approved ?? [])
    setPending(pend ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  async function approve(membershipId: string) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({ status: 'approved', joined_at: new Date().toISOString() }).eq('id', membershipId)
    load()
  }

  async function reject(membershipId: string) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({ status: 'rejected' }).eq('id', membershipId)
    load()
  }

  async function updateHandicap(membershipId: string, clubHc: number, personalHc: number, role: string) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({ club_handicap: clubHc, personal_handicap: personalHc, role }).eq('id', membershipId)
    setEditMember(null)
    load()
  }

  const roleLabel = (r: string) => {
    const map: Record<string, [string, string]> = {
      president: ['회장', 'President'], secretary: ['총무', 'Secretary'],
      officer: ['운영진', 'Officer'], member: ['회원', 'Member'],
    }
    return ko ? map[r]?.[0] : map[r]?.[1]
  }

  return (
    <div className="px-4 py-5">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['approved', 'pending'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400'}`}>
            {t === 'approved' ? (ko ? '회원' : 'Members') : (ko ? `가입 대기 (${pending.length})` : `Pending (${pending.length})`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">{ko ? '로딩 중...' : 'Loading...'}</div>
      ) : tab === 'approved' ? (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                {m.users?.avatar_url ? <img src={m.users.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium text-sm">{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</span>
                  {m.users?.name_abbr && <span className="text-xs text-gray-500">({m.users.name_abbr})</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>{roleLabel(m.role)}</span>
                  {m.club_handicap != null && <span className="text-xs text-green-400">{ko ? '클럽핸디' : 'Club HC'}: {m.club_handicap}</span>}
                  {m.personal_handicap != null && <span className="text-xs text-blue-400">{ko ? '개인핸디' : 'Personal HC'}: {m.personal_handicap}</span>}
                </div>
              </div>
              {canManage && (
                <button onClick={() => setEditMember(m)} className="text-gray-500 hover:text-green-400 transition flex-shrink-0">
                  <Edit2 size={16} />
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && <p className="text-center text-gray-600 py-8">{ko ? '회원이 없습니다' : 'No members'}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((m) => (
            <div key={m.id} className="glass-card rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-lg">👤</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</p>
                  {m.users?.phone && <p className="text-gray-500 text-xs">{m.users.phone}</p>}
                </div>
                {canManage && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => approve(m.id)} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg transition">
                      {ko ? '승인' : 'Approve'}
                    </button>
                    <button onClick={() => reject(m.id)} className="bg-gray-800 hover:bg-red-900/50 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition">
                      {ko ? '거부' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-center text-gray-600 py-8">{ko ? '대기 중인 가입 신청이 없습니다' : 'No pending requests'}</p>}
        </div>
      )}

      {/* Edit Modal */}
      {editMember && (
        <EditMemberModal member={editMember} ko={ko} onClose={() => setEditMember(null)} onSave={updateHandicap} />
      )}
    </div>
  )
}

function EditMemberModal({ member, ko, onClose, onSave }: any) {
  const [clubHc, setClubHc] = useState(member.club_handicap ?? '')
  const [personalHc, setPersonalHc] = useState(member.personal_handicap ?? '')
  const [role, setRole] = useState(member.role)
  const roles = [
    { value: 'president', ko: '회장', en: 'President' },
    { value: 'secretary', ko: '총무', en: 'Secretary' },
    { value: 'officer', ko: '운영진', en: 'Officer' },
    { value: 'member', ko: '회원', en: 'Member' },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl p-6 w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">
          {member.users?.full_name} {ko ? '수정' : 'Edit'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">{ko ? '역할' : 'Role'}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
              {roles.map((r) => <option key={r.value} value={r.value}>{ko ? r.ko : r.en}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">{ko ? '클럽 핸디' : 'Club Handicap'}</label>
            <input type="number" step="0.1" value={clubHc} onChange={(e) => setClubHc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" placeholder="0.0" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">{ko ? '개인 핸디' : 'Personal Handicap'}</label>
            <input type="number" step="0.1" value={personalHc} onChange={(e) => setPersonalHc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" placeholder="0.0" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={() => onSave(member.id, parseFloat(clubHc) || 0, parseFloat(personalHc) || 0, role)}
              className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">{ko ? '저장' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
