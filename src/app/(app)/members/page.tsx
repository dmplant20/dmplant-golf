'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  UserCheck, Clock, UserX, Edit2, ShieldCheck, GaugeCircle,
  UserMinus, RotateCcw, AlertTriangle, History, Shield,
} from 'lucide-react'

// ── role config ────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  president:      'bg-yellow-900/60 text-yellow-300 border-yellow-700/40',
  vice_president: 'bg-orange-900/60 text-orange-300 border-orange-700/40',
  secretary:      'bg-blue-900/60 text-blue-300 border-blue-700/40',
  auditor:        'bg-red-900/60 text-red-300 border-red-700/40',
  advisor:        'bg-teal-900/60 text-teal-300 border-teal-700/40',
  officer:        'bg-purple-900/60 text-purple-300 border-purple-700/40',
  member:         'bg-gray-800 text-gray-300 border-gray-700/30',
}

const ROLE_MAP: Record<string, [string, string]> = {
  president:      ['회장',   'President'],
  vice_president: ['부회장', 'Vice Pres.'],
  secretary:      ['총무',   'Secretary'],
  auditor:        ['감사',   'Auditor'],
  advisor:        ['고문',   'Advisor'],
  officer:        ['임원',   'Officer'],
  member:         ['회원',   'Member'],
}

// 임원급 이상 (회계 상세 열람 권한)
export const OFFICER_ROLES = ['president', 'vice_president', 'secretary', 'auditor', 'advisor', 'officer']

const ACTION_LABELS: Record<string, [string, string]> = {
  approval:      ['가입 승인', 'Approved'],
  rejection:     ['가입 거부', 'Rejected'],
  role_change:   ['역할 변경', 'Role changed'],
  withdrawal:    ['탈퇴 처리', 'Withdrawn'],
  reinstatement: ['복권',      'Reinstated'],
  delegation:    ['역할 위임', 'Role delegated'],
}

