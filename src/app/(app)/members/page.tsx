'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { UserCheck, Clock, UserX, Edit2, ShieldCheck, GaugeCircle } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  president:      'bg-yellow-900/60 text-yellow-300',
  vice_president: 'bg-orange-900/60 text-orange-300',
  secretary:      'bg-blue-900/60 text-blue-300',
  auditor:        'bg-red-900/60 text-red-300',
  advisor:        'bg-teal-900/60 text-teal-300',
  officer:        'bg-purple-900/60 text-purple-300',
  member:         'bg-gray-800 text-gray-300',
}

const ROLE_MAP: Record<string, [string, string]> = {
  president:      ['회장',   'President'],
  vice_president: ['부회장', 'Vice President'],
  secretary:      ['총무',   'Secretary'],
  auditor:        ['감사',   'Auditor'],
  advisor:        ['고문',   'Advisor'],
  officer:        ['임원',   'Officer'],
  member:         ['회원',   'Member'],
}

// 임원급 이상 (회계 상세 열람 권한)
export const OFFICER_ROLES = ['president', 'vice_president', 'secretary', 'auditor', 'advisor', 'officer']

export default function MembersPage() {
  const { currentClubId, lang, myClubs, user, setMyClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myMembership = myClubs.find((c) => c.id === currentClubId)
  const myRole = myMembership?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [tab, setTab] = useState<'approved' | 'pending'>('approved')
  const [members, setMembers] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [editMember, setEditMember] = useState<any>(null)
  const [quickHcMember, setQuickHcMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [myFeeStatus, setMyFeeStatus] = useState<{
    feeType: string
    paid: boolean
    unpaidMonths: number[]
  } | null>(null)

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

    // ── 내 회비 납부 현황 (본인만 조회) ───────────────────────────────────
    if (user?.id) {
      const myMem = approved?.find((m: any) => m.user_id === user.id)
      if (myMem?.fee_type) {
        const currentYear  = new Date().getFullYear()
        const currentMonth = new Date().getMonth() + 1
        const { data: feeTxns } = await supabase
          .from('finance_transactions')
          .select('transaction_date')
          .eq('club_id', currentClubId)
          .eq('type', 'fee')
          .eq('member_id', user.id)
          .gte('transaction_date', `${currentYear}-01-01`)
          .lte('transaction_date', `${currentYear}-12-31`)

        if (myMem.fee_type === 'annual') {
          setMyFeeStatus({ feeType: 'annual', paid: (feeTxns?.length ?? 0) > 0, unpaidMonths: [] })
        } else {
          // 월납: 이번달까지 납부 안 된 달 목록
          const paidMonths = new Set(
            (feeTxns ?? []).map((t: any) => new Date(t.transaction_date).getMonth() + 1)
          )
          const unpaidMonths: number[] = []
          for (let m = 1; m <= currentMonth; m++) {
            if (!paidMonths.has(m)) unpaidMonths.push(m)
          }
          setMyFeeStatus({ feeType: 'monthly', paid: unpaidMonths.length === 0, unpaidMonths })
        }
      } else {
        setMyFeeStatus(null)
      }
    }
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

  async function updateMember(membershipId: string, clubHc: number, personalHc: number, role: string, feeType: string | null) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({
      club_handicap: clubHc,
      personal_handicap: personalHc,
      role,
      fee_type: feeType || null,
    }).eq('id', membershipId)
    setEditMember(null)
    load()
  }

  async function updateHc(membershipId: string, clubHc: number | null, personalHc: number | null) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({
      club_handicap: clubHc,
      personal_handicap: personalHc,
    }).eq('id', membershipId)
    setQuickHcMember(null)
    load()
  }

  // 현재 내 역할을 다른 회원에게 위임하고 내 역할은 임원으로 변경
  async function delegateRole(targetMembershipId: string, roleToDelegate: string, myMembershipId: string) {
    const supabase = createClient()
    await Promise.all([
      supabase.from('club_memberships').update({ role: roleToDelegate }).eq('id', targetMembershipId),
      supabase.from('club_memberships').update({ role: 'officer' }).eq('id', myMembershipId),
    ])
    // 로컬 스토어의 내 역할 업데이트
    setMyClubs(myClubs.map((c) => c.id === currentClubId ? { ...c, role: 'officer' } : c))
    setEditMember(null)
    load()
  }

  const roleLabel = (r: string) => {
    const entry = ROLE_MAP[r]
    return entry ? (ko ? entry[0] : entry[1]) : r
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
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>{roleLabel(m.role)}</span>
                  {m.fee_type === 'annual' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">{ko ? '년회비' : 'Annual'}</span>}
                  {m.fee_type === 'monthly' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">{ko ? '월회비' : 'Monthly'}</span>}
                  {m.club_handicap != null && <span className="text-xs text-green-400">{ko ? '클럽핸디' : 'Club HC'}: {m.club_handicap}</span>}
                  {m.personal_handicap != null && m.user_id === user?.id && <span className="text-xs text-blue-400">{ko ? '개인핸디' : 'Personal HC'}: {m.personal_handicap}</span>}
                  {/* 회비 납부 현황 — 본인 카드에만 표시 */}
                  {m.user_id === user?.id && myFeeStatus && (
                    myFeeStatus.paid ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 font-semibold">
                        ✓ {ko ? '납부완료' : 'Paid'}
                      </span>
                    ) : myFeeStatus.feeType === 'annual' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 font-semibold">
                        {ko ? '미납' : 'Unpaid'}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 font-semibold">
                        {myFeeStatus.unpaidMonths.length === 1
                          ? `${myFeeStatus.unpaidMonths[0]}월 미납`
                          : `${myFeeStatus.unpaidMonths.join(',')}월 미납`}
                      </span>
                    )
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setQuickHcMember(m)} title={ko ? '핸디 수정' : 'Edit handicap'}
                    className="text-gray-500 hover:text-green-400 transition">
                    <GaugeCircle size={16} />
                  </button>
                  <button onClick={() => setEditMember(m)} title={ko ? '전체 수정' : 'Edit'}
                    className="text-gray-500 hover:text-green-400 transition">
                    <Edit2 size={16} />
                  </button>
                </div>
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

      {quickHcMember && (
        <QuickHcModal
          member={quickHcMember}
          ko={ko}
          onClose={() => setQuickHcMember(null)}
          onSave={updateHc}
        />
      )}

      {editMember && (
        <EditMemberModal
          member={editMember}
          ko={ko}
          myRole={myRole}
          myMembershipId={myClubs.find((c) => c.id === currentClubId) as any}
          members={members}
          onClose={() => setEditMember(null)}
          onSave={updateMember}
          onDelegate={delegateRole}
        />
      )}
    </div>
  )
}

function QuickHcModal({ member, ko, onClose, onSave }: any) {
  const [clubHc, setClubHc]       = useState(member.club_handicap     != null ? String(member.club_handicap)     : '')
  const [personalHc, setPersonalHc] = useState(member.personal_handicap != null ? String(member.personal_handicap) : '')

  function handleSave() {
    const c = clubHc.trim()     !== '' ? parseFloat(clubHc)     : null
    const p = personalHc.trim() !== '' ? parseFloat(personalHc) : null
    onSave(member.id, c, p)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl px-5 pt-4 pb-8 w-full" onClick={e => e.stopPropagation()}>
        {/* handle */}
        <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
        <div className="flex items-center gap-2 mb-4">
          <GaugeCircle size={18} className="text-green-400" />
          <h3 className="text-base font-bold text-white flex-1">
            {ko ? '핸디캡 설정' : 'Set Handicap'}
          </h3>
          <span className="text-sm text-gray-400">{member.users?.full_name}</span>
        </div>

        <div className="space-y-3">
          {/* Club HC */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">
              {ko ? '클럽 핸디 (원례회 전용)' : 'Club Handicap (for this club)'}
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setClubHc(v => v === '' ? '' : String(Math.max(0, parseFloat(v||'0') - 1)))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">−</button>
              <input
                type="number" step="1" min="0" max="54" value={clubHc}
                onChange={e => setClubHc(e.target.value)}
                placeholder="0"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl font-bold"
              />
              <button onClick={() => setClubHc(v => String(parseFloat(v||'0') + 1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">+</button>
            </div>
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[0,5,9,12,15,18,21,24,27,36].map(n => (
                <button key={n} onClick={() => setClubHc(String(n))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${clubHc === String(n) ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Personal HC */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">
              {ko ? '공식 핸디 (WHS/국제)' : 'Official Handicap Index (WHS)'}
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setPersonalHc(v => v === '' ? '' : String(Math.max(0, parseFloat(v||'0') - 1)))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">−</button>
              <input
                type="number" step="0.1" min="0" max="54" value={personalHc}
                onChange={e => setPersonalHc(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl font-bold"
              />
              <button onClick={() => setPersonalHc(v => String((parseFloat(v||'0') + 0.1).toFixed(1)))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">+</button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium">
              {ko ? '취소' : 'Cancel'}
            </button>
            <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold">
              {ko ? '저장' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditMemberModal({ member, ko, myRole, members, onClose, onSave, onDelegate }: any) {
  const [clubHc, setClubHc] = useState(member.club_handicap ?? '')
  const [personalHc, setPersonalHc] = useState(member.personal_handicap ?? '')
  const [role, setRole] = useState(member.role)
  const [feeType, setFeeType] = useState<string>(member.fee_type ?? '')
  const [showDelegate, setShowDelegate] = useState(false)
  const [delegateRole, setDelegateRole] = useState(myRole)
  const { currentClubId, myClubs } = useAuthStore()
  const myMembershipId = myClubs.find((c) => c.id === currentClubId)

  const isSelf = member.user_id === useAuthStore.getState().user?.id
  const canDelegate = ['president', 'secretary'].includes(myRole) && !isSelf

  const roles = Object.entries(ROLE_MAP).map(([value, [ko, en]]) => ({ value, ko, en }))

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">
          {member.users?.full_name} {ko ? '수정' : 'Edit'}
        </h3>
        <div className="space-y-4">
          {/* 역할 */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">{ko ? '역할' : 'Role'}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
              {roles.map((r) => <option key={r.value} value={r.value}>{ko ? r.ko : r.en}</option>)}
            </select>
          </div>

          {/* 회비 유형 */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">{ko ? '회비 유형' : 'Fee Type'}</label>
            <div className="flex gap-2">
              {[
                { v: '', label: ko ? '미지정' : 'Not Set' },
                { v: 'annual', label: ko ? '년회비' : 'Annual' },
                { v: 'monthly', label: ko ? '월회비' : 'Monthly' },
              ].map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setFeeType(v)}
                  className={`flex-1 py-2 rounded-xl text-sm transition ${
                    feeType === v
                      ? v === 'annual' ? 'bg-yellow-700 text-white'
                        : v === 'monthly' ? 'bg-blue-700 text-white'
                        : 'bg-gray-600 text-white'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 핸디캡 */}
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

          {/* 저장/취소 */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={() => onSave(member.id, parseFloat(clubHc) || 0, parseFloat(personalHc) || 0, role, feeType || null)}
              className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">{ko ? '저장' : 'Save'}</button>
          </div>

          {/* 역할 위임 섹션 */}
          {canDelegate && (
            <div className="border-t border-gray-800 pt-4">
              {!showDelegate ? (
                <button onClick={() => setShowDelegate(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-800/60 text-orange-400 text-sm hover:bg-orange-900/20 transition">
                  <ShieldCheck size={15} />
                  {ko ? '역할 위임' : 'Delegate Role'}
                </button>
              ) : (
                <div className="space-y-3 bg-orange-900/10 border border-orange-800/40 rounded-xl p-4">
                  <p className="text-sm font-semibold text-orange-300">
                    {ko ? '역할 위임' : 'Delegate Role'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {ko
                      ? `${member.users?.full_name}님에게 내 역할을 위임합니다. 나의 역할은 임원으로 변경됩니다.`
                      : `Delegate your role to ${member.users?.full_name}. Your role will change to Officer.`}
                  </p>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">{ko ? '위임할 역할' : 'Role to delegate'}</label>
                    <select value={delegateRole} onChange={(e) => setDelegateRole(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                      {['president', 'secretary'].map((r) => (
                        <option key={r} value={r}>{ko ? ROLE_MAP[r][0] : ROLE_MAP[r][1]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDelegate(false)}
                      className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm">{ko ? '취소' : 'Cancel'}</button>
                    <button
                      onClick={() => {
                        if (confirm(ko
                          ? `정말로 ${member.users?.full_name}님에게 ${ROLE_MAP[delegateRole][0]} 역할을 위임하시겠습니까?`
                          : `Delegate ${ROLE_MAP[delegateRole][1]} to ${member.users?.full_name}?`
                        )) {
                          const myM = members.find((m: any) => m.user_id === useAuthStore.getState().user?.id)
                          if (myM) onDelegate(member.id, delegateRole, myM.id)
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-orange-700 text-white text-sm font-semibold">
                      {ko ? '위임 확정' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