// ── helpers ────────────────────────────────────────────────────────────────
function RoleBadge({ role, ko }: { role: string; ko: boolean }) {
  const entry = ROLE_MAP[role]
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${ROLE_COLORS[role] ?? ROLE_COLORS.member}`}>
      {entry ? (ko ? entry[0] : entry[1]) : role}
    </span>
  )
}

// ── component ──────────────────────────────────────────────────────────────
export default function MembersPage() {
  const { currentClubId, lang, myClubs, user, setMyClubs } = useAuthStore()
  const ko       = lang === 'ko'
  const myMembership = myClubs.find(c => c.id === currentClubId)
  const myRole       = myMembership?.role ?? 'member'
  const canManage    = ['president', 'secretary'].includes(myRole)

  const [tab,           setTab]           = useState<'approved' | 'pending' | 'withdrawn' | 'log'>('approved')
  const [members,       setMembers]       = useState<any[]>([])
  const [pending,       setPending]       = useState<any[]>([])
  const [withdrawn,     setWithdrawn]     = useState<any[]>([])
  const [activityLog,   setActivityLog]   = useState<any[]>([])
  const [editMember,    setEditMember]    = useState<any>(null)
  const [quickHcMember, setQuickHcMember] = useState<any>(null)
  const [withdrawTarget,setWithdrawTarget]= useState<any>(null)
  const [loading,       setLoading]       = useState(true)
  const [myFeeStatus,   setMyFeeStatus]   = useState<{
    feeType: string; paid: boolean; unpaidMonths: number[]
  } | null>(null)

  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: approved }, { data: pend }, { data: withdr }, { data: log }] = await Promise.all([
      supabase.from('club_memberships')
        .select('*, users(full_name, full_name_en, name_abbr, avatar_url, phone)')
        .eq('club_id', currentClubId).eq('status', 'approved').order('role'),
      supabase.from('club_memberships')
        .select('*, users(full_name, full_name_en, name_abbr, phone)')
        .eq('club_id', currentClubId).eq('status', 'pending'),
      supabase.from('club_memberships')
        .select('*, users(full_name, full_name_en, name_abbr)')
        .eq('club_id', currentClubId).eq('status', 'withdrawn')
        .order('withdrawn_at', { ascending: false }),
      canManage
        ? supabase.from('member_activity_log')
            .select('*, users!target_user_id(full_name), actor:users!actor_id(full_name)')
            .eq('club_id', currentClubId)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
    ])
    setMembers(approved ?? [])
    setPending(pend ?? [])
    setWithdrawn(withdr ?? [])
    setActivityLog(log ?? [])
    setLoading(false)

    // 내 회비 납부 현황
    if (user?.id) {
      const myMem = approved?.find((m: any) => m.user_id === user.id)
      if (myMem?.fee_type) {
        const currentYear  = new Date().getFullYear()
        const currentMonth = new Date().getMonth() + 1
        const { data: feeTxns } = await supabase
          .from('finance_transactions').select('transaction_date')
          .eq('club_id', currentClubId).eq('type', 'fee').eq('member_id', user.id)
          .gte('transaction_date', `${currentYear}-01-01`).lte('transaction_date', `${currentYear}-12-31`)
        if (myMem.fee_type === 'annual') {
          setMyFeeStatus({ feeType: 'annual', paid: (feeTxns?.length ?? 0) > 0, unpaidMonths: [] })
        } else {
          const paidMonths = new Set((feeTxns ?? []).map((t: any) => new Date(t.transaction_date).getMonth() + 1))
          const unpaidMonths: number[] = []
          for (let m = 1; m <= currentMonth; m++) if (!paidMonths.has(m)) unpaidMonths.push(m)
          setMyFeeStatus({ feeType: 'monthly', paid: unpaidMonths.length === 0, unpaidMonths })
        }
      } else {
        setMyFeeStatus(null)
      }
    }
  }

  useEffect(() => { load() }, [currentClubId])

  // ── actions ────────────────────────────────────────────────────────────────
  async function logAction(target_user_id: string | null, action: string, old_value?: string, new_value?: string, note?: string) {
    if (!currentClubId || !user?.id) return
    const supabase = createClient()
    await supabase.from('member_activity_log').insert({
      club_id: currentClubId, target_user_id, actor_id: user.id,
      action, old_value: old_value ?? null, new_value: new_value ?? null, note: note ?? null,
    })
  }

  async function approve(m: any) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({ status: 'approved', joined_at: new Date().toISOString() }).eq('id', m.id)
    await logAction(m.user_id, 'approval', 'pending', 'approved')
    load()
  }

  async function reject(m: any) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({ status: 'rejected' }).eq('id', m.id)
    await logAction(m.user_id, 'rejection', 'pending', 'rejected')
    load()
  }

  async function updateMember(membershipId: string, clubHc: number | null, personalHc: number | null, role: string, feeType: string | null) {
    const supabase = createClient()
    const target   = members.find(m => m.id === membershipId)
    await supabase.from('club_memberships').update({
      club_handicap: clubHc, personal_handicap: personalHc, role, fee_type: feeType || null,
    }).eq('id', membershipId)
    if (target && target.role !== role) {
      await logAction(target.user_id, 'role_change', target.role, role)
    }
    setEditMember(null)
    load()
  }

  async function updateHc(membershipId: string, clubHc: number | null, personalHc: number | null) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({ club_handicap: clubHc, personal_handicap: personalHc }).eq('id', membershipId)
    setQuickHcMember(null)
    load()
  }

  async function delegateRole(targetMembershipId: string, roleToDelegate: string, myMembershipId: string) {
    const supabase = createClient()
    const target   = members.find(m => m.id === targetMembershipId)
    await Promise.all([
      supabase.from('club_memberships').update({ role: roleToDelegate }).eq('id', targetMembershipId),
      supabase.from('club_memberships').update({ role: 'officer' }).eq('id', myMembershipId),
    ])
    await logAction(target?.user_id ?? null, 'delegation', myRole, roleToDelegate, `위임자: ${user?.full_name}`)
    setMyClubs(myClubs.map(c => c.id === currentClubId ? { ...c, role: 'officer' } : c))
    setEditMember(null)
    load()
  }

  async function withdrawMember(m: any, reason: string) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({
      status:            'withdrawn',
      withdrawn_at:      new Date().toISOString(),
      withdrawn_by:      user?.id,
      withdrawal_reason: reason.trim() || null,
    }).eq('id', m.id)
    await logAction(m.user_id, 'withdrawal', 'approved', 'withdrawn', reason.trim() || undefined)
    setWithdrawTarget(null)
    load()
  }

  async function reinstateMember(m: any) {
    const supabase = createClient()
    await supabase.from('club_memberships').update({
      status: 'approved', withdrawn_at: null, withdrawn_by: null, withdrawal_reason: null,
    }).eq('id', m.id)
    await logAction(m.user_id, 'reinstatement', 'withdrawn', 'approved')
    load()
  }

  const roleLabel = (r: string) => { const e = ROLE_MAP[r]; return e ? (ko ? e[0] : e[1]) : r }

  const tabs: Array<{ id: string; label: string; count?: number }> = [
    { id: 'approved',  label: ko ? '회원'   : 'Members', count: members.length },
    { id: 'pending',   label: ko ? '대기'   : 'Pending', count: pending.length },
    { id: 'withdrawn', label: ko ? '탈퇴'   : 'Withdrawn', count: withdrawn.length },
    ...(canManage ? [{ id: 'log', label: ko ? '활동기록' : 'Activity' }] : []),
  ]

  return (
    <div className="px-4 py-5 pb-28">
      {/* ── 탭 ── */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition ${tab === t.id ? 'bg-green-700 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">{ko ? '로딩 중...' : 'Loading...'}</div>
      ) : tab === 'approved' ? (

        /* ── 활성 회원 ── */
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
                style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.2)' }}>
                {m.users?.avatar_url ? <img src={m.users.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white font-semibold text-sm">
                    {lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                  </span>
                  {m.users?.name_abbr && <span className="text-xs text-gray-500">({m.users.name_abbr})</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <RoleBadge role={m.role} ko={ko} />
                  {m.fee_type === 'annual'  && <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">{ko ? '년회비' : 'Annual'}</span>}
                  {m.fee_type === 'monthly' && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-900/50  text-blue-300">{ko ? '월회비' : 'Monthly'}</span>}
                  {m.club_handicap != null && <span className="text-[11px] text-green-400">HC {m.club_handicap}</span>}
                  {/* 내 회비 납부 현황 */}
                  {m.user_id === user?.id && myFeeStatus && (
                    myFeeStatus.paid
                      ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-900/60 text-green-300">✓ {ko ? '납부완료' : 'Paid'}</span>
                      : myFeeStatus.feeType === 'annual'
                        ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-900/60 text-red-300">{ko ? '연회비 미납' : 'Unpaid'}</span>
                        : <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-900/60 text-red-300">{myFeeStatus.unpaidMonths.join(',')}월 미납</span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => setQuickHcMember(m)} title={ko ? '핸디 수정' : 'Edit HC'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-900/20 transition">
                    <GaugeCircle size={15} />
                  </button>
                  <button onClick={() => setEditMember(m)} title={ko ? '정보 수정' : 'Edit'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-900/20 transition">
                    <Edit2 size={15} />
                  </button>
                  {/* 탈퇴 처리: 본인 제외 */}
                  {m.user_id !== user?.id && (
                    <button onClick={() => setWithdrawTarget(m)} title={ko ? '탈퇴 처리' : 'Withdraw'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition">
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-gray-500">{ko ? '회원이 없습니다' : 'No members'}</p>
            </div>
          )}
        </div>

      ) : tab === 'pending' ? (

        /* ── 가입 대기 ── */
        <div className="space-y-2">
          {pending.map(m => (
            <div key={m.id} className="glass-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-lg">👤</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">
                    {lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                  </p>
                  {m.users?.phone && <p className="text-gray-500 text-xs mt-0.5">{m.users.phone}</p>}
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {ko ? '가입 신청일:' : 'Applied:'} {new Date(m.created_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US')}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => approve(m)}
                      className="flex items-center gap-1 bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg transition">
                      <UserCheck size={12} />{ko ? '승인' : 'Approve'}
                    </button>
                    <button onClick={() => reject(m)}
                      className="flex items-center gap-1 bg-gray-800 hover:bg-red-900/50 text-gray-300 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition">
                      <UserX size={12} />{ko ? '거부' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Clock size={28} className="mx-auto text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">{ko ? '대기 중인 가입 신청이 없습니다' : 'No pending requests'}</p>
            </div>
          )}
        </div>

      ) : tab === 'withdrawn' ? (

        /* ── 탈퇴 회원 (아카이브) ── */
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-900/15 border border-amber-700/20 mb-3">
            <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
            <p className="text-[11px] text-amber-300">
              {ko ? '탈퇴 회원의 모든 기록(스코어, 출석 등)은 보존됩니다.' : 'All records of withdrawn members are preserved.'}
            </p>
          </div>
          {withdrawn.map(m => (
            <div key={m.id} className="glass-card rounded-2xl px-4 py-3 opacity-75">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                  <UserX size={18} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 font-medium text-sm">
                    {lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500">{ko ? '탈퇴' : 'Withdrawn'}</span>
                  </p>
                  {m.withdrawn_at && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {ko ? '탈퇴일:' : 'Date:'} {new Date(m.withdrawn_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US')}
                    </p>
                  )}
                  {m.withdrawal_reason && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {ko ? '사유:' : 'Reason:'} {m.withdrawal_reason}
                    </p>
                  )}
                </div>
                {canManage && (
                  <button onClick={() => {
                    if (confirm(ko ? `${m.users?.full_name}님을 복권(재가입)하시겠습니까?` : `Reinstate ${m.users?.full_name}?`)) {
                      reinstateMember(m)
                    }
                  }} title={ko ? '복권 (재가입)' : 'Reinstate'}
                    className="flex items-center gap-1 text-xs text-teal-400 border border-teal-800/50 rounded-lg px-2 py-1.5 hover:bg-teal-900/20 transition flex-shrink-0">
                    <RotateCcw size={12} />{ko ? '복권' : 'Reinstate'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {withdrawn.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-gray-500 text-sm">{ko ? '탈퇴한 회원이 없습니다' : 'No withdrawn members'}</p>
            </div>
          )}
        </div>

      ) : (

        /* ── 활동 기록 (임원 전용) ── */
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-900/15 border border-blue-700/20 mb-3">
            <History size={13} className="text-blue-400 flex-shrink-0" />
            <p className="text-[11px] text-blue-300">
              {ko ? '모든 역할 변경, 탈퇴, 승인 내역이 기록됩니다.' : 'All role changes, withdrawals, and approvals are logged.'}
            </p>
          </div>
          {activityLog.map((log: any) => {
            const actionEntry = ACTION_LABELS[log.action]
            const actionLabel = actionEntry ? (ko ? actionEntry[0] : actionEntry[1]) : log.action
            const oldLabel    = log.old_value ? (ROLE_MAP[log.old_value]?.[ko ? 0 : 1] ?? log.old_value) : null
            const newLabel    = log.new_value ? (ROLE_MAP[log.new_value]?.[ko ? 0 : 1] ?? log.new_value) : null
            return (
              <div key={log.id} className="glass-card rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{log.users?.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {actionLabel}
                      {oldLabel && newLabel ? ` · ${oldLabel} → ${newLabel}` : ''}
                    </p>
                    {log.note && <p className="text-[10px] text-gray-600 mt-0.5">{log.note}</p>}
                    <p className="text-[10px] text-gray-700 mt-0.5">
                      {ko ? '처리자:' : 'By:'} {log.actor?.full_name ?? '—'}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
                    {new Date(log.created_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            )
          })}
          {activityLog.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-gray-500 text-sm">{ko ? '활동 기록이 없습니다' : 'No activity yet'}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {quickHcMember && (
        <QuickHcModal member={quickHcMember} ko={ko} onClose={() => setQuickHcMember(null)} onSave={updateHc} />
      )}
      {editMember && (
        <EditMemberModal
          member={editMember}
          ko={ko}
          myRole={myRole}
          members={members}
          onClose={() => setEditMember(null)}
          onSave={updateMember}
          onDelegate={delegateRole}
        />
      )}
      {withdrawTarget && (
        <WithdrawModal
          member={withdrawTarget}
          ko={ko}
          onClose={() => setWithdrawTarget(null)}
          onConfirm={(reason: string) => withdrawMember(withdrawTarget, reason)}
        />
      )}
    </div>
  )
}

// ── QuickHcModal ───────────────────────────────────────────────────────────
function QuickHcModal({ member, ko, onClose, onSave }: any) {
  const [clubHc,     setClubHc]     = useState(member.club_handicap     != null ? String(member.club_handicap)     : '')
  const [personalHc, setPersonalHc] = useState(member.personal_handicap != null ? String(member.personal_handicap) : '')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl px-5 pt-4 pb-8 w-full" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
        <div className="flex items-center gap-2 mb-4">
          <GaugeCircle size={18} className="text-green-400" />
          <h3 className="text-base font-bold text-white flex-1">{ko ? '핸디캡 설정' : 'Set Handicap'}</h3>
          <span className="text-sm text-gray-400">{member.users?.full_name}</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">{ko ? '클럽 핸디 (원례회 전용)' : 'Club Handicap'}</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setClubHc(v => v === '' ? '0' : String(Math.max(0, parseFloat(v) - 1)))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">−</button>
              <input type="number" step="1" min="0" max="54" value={clubHc} onChange={e => setClubHc(e.target.value)} placeholder="0"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl font-bold" />
              <button onClick={() => setClubHc(v => String(parseFloat(v || '0') + 1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">+</button>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[0, 5, 9, 12, 15, 18, 21, 24, 27, 36].map(n => (
                <button key={n} onClick={() => setClubHc(String(n))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${clubHc === String(n) ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">{ko ? '공식 핸디 (WHS/국제)' : 'Official Handicap (WHS)'}</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setPersonalHc(v => v === '' ? '0' : String(Math.max(0, parseFloat(v) - 1).toFixed(1)))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">−</button>
              <input type="number" step="0.1" min="0" max="54" value={personalHc} onChange={e => setPersonalHc(e.target.value)} placeholder="0.0"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl font-bold" />
              <button onClick={() => setPersonalHc(v => (parseFloat(v || '0') + 0.1).toFixed(1))}
                className="w-10 h-10 rounded-xl bg-gray-800 text-white text-lg font-bold hover:bg-gray-700 transition flex-shrink-0">+</button>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={() => onSave(member.id, clubHc !== '' ? parseFloat(clubHc) : null, personalHc !== '' ? parseFloat(personalHc) : null)}
              className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold">{ko ? '저장' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EditMemberModal ────────────────────────────────────────────────────────
function EditMemberModal({ member, ko, myRole, members, onClose, onSave, onDelegate }: any) {
  const [clubHc,       setClubHc]       = useState(member.club_handicap     != null ? String(member.club_handicap)     : '')
  const [personalHc,   setPersonalHc]   = useState(member.personal_handicap != null ? String(member.personal_handicap) : '')
  const [role,         setRole]         = useState(member.role)
  const [feeType,      setFeeType]      = useState<string>(member.fee_type ?? '')
  const [showDelegate, setShowDelegate] = useState(false)
  const [delegateRole, setDelegateRoleVal] = useState<string>(myRole)

  const { currentClubId, myClubs } = useAuthStore()
  const isSelf      = member.user_id === useAuthStore.getState().user?.id
  const canDelegate = ['president', 'secretary'].includes(myRole) && !isSelf

  // Role change buttons
  const officerRoles = [
    { v: 'member',         label: ko ? '회원'   : 'Member',     color: 'bg-gray-700 text-gray-300'          },
    { v: 'officer',        label: ko ? '임원'   : 'Officer',    color: 'bg-purple-800 text-purple-300'      },
    { v: 'auditor',        label: ko ? '감사'   : 'Auditor',    color: 'bg-red-800 text-red-300'            },
    { v: 'advisor',        label: ko ? '고문'   : 'Advisor',    color: 'bg-teal-800 text-teal-300'          },
    { v: 'vice_president', label: ko ? '부회장' : 'Vice Pres.', color: 'bg-orange-800 text-orange-300'      },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl p-6 w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
        <div className="flex items-center gap-2 mb-5">
          <Shield size={16} className="text-green-400" />
          <h3 className="text-base font-bold text-white flex-1">{member.users?.full_name} {ko ? '수정' : '— Edit'}</h3>
        </div>

        <div className="space-y-5">
          {/* ── 역할 지정 ── */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              {ko ? '역할 지정' : 'Assign Role'}
            </label>
            <div className="flex flex-wrap gap-2">
              {officerRoles.map(r => (
                <button key={r.v} type="button" onClick={() => setRole(r.v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    role === r.v
                      ? `${r.color} border-current opacity-100 ring-1 ring-white/20`
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            {role !== member.role && (
              <p className="text-[10px] text-amber-400 mt-1.5">
                ⚠ {ko ? `역할이 변경됩니다: ${ROLE_MAP[member.role]?.[0] ?? member.role} → ${ROLE_MAP[role]?.[0] ?? role}` : `Role will change: ${ROLE_MAP[member.role]?.[1] ?? member.role} → ${ROLE_MAP[role]?.[1] ?? role}`}
              </p>
            )}
          </div>

          {/* ── 회비 유형 ── */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">{ko ? '회비 유형' : 'Fee Type'}</label>
            <div className="flex gap-2">
              {[{ v: '', label: ko ? '미지정' : 'Not Set' }, { v: 'annual', label: ko ? '년회비' : 'Annual' }, { v: 'monthly', label: ko ? '월회비' : 'Monthly' }].map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setFeeType(v)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    feeType === v
                      ? v === 'annual' ? 'bg-yellow-700 text-white' : v === 'monthly' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* ── 핸디캡 ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '클럽 핸디' : 'Club HC'}</label>
              <input type="number" step="0.1" value={clubHc} onChange={e => setClubHc(e.target.value)} placeholder="0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-center font-bold" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '개인 핸디 (WHS)' : 'Personal HC'}</label>
              <input type="number" step="0.1" value={personalHc} onChange={e => setPersonalHc(e.target.value)} placeholder="0.0"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-center font-bold" />
            </div>
          </div>

          {/* ── 저장/취소 ── */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium">{ko ? '취소' : 'Cancel'}</button>
            <button onClick={() => onSave(member.id, clubHc !== '' ? parseFloat(clubHc) : null, personalHc !== '' ? parseFloat(personalHc) : null, role, feeType || null)}
              className="flex-1 py-3 rounded-xl bg-green-700 text-white font-bold">{ko ? '저장' : 'Save'}</button>
          </div>

          {/* ── 역할 위임 (회장/총무 → 다른 회원) ── */}
          {canDelegate && (
            <div className="border-t border-gray-800 pt-4">
              {!showDelegate ? (
                <button onClick={() => setShowDelegate(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-800/60 text-orange-400 text-sm hover:bg-orange-900/20 transition">
                  <ShieldCheck size={15} />{ko ? '회장/총무 직책 위임' : 'Delegate President/Secretary'}
                </button>
              ) : (
                <div className="space-y-3 bg-orange-900/10 border border-orange-800/40 rounded-xl p-4">
                  <p className="text-sm font-semibold text-orange-300">{ko ? '직책 위임' : 'Delegate Role'}</p>
                  <p className="text-xs text-gray-400">
                    {ko
                      ? `${member.users?.full_name}님에게 내 역할을 위임합니다. 나의 역할은 임원으로 변경됩니다.`
                      : `Delegate your role to ${member.users?.full_name}. Your role will become Officer.`}
                  </p>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">{ko ? '위임할 역할' : 'Role to delegate'}</label>
                    <select value={delegateRole} onChange={e => setDelegateRoleVal(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
                      {['president', 'secretary'].map(r => (
                        <option key={r} value={r}>{ko ? ROLE_MAP[r][0] : ROLE_MAP[r][1]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowDelegate(false)}
                      className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm">{ko ? '취소' : 'Cancel'}</button>
                    <button onClick={() => {
                      if (confirm(ko
                        ? `정말로 ${member.users?.full_name}님에게 ${ROLE_MAP[delegateRole][0]} 직책을 위임하시겠습니까?`
                        : `Delegate ${ROLE_MAP[delegateRole][1]} to ${member.users?.full_name}?`)) {
                        const myM = members.find((m: any) => m.user_id === useAuthStore.getState().user?.id)
                        if (myM) onDelegate(member.id, delegateRole, myM.id)
                      }
                    }} className="flex-1 py-2 rounded-xl bg-orange-700 text-white text-sm font-semibold">
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

// ── WithdrawModal ──────────────────────────────────────────────────────────
function WithdrawModal({ member, ko, onClose, onConfirm }: any) {
  const [reason,   setReason]   = useState('')
  const [step,     setStep]     = useState<1 | 2>(1)   // 2-step confirmation

  const name = member.users?.full_name ?? '—'

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-[200]" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl px-6 pt-5 pb-8 w-full" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>

        {/* 경고 아이콘 */}
        <div className="flex flex-col items-center gap-2 mb-5">
          <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center">
            <UserMinus size={24} className="text-red-400" />
          </div>
          <h3 className="text-base font-bold text-white">{ko ? '회원 탈퇴 처리' : 'Withdraw Member'}</h3>
          <p className="text-sm text-red-400 font-semibold">{name}</p>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            {/* 안내 */}
            <div className="bg-green-900/15 border border-green-800/30 rounded-xl px-4 py-3">
              <p className="text-xs text-green-300 font-semibold mb-1">✅ {ko ? '데이터 보전 정책' : 'Data Preservation Policy'}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {ko
                  ? '탈퇴 처리 후에도 해당 회원의 스코어 기록, 모임 참석 기록, 재무 내역 등 모든 과거 데이터는 영구 보존됩니다. 탈퇴는 클럽 접근을 차단하며 기록은 삭제되지 않습니다.'
                  : 'All historical data (scores, attendance, finances) will be permanently preserved after withdrawal. Withdrawal only revokes club access — records are never deleted.'}
              </p>
            </div>

            {/* 사유 입력 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '탈퇴 사유 (선택)' : 'Withdrawal reason (optional)'}</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder={ko ? '예: 본인 요청, 장기 미활동 등' : 'e.g. Personal request, long inactivity'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-red-800 text-white font-bold">
                {ko ? '다음 →' : 'Next →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 최종 확인 */}
            <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-4 text-center">
              <p className="text-red-300 font-bold text-sm mb-1">
                {ko ? '최종 확인' : 'Final Confirmation'}
              </p>
              <p className="text-gray-300 text-sm">
                {ko ? `"${name}" 회원을 탈퇴 처리하시겠습니까?` : `Withdraw "${name}" from the club?`}
              </p>
              {reason && (
                <p className="text-[11px] text-gray-500 mt-2">{ko ? '사유:' : 'Reason:'} {reason}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium">← {ko ? '이전' : 'Back'}</button>
              <button onClick={() => onConfirm(reason)}
                className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold transition">
                {ko ? '탈퇴 확정' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
