'use client'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Plus, Camera, TrendingUp, TrendingDown, Wallet,
  ChevronDown, ChevronUp, ChevronRight, Receipt, Copy, Check,
  Edit2, Upload, Building2, X, QrCode, Gift, AlertTriangle, Trash2,
} from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'
import { isSuperAdmin } from '@/lib/superAdmin'

const TYPE_LABELS: Record<string, [string, string]> = {
  fee:      ['회비', 'Fee'],
  expense:  ['지출', 'Expense'],
  fine:     ['벌금', 'Fine'],
  donation: ['찬조', 'Donation'],
  other:    ['기타', 'Other'],
}
const EXPENSE_CATEGORY_LABELS: Record<string, [string, string]> = {
  condolence: ['경조사',     'Condolence'],
  gift:       ['상품·화환',  'Gift'],
  event:      ['모임 운영',  'Event'],
  admin:      ['사무비',     'Admin'],
  other:      ['기타',       'Other'],
}
const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp' }
const INCOME_TYPES = ['fee', 'donation', 'fine', 'other']

export default function FinancePage() {
  const { currentClubId, lang, myClubs, user } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const isAdmin = isSuperAdmin(user)
  const isGuest = myRole === 'guest' && !isAdmin
  // 재무 수정·등록·삭제 권한 — 총무 전용 (회장도 불가) + DEV 슈퍼관리자 백업
  const canManage = myRole === 'secretary' || isAdmin
  const canEditFinance = canManage  // alias
  const isOfficer = OFFICER_ROLES.includes(myRole) || isAdmin
  // 회비/벌금 미납자 명단 열람 권한 — 회장·총무·감사·고문만
  const canViewFinance = ['president', 'secretary', 'auditor', 'advisor'].includes(myRole) || isAdmin

  const [txns,         setTxns]         = useState<any[]>([])
  const [sponsorships, setSponsorships] = useState<any[]>([])
  const [fineRules,    setFineRules]    = useState<any>(null)
  const [currency,     setCurrency]     = useState('KRW')
  const [showAdd,      setShowAdd]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  // 거래 내역 월별 아코디언 — 펼쳐진 'YYYY-MM' (가장 최근 월 기본 펼침)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  // 거래 상세 팝업 — 클릭한 거래 객체
  const [detailTxn, setDetailTxn] = useState<any | null>(null)
  // 개인 회비 내역 모달 — 납부완료 칩 클릭 시
  const [feeHistoryMember,  setFeeHistoryMember]  = useState<any | null>(null)
  const [feeHistoryTxns,    setFeeHistoryTxns]    = useState<any[]>([])
  const [feeHistoryLoading, setFeeHistoryLoading] = useState(false)
  const [addPayForm,        setAddPayForm]        = useState({ amount:'', date: new Date().toISOString().split('T')[0], note:'' })
  const [addPaySaving,      setAddPaySaving]      = useState(false)
  const [addPayError,       setAddPayError]       = useState<string | null>(null)
  // 월례회 패턴/예외 — 회비 미납 계산의 "월례회 통과" 기준에 사용
  const [meetingPattern,  setMeetingPattern]  = useState<any | null>(null)
  const [meetingOverrides, setMeetingOverrides] = useState<any[]>([])
  // 이전 이월금 카드 접기/펼치기 — 기본 접힘
  const [showCarryover, setShowCarryover] = useState(false)
  // 이중확인 삭제 모달 — { title, body, onConfirm } 가 set 되면 모달 노출
  const [confirmDelete, setConfirmDelete] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null)
  const [receiptUrl,   setReceiptUrl]   = useState<string | null>(null)
  const [members,      setMembers]      = useState<any[]>([])
  const [showFineRules,setShowFineRules]= useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── payment info ───────────────────────────────────────────────────────
  const [payInfo,         setPayInfo]         = useState<any>(null)
  const [showPayEdit,     setShowPayEdit]      = useState(false)
  const [payForm,         setPayForm]          = useState({ bankName: '', bankAccount: '', bankHolder: '', memo: '' })
  const [qrPreview,       setQrPreview]        = useState<string | null>(null)
  const [qrFile,          setQrFile]           = useState<File | null>(null)
  const [paySaving,       setPaySaving]        = useState(false)
  const [copied,          setCopied]           = useState(false)
  const [viewQr,          setViewQr]           = useState(false)
  const qrInputRef = useRef<HTMLInputElement>(null)

  // ── fee payment status ────────────────────────────────────────────────
  // 항상 기본 접힘 — 화면 정리 위해 사용자가 직접 펼쳐서 확인
  const [showFeeStatus,   setShowFeeStatus]    = useState(false)
  // 회비 납부 계좌 카드 접기/펼치기 — 평상시 접힘
  const [showPayInfo,     setShowPayInfo]      = useState(false)
  const [clubFees,        setClubFees]         = useState<{annual: number; monthly: number}>({ annual: 0, monthly: 0 })

  // ── 납부확인 모달 ──────────────────────────────────────────────────────
  const [payingMember,    setPayingMember]     = useState<any>(null)  // null = closed
  const [payingAmount,    setPayingAmount]     = useState('')
  const [payingDate,      setPayingDate]       = useState(new Date().toISOString().split('T')[0])
  const [payingSaving,    setPayingSaving]     = useState(false)
  // 납부 방식 — annual(년납 1회) / monthly(월납 — 입금액에 따라 차감)
  const [feeKind,         setFeeKind]          = useState<'annual'|'monthly'>('annual')

  // ── fine rules edit ───────────────────────────────────────────────────
  const [showFineEdit,    setShowFineEdit]     = useState(false)
  const [fineForm,        setFineForm]         = useState({ perStroke: '', max: '', notes: '' })
  const [fineSaving,      setFineSaving]       = useState(false)

  // ── member name text (free text) ──────────────────────────────────────
  const [memberInputTab,  setMemberInputTab]   = useState<'select'|'text'>('select')

  const [form, setForm] = useState({
    type: 'fee', amount: '', description: '',
    date: new Date().toISOString().split('T')[0], memberId: '',
    memberNameText: '',
    expense_category: 'event',  // only used when type === 'expense'
    item_name: '',               // only used when expense_category === 'gift'
  })
  // 거래 수정/삭제 — editingId 가 있으면 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // 이전 이월금 — 클럽 단위 단일 값
  const [carryoverAmount, setCarryoverAmount] = useState<number>(0)
  const [carryoverNote,   setCarryoverNote]   = useState<string>('')
  const [showCarryoverEdit, setShowCarryoverEdit] = useState(false)
  const [carryoverForm, setCarryoverForm] = useState({ amount: '', note: '' })
  const [carryoverSaving, setCarryoverSaving] = useState(false)

  // 찬조 추가/수정 — 현금 또는 상품
  const [showSpModal, setShowSpModal] = useState(false)
  const [editingSpId, setEditingSpId] = useState<string | null>(null)
  const [spForm, setSpForm] = useState({
    type: 'cash' as 'cash' | 'item',
    member_name: '',
    amount: '',
    item_description: '',
    estimated_value: '',
    sponsor_date: new Date().toISOString().split('T')[0],
    note: '',
  })
  const [spSaving, setSpSaving] = useState(false)
  const emptySpForm = { type: 'cash' as 'cash' | 'item', member_name: '', amount: '', item_description: '', estimated_value: '', sponsor_date: new Date().toISOString().split('T')[0], note: '' }

  // ── sync fineForm when fineRules loads ────────────────────────────────
  useEffect(() => {
    if (fineRules) {
      setFineForm({
        perStroke: fineRules.fine_handicap_per_stroke ? String(fineRules.fine_handicap_per_stroke) : '',
        max:       fineRules.fine_handicap_max        ? String(fineRules.fine_handicap_max)        : '',
        notes:     fineRules.fine_notes               ?? '',
      })
    }
  }, [fineRules])

  // ── 거래 수정 시작 ─────────────────────────────────────────────────────
  function startEdit(t: any) {
    // 자유 텍스트로 들어간 회원명 분리: 설명 앞쪽 [이름] 패턴
    let desc = t.description ?? ''
    let nameText = ''
    const m = desc.match(/^\[([^\]]+)\]\s*(.*)$/)
    if (m && !t.member_id) { nameText = m[1]; desc = m[2] }
    setForm({
      type: t.type ?? 'fee',
      amount: String(t.amount ?? ''),
      description: desc,
      date: (t.transaction_date ?? '').slice(0, 10) || new Date().toISOString().split('T')[0],
      memberId: t.member_id ?? '',
      memberNameText: nameText,
      expense_category: t.expense_category ?? 'event',
      item_name: t.item_name ?? '',
    })
    setMemberInputTab(nameText ? 'text' : 'select')
    setEditingId(t.id)
    setShowAdd(true)
  }

  function deleteTransaction(id: string) {
    const t = txns.find(x => x.id === id)
    const desc = t?.description ?? '거래'
    const amt  = t?.amount ? `${sym}${Number(t.amount).toLocaleString()}` : ''
    setConfirmDelete({
      title: ko ? '거래 내역 삭제' : 'Delete Transaction',
      body:  ko ? `"${desc}" ${amt}\n이 거래 내역을 영구 삭제합니다.` : `"${desc}" ${amt} will be permanently deleted.`,
      onConfirm: async () => {
        setDeleting(id)
        const supabase = createClient()
        const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
        setDeleting(null)
        setConfirmDelete(null)
        if (error) { alert(ko ? `삭제 실패: ${error.message}` : `Delete failed: ${error.message}`); return }
        setExpandedId(null)
        load()
      },
    })
  }

  // ── 찬조 저장 (현금·상품 동시 가능) ─────────────────────────────────
  async function saveSponsorship() {
    if (!spForm.member_name.trim()) { alert(ko ? '찬조한 회원 이름을 입력하세요' : 'Member name required'); return }
    const cashAmt = parseInt(spForm.amount || '0') || 0
    const hasCash = cashAmt > 0
    const hasItem = !!spForm.item_description.trim()
    if (!hasCash && !hasItem) { alert(ko ? '현금 금액 또는 상품 내용 중 하나는 입력하세요' : 'Provide cash or item'); return }
    setSpSaving(true)
    const supabase = createClient()
    // type: 'cash' = 현금만, 'item' = 상품만 — 양쪽 다 있는 경우는 'cash' 로 저장하되 item 필드 함께 채움
    const payload: any = {
      club_id: currentClubId,
      type: hasCash ? 'cash' : 'item',
      member_name: spForm.member_name.trim(),
      sponsor_date: spForm.sponsor_date,
      note: spForm.note.trim() || null,
      currency,
      amount: hasCash ? cashAmt : null,
      item_description: hasItem ? spForm.item_description.trim() : null,
      estimated_value: hasItem && spForm.estimated_value ? parseInt(spForm.estimated_value) : null,
    }
    const { error } = editingSpId
      ? await supabase.from('sponsorships').update(payload).eq('id', editingSpId)
      : await supabase.from('sponsorships').insert(payload)
    setSpSaving(false)
    if (error) { alert(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`); return }
    setShowSpModal(false)
    setEditingSpId(null)
    setSpForm(emptySpForm)
    load()

    // 푸시 — 새 찬조만 (수정은 제외)
    if (!editingSpId && currentClubId) {
      try {
        const cSym = CURRENCY_SYMBOL[currency] ?? sym
        const parts: string[] = []
        if (hasCash) parts.push(`${cSym}${cashAmt.toLocaleString()}`)
        if (hasItem) parts.push(`🎁 ${spForm.item_description.trim()}`)
        const { sendClubPush } = await import('@/lib/push')
        await sendClubPush({
          club_id: currentClubId,
          title: `💝 ${ko ? '새 찬조' : 'New Sponsorship'}`,
          body: `${spForm.member_name.trim()} · ${parts.join(' + ')}`,
          url: '/finance',
        })
      } catch (e) { console.warn('[sponsorship push]', e) }
    }
  }

  function startEditSponsorship(s: any) {
    setSpForm({
      type: (s.type === 'item' ? 'item' : 'cash'),
      member_name: s.member_name ?? '',
      amount: s.amount != null ? String(s.amount) : '',
      item_description: s.item_description ?? '',
      estimated_value: s.estimated_value != null ? String(s.estimated_value) : '',
      sponsor_date: (s.sponsor_date ?? '').slice(0, 10) || new Date().toISOString().split('T')[0],
      note: s.note ?? '',
    })
    setEditingSpId(s.id)
    setShowSpModal(true)
  }

  function deleteSponsorship(id: string) {
    const s = sponsorships.find(x => x.id === id)
    setConfirmDelete({
      title: ko ? '찬조 내역 삭제' : 'Delete Sponsorship',
      body:  ko ? `"${s?.member_name ?? '찬조'}"\n이 찬조 내역을 영구 삭제합니다.` : `"${s?.member_name ?? 'Sponsorship'}" will be deleted.`,
      onConfirm: async () => {
        const supabase = createClient()
        const { error } = await supabase.from('sponsorships').delete().eq('id', id)
        setConfirmDelete(null)
        if (error) { alert(ko ? `삭제 실패: ${error.message}` : `Delete failed: ${error.message}`); return }
        load()
      },
    })
  }

  // ── load ──────────────────────────────────────────────────────────────
  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const query = isOfficer
      ? supabase.from('finance_transactions').select('*, users!member_id(full_name, full_name_en), recorder:users!recorded_by(full_name, full_name_en)')
      : supabase.from('finance_transactions').select('*, users!member_id(full_name, full_name_en)')
    const [{ data: transactions }, { data: club }, { data: mems }, { data: pi }, { data: sponsors }, { data: pat }, { data: ovs }] = await Promise.all([
      query.eq('club_id', currentClubId).order('transaction_date', { ascending: false }),
      supabase.from('clubs').select('currency,fine_handicap_per_stroke,fine_handicap_max,fine_notes,annual_fee,monthly_fee,carryover_amount,carryover_note').eq('id', currentClubId).single(),
      supabase.from('club_memberships').select('user_id, fee_type, joined_at, role, users(full_name, full_name_en)').eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('club_payment_info').select('*').eq('club_id', currentClubId).maybeSingle(),
      supabase.from('sponsorships').select('*').eq('club_id', currentClubId).order('sponsor_date', { ascending: false }),
      supabase.from('recurring_meetings').select('*').eq('club_id', currentClubId).maybeSingle(),
      supabase.from('meeting_overrides').select('*').eq('club_id', currentClubId),
    ])
    setTxns(transactions ?? [])
    setSponsorships(sponsors ?? [])
    if (club?.currency) setCurrency(club.currency)
    if (club?.fine_handicap_per_stroke || club?.fine_notes) setFineRules(club)
    else setFineRules(null)
    setClubFees({ annual: club?.annual_fee ?? 0, monthly: club?.monthly_fee ?? 0 })
    setCarryoverAmount(Number(club?.carryover_amount ?? 0))
    setCarryoverNote(club?.carryover_note ?? '')
    setMembers(mems ?? [])
    setPayInfo(pi ?? null)
    setMeetingPattern(pat ?? null)
    setMeetingOverrides(ovs ?? [])
    if (pi) setPayForm({ bankName: pi.bank_name ?? '', bankAccount: pi.bank_account ?? '', bankHolder: pi.bank_holder ?? '', memo: pi.memo ?? '' })
    setLoading(false)
  }

  useEffect(() => {
    load()
    function onWake() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
    }
  }, [currentClubId])

  const sym = CURRENCY_SYMBOL[currency] ?? '₩'
  const income  = txns.filter((t) => INCOME_TYPES.includes(t.type)).reduce((s, t) => s + t.amount, 0)
  const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  // 잔액 = 이월금 + 수입 - 지출
  const balance = carryoverAmount + income - expense

  async function saveCarryover() {
    if (!currentClubId) return
    // 쉼표·공백 제거 후 숫자 변환 → '20,000,000' 또는 '20 000 000' 모두 허용
    const raw = (carryoverForm.amount ?? '').replace(/[^\d.-]/g, '')
    const amt = parseInt(raw || '0') || 0
    setCarryoverSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('clubs')
      .update({ carryover_amount: amt, carryover_note: carryoverForm.note.trim() || null })
      .eq('id', currentClubId)
    setCarryoverSaving(false)
    if (error) {
      if (error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703') {
        alert(ko ? 'DB 스키마 미적용 — 관리자가 SQL 한 줄을 실행해야 합니다 (공지 채팅 참조)' : 'Schema not applied yet')
      } else {
        alert(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`)
      }
      return
    }
    setShowCarryoverEdit(false)
    load()
  }

  const byType = Object.keys(TYPE_LABELS).reduce((acc, type) => {
    acc[type] = txns.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
    return acc
  }, {} as Record<string, number>)

  // 지출 분류별 합계 (expense type 만)
  const expenseTxns = txns.filter((t) => t.type === 'expense')
  const byExpenseCat = Object.keys(EXPENSE_CATEGORY_LABELS).reduce((acc, cat) => {
    acc[cat] = expenseTxns.filter((t) => t.expense_category === cat).reduce((s, t) => s + t.amount, 0)
    return acc
  }, {} as Record<string, number>)
  const expenseUncategorized = expenseTxns.filter((t) => !t.expense_category).reduce((s, t) => s + t.amount, 0)

  // ── fee payment status (computed — visible to ALL members) ────────────
  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1   // 1-12
  const feeTxnsThisYear = txns.filter(
    (t) => t.type === 'fee' && t.transaction_date?.startsWith(String(currentYear))
  )

  // n번째 요일 — getNthWeekday (week_of_month 1~5, day_of_week 0=일)
  function getNthWeekday(y: number, m: number, week: number, dow: number): Date | null {
    const first = new Date(y, m - 1, 1)
    let diff = dow - first.getDay()
    if (diff < 0) diff += 7
    const day = 1 + diff + (week - 1) * 7
    if (day > new Date(y, m, 0).getDate()) return null
    return new Date(y, m - 1, day)
  }
  // 특정 월의 실제 월례회 날짜 (override 우선) — 취소/없으면 null
  function meetingDateOf(year: number, month: number): Date | null {
    const ov = meetingOverrides.find((o: any) => o.year === year && o.month === month)
    if (ov?.status === 'cancelled') return null
    if (ov?.status === 'rescheduled' && ov.override_date) {
      return new Date(ov.override_date + 'T00:00:00')
    }
    if (!meetingPattern) return null
    return getNthWeekday(year, month, meetingPattern.week_of_month, meetingPattern.day_of_week)
  }
  // 회비 미납 카운트의 마지막 월 — "이번 달 월례회가 이미 지났는가?" 기준
  //   · 월례회 패턴 없음    → 보수적으로 currentMonth (기존 동작)
  //   · 이번 달 취소        → currentMonth - 1
  //   · 이번 달 일자 < 오늘 → currentMonth   (월례회 통과)
  //   · 일자 >= 오늘        → currentMonth - 1 (아직 월례회 전)
  function cutoffMonth(): number {
    if (!meetingPattern) return currentMonth
    const today = new Date(); today.setHours(0,0,0,0)
    const d = meetingDateOf(currentYear, currentMonth)
    if (!d) return currentMonth - 1   // 이번 달 월례회 취소 → 카운트 안 함
    return today > d ? currentMonth : currentMonth - 1
  }
  const cutoffM = cutoffMonth()

  // 회원별 (year 기준) 납부 월 집합 — 월납 회원 차감 계산용
  const paidMonthsByMember = new Map<string, Set<number>>()
  // 회원별 (year 기준) 총 납부 금액 — 합산 표시용
  const paidAmountByMember = new Map<string, number>()
  for (const t of feeTxnsThisYear) {
    if (!t.member_id) continue
    const mm = Number(String(t.transaction_date).slice(5, 7))
    if (!paidMonthsByMember.has(t.member_id)) paidMonthsByMember.set(t.member_id, new Set())
    paidMonthsByMember.get(t.member_id)!.add(mm)
    paidAmountByMember.set(t.member_id, (paidAmountByMember.get(t.member_id) ?? 0) + Number(t.amount ?? 0))
  }

  // 회원별 회비 시작 월 — joined_at 이 올해면 그 달부터, 아니면 1월
  function memberStartMonth(m: any): number {
    const ja = m.joined_at ? String(m.joined_at) : null
    if (!ja) return 1
    if (!ja.startsWith(String(currentYear))) return 1   // 이전 연도 가입자는 1월부터
    const mm = Number(ja.slice(5, 7))
    return mm >= 1 && mm <= 12 ? mm : 1
  }

  // 회원별 미납 판정 — fee_type 별 분기 + joined_at + 월례회 통과 기준 반영
  // 핵심 규칙: 이번 달 월례회가 아직 안 끝났으면 이번 달은 미납 카운트에서 제외
  function isMemberPaid(m: any): boolean {
    const ft = m.fee_type as 'annual'|'monthly'|null
    const paidMonths = paidMonthsByMember.get(m.user_id)
    if (ft === 'monthly') {
      const startM = memberStartMonth(m)
      // 가입월이 카운트 한계보다 뒤거나, 카운트 한계가 0 이하면 아직 회비 의무 없음
      if (startM > cutoffM || cutoffM < 1) return true
      if (!paidMonths) return false
      for (let mm = startM; mm <= cutoffM; mm++) if (!paidMonths.has(mm)) return false
      return true
    }
    // annual 또는 미지정 — 올해 회비 트랜잭션 1건 이상이면 납부
    return !!paidMonths && paidMonths.size > 0
  }

  // 미납 회원별 추가 정보 (월납이면 미납 월 목록 — 월례회 통과 기준 적용)
  function memberUnpaidInfo(m: any): { months: number[]; expected: number } {
    const ft = m.fee_type as 'annual'|'monthly'|null
    if (ft === 'monthly') {
      const paid = paidMonthsByMember.get(m.user_id) ?? new Set<number>()
      const startM = memberStartMonth(m)
      const months: number[] = []
      if (cutoffM >= startM) {
        for (let mm = startM; mm <= cutoffM; mm++) if (!paid.has(mm)) months.push(mm)
      }
      return { months, expected: months.length * (clubFees.monthly || 0) }
    }
    return { months: [], expected: clubFees.annual || 0 }
  }

  // 회비 의무 보유 여부 — 게스트·준회원·미설정·미래 가입자는 제외
  function hasFeeObligation(m: any): boolean {
    if (m.role === 'guest') return false                  // 게스트는 회비 면제
    if (m.role === 'associate') return false              // 준회원 — 참석 시에만 납부
    const ft = m.fee_type as 'annual'|'monthly'|null
    if (!ft) return false                                 // fee_type 미설정 = 면제
    if (ft === 'monthly') {
      const startM = memberStartMonth(m)
      if (startM > cutoffM || cutoffM < 1) return false   // 의무 시작 전
    }
    return true
  }
  const obligatedMembers = members.filter(hasFeeObligation)
  const paidMembers = obligatedMembers.filter((m) => isMemberPaid(m)).map((m: any) => {
    const txn = feeTxnsThisYear.find((t) => t.member_id === m.user_id)
    return { ...m, amount: paidAmountByMember.get(m.user_id) ?? txn?.amount, date: txn?.transaction_date }
  })
  const unpaidMembers = obligatedMembers.filter((m) => !isMemberPaid(m))
  const paidCount   = paidMembers.length
  const unpaidCount = unpaidMembers.length

  // ── add transaction ────────────────────────────────────────────────────
  async function addTransaction() {
    if (!form.amount || !form.description) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let desc = form.description
    let memberId: string | null = form.memberId || null

    // free-text member name: prepend to description, no member_id
    if (!memberId && form.memberNameText.trim()) {
      desc = `[${form.memberNameText.trim()}] ${desc}`
      memberId = null
    }

    const payload = {
      club_id: currentClubId, type: form.type, amount: parseInt(form.amount),
      currency, description: desc, transaction_date: form.date,
      member_id: memberId,
      expense_category: form.type === 'expense' ? form.expense_category : null,
      item_name: form.type === 'expense' && form.expense_category === 'gift' && form.item_name.trim()
        ? form.item_name.trim() : null,
    }

    if (editingId) {
      // 수정 — recorded_by 는 그대로 유지
      const { error } = await supabase.from('finance_transactions').update(payload).eq('id', editingId)
      if (error) { console.error('[finance update]', error); alert(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`); return }
    } else {
      const { error } = await supabase.from('finance_transactions').insert({ ...payload, recorded_by: user!.id })
      if (error) { console.error('[finance insert]', error); alert(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`); return }
    }

    setShowAdd(false)
    setEditingId(null)
    setForm({
      type: 'fee', amount: '', description: '',
      date: new Date().toISOString().split('T')[0], memberId: '', memberNameText: '',
      expense_category: 'event', item_name: '',
    })
    setMemberInputTab('select')
    load()
  }

  // ── receipt OCR ───────────────────────────────────────────────────────
  async function handleReceiptScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/)
      const mediaType = (mimeMatch?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      const base64 = dataUrl.split(',')[1]
      const res = await fetch('/api/ocr/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, mediaType, currency, lang }) })
      const data = await res.json()
      if (data.items) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        for (const item of data.items) {
          await supabase.from('finance_transactions').insert({
            club_id: currentClubId, type: 'expense', amount: item.amount,
            currency, description: item.description, transaction_date: new Date().toISOString().split('T')[0],
            recorded_by: user!.id, ocr_items: data.items,
          })
        }
        load()
      }
      setOcrLoading(false)
    }
    reader.readAsDataURL(file)
  }

  // ── payment info ───────────────────────────────────────────────────────
  function handleQrFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setQrFile(file)
    const reader = new FileReader()
    reader.onload = () => setQrPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function savePaymentInfo() {
    if (!currentClubId) return
    setPaySaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let qrImageUrl = payInfo?.qr_image_url ?? null

    if (qrFile) {
      const ext = qrFile.name.split('.').pop()
      const path = `payment/${currentClubId}/qr.${ext}`
      const { error: upErr } = await supabase.storage.from('club-media').upload(path, qrFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('club-media').getPublicUrl(path)
        qrImageUrl = urlData.publicUrl
      }
    }

    await supabase.from('club_payment_info').upsert({
      club_id:      currentClubId,
      bank_name:    payForm.bankName    || null,
      bank_account: payForm.bankAccount || null,
      bank_holder:  payForm.bankHolder  || null,
      qr_image_url: qrImageUrl,
      memo:         payForm.memo        || null,
      updated_by:   user!.id,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'club_id' })

    setPaySaving(false)
    setShowPayEdit(false)
    setQrFile(null)
    setQrPreview(null)
    load()
  }

  async function copyAccount() {
    if (!payInfo?.bank_account) return
    await navigator.clipboard.writeText(payInfo.bank_account)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── save fine rules ────────────────────────────────────────────────────
  async function saveFineRules() {
    if (!currentClubId) return
    setFineSaving(true)
    const supabase = createClient()
    await supabase.from('clubs').update({
      fine_handicap_per_stroke: fineForm.perStroke ? parseInt(fineForm.perStroke) : null,
      fine_handicap_max:        fineForm.max       ? parseInt(fineForm.max)       : null,
      fine_notes:               fineForm.notes     || null,
    }).eq('id', currentClubId)
    setFineSaving(false)
    setShowFineEdit(false)
    load()
  }

  // ── 납부확인 저장 ──────────────────────────────────────────────────────
  async function confirmPayment() {
    if (!payingMember || !payingAmount) return
    const amount = parseInt((payingAmount || '0').replace(/[^\d]/g, '')) || 0
    if (amount <= 0) return
    setPayingSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const memberName = lang === 'ko'
      ? payingMember.users?.full_name
      : (payingMember.users?.full_name_en || payingMember.users?.full_name)

    if (feeKind === 'monthly' && clubFees.monthly > 0) {
      // ── 월납 — 입금액을 monthly_fee 로 차감하며 미납 월에 1행씩 분배 ───
      const info = memberUnpaidInfo(payingMember)
      const unpaidMonths = info.months  // [Jan..currentMonth] 중 미납인 월
      const monthly = clubFees.monthly
      let remaining = amount
      const rows: any[] = []
      const coveredMonths: number[] = []

      for (const mm of unpaidMonths) {
        if (remaining < monthly) break
        coveredMonths.push(mm)
        remaining -= monthly
        rows.push({
          club_id:          currentClubId,
          type:             'fee',
          amount:           monthly,
          currency,
          description:      ko ? `${memberName} ${mm}월 회비 납부` : `${memberName} ${mm} fee payment`,
          transaction_date: `${currentYear}-${String(mm).padStart(2,'0')}-15`,
          recorded_by:      user!.id,
          member_id:        payingMember.user_id,
        })
      }

      if (rows.length === 0) {
        setPayingSaving(false)
        alert(ko
          ? `입금액(${sym}${amount.toLocaleString()})이 월회비(${sym}${monthly.toLocaleString()}) 미만입니다.`
          : `Amount is less than monthly fee.`)
        return
      }

      // 남는 금액(부분 납부) — 다음 미납 월에 부분 납부로 기록
      if (remaining > 0) {
        const nextMm = unpaidMonths[coveredMonths.length]
        if (nextMm) {
          rows.push({
            club_id:          currentClubId,
            type:             'fee',
            amount:           remaining,
            currency,
            description:      ko
              ? `${memberName} ${nextMm}월 회비 부분납부 (잔액 ${sym}${(monthly - remaining).toLocaleString()})`
              : `${memberName} ${nextMm} partial fee (remaining ${sym}${(monthly - remaining).toLocaleString()})`,
            transaction_date: `${currentYear}-${String(nextMm).padStart(2,'0')}-15`,
            recorded_by:      user!.id,
            member_id:        payingMember.user_id,
          })
        } else {
          // 미납 월 다 채우고도 남은 금액 — 단순 회비 잔액으로 기록 (현재월 날짜)
          rows.push({
            club_id:          currentClubId,
            type:             'fee',
            amount:           remaining,
            currency,
            description:      ko ? `${memberName} 선납 잔액` : `${memberName} prepay balance`,
            transaction_date: payingDate,
            recorded_by:      user!.id,
            member_id:        payingMember.user_id,
          })
        }
      }

      const { error } = await supabase.from('finance_transactions').insert(rows)
      setPayingSaving(false)
      if (error) { alert(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`); return }
    } else {
      // ── 년납 — 단일 트랜잭션 ───────────────────────────────────────────
      const { error } = await supabase.from('finance_transactions').insert({
        club_id:          currentClubId,
        type:             'fee',
        amount,
        currency,
        description:      ko ? `${memberName} 회비 납부 (년납)` : `${memberName} fee payment (annual)`,
        transaction_date: payingDate,
        recorded_by:      user!.id,
        member_id:        payingMember.user_id,
      })
      setPayingSaving(false)
      if (error) { alert(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`); return }
    }

    setPayingMember(null)
    setPayingAmount('')
    setPayingDate(new Date().toISOString().split('T')[0])
    load()
  }

  // ── helper: extract free-text member name from description ────────────
  function extractMemberName(t: any): string | null {
    if (t.users?.full_name) return null // has real FK join — handled elsewhere
    const match = t.description?.match(/^\[(.+?)\]/)
    return match ? match[1] : null
  }

  // ── 개인 회비 내역 로드 (강한 체인: 항상 DB 직접 조회) ───────────────
  async function loadFeeHistory(memberRow: any) {
    if (!currentClubId || !memberRow?.user_id) return
    setFeeHistoryLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('id, transaction_date, amount, description, type, recorded_by, recorder:users!recorded_by(full_name, full_name_en)')
      .eq('club_id', currentClubId)
      .eq('member_id', memberRow.user_id)
      .eq('type', 'fee')
      .order('transaction_date', { ascending: false })
    if (error) console.warn('[fee history]', error)
    setFeeHistoryTxns(data ?? [])
    setFeeHistoryLoading(false)
  }
  function openFeeHistory(m: any) {
    setFeeHistoryMember(m)
    setAddPayForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' })
    setAddPayError(null)
    loadFeeHistory(m)
  }

  // ── 회비 추가 등록 — 다중 트리 검증 + 재조회 체인 ────────────────────
  async function addFeePaymentForMember() {
    if (!feeHistoryMember || !currentClubId) return
    setAddPayError(null)
    const amt = parseInt((addPayForm.amount || '0').replace(/[^\d]/g, '')) || 0
    if (amt <= 0) { setAddPayError(ko ? '금액을 입력하세요' : 'Enter amount'); return }
    if (!addPayForm.date) { setAddPayError(ko ? '날짜를 선택하세요' : 'Pick a date'); return }

    const memberName = lang === 'ko'
      ? feeHistoryMember.users?.full_name
      : (feeHistoryMember.users?.full_name_en || feeHistoryMember.users?.full_name)
    const month = Number(addPayForm.date.slice(5, 7))
    const description = (addPayForm.note?.trim())
      || (feeHistoryMember.fee_type === 'annual'
            ? `${memberName} 회비 납부 (년납)`
            : `${memberName} ${month}월 회비 납부`)

    setAddPaySaving(true)
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const { error } = await supabase.from('finance_transactions').insert({
      club_id:          currentClubId,
      type:             'fee',
      amount:           amt,
      currency,
      description,
      transaction_date: addPayForm.date,
      recorded_by:      authUser?.id ?? null,
      member_id:        feeHistoryMember.user_id,
    })
    setAddPaySaving(false)
    if (error) { setAddPayError(ko ? `저장 실패: ${error.message}` : `Save failed: ${error.message}`); return }
    // 강한 체인: 폼 리셋 → 개인 내역 재조회 → 전체 재무 재조회
    setAddPayForm({ amount:'', date: new Date().toISOString().split('T')[0], note:'' })
    await loadFeeHistory(feeHistoryMember)
    await load()
  }

  // ── 회비 거래 삭제 (총무 전용) ────────────────────────────────────────
  async function deleteFeeTxn(txnId: string) {
    if (!currentClubId || !canManage) return
    if (!confirm(ko ? '이 회비 거래를 삭제하시겠습니까?' : 'Delete this fee transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('finance_transactions')
      .delete().eq('id', txnId).eq('type', 'fee').eq('club_id', currentClubId)
    if (error) { alert(error.message); return }
    if (feeHistoryMember) await loadFeeHistory(feeHistoryMember)
    await load()
  }

  // ── render ─────────────────────────────────────────────────────────────
  // 게스트는 재무 정보 열람 불가 — 친화적 안내 화면만 노출
  if (isGuest) {
    return (
      <div className="px-4 py-8 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <Wallet size={28} className="text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white">
          {ko ? '재무 정보 열람 권한 없음' : 'Finance access restricted'}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: '#9ca3af', maxWidth: 280 }}>
          {ko
            ? '회비·지출 등 재무 정보는 정회원 전용입니다. 게스트는 정기모임·조 편성 등 기본 기능만 이용 가능합니다.'
            : 'Finance details are for full members only. Guests can access meetings and group assignments.'}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 space-y-4">

      {/* 잔액 요약 */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">{ko ? '총 잔액' : 'Balance'}</span>
          <Wallet size={18} className="text-green-400" />
        </div>
        <p className="text-2xl font-bold text-white">{sym}{balance.toLocaleString()}</p>
        <div className="flex gap-4 flex-wrap">
          {carryoverAmount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">📦</span>
              <span className="text-xs text-gray-400">{ko ? '이월금' : 'Carryover'}: <span className="text-amber-300">{sym}{carryoverAmount.toLocaleString()}</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-xs text-gray-400">{ko ? '수입' : 'Income'}: <span className="text-green-400">{sym}{income.toLocaleString()}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-gray-400">{ko ? '지출' : 'Expense'}: <span className="text-red-400">{sym}{expense.toLocaleString()}</span></span>
          </div>
        </div>
      </div>

      {/* ━━ 이전 이월금 카드 — 임원이 편집 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(carryoverAmount > 0 || canManage) && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(6,13,6,0.95))', border: '1px solid rgba(245,158,11,0.25)' }}>
          {/* 헤더 — 클릭으로 펼치기/접기 */}
          <button
            onClick={() => setShowCarryover(v => !v)}
            className="w-full px-4 py-3 flex items-center gap-3 text-left">
            <span className="text-xl flex-shrink-0 leading-none">📦</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                {ko ? '이전 이월금' : 'Carryover'}
                <span className="ml-2 text-xs font-bold text-white">{sym}{carryoverAmount.toLocaleString()}</span>
              </p>
            </div>
            {showCarryover ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
          </button>
          {showCarryover && (
            <div className="px-4 pb-3 pt-1" style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}>
              {carryoverNote && (
                <p className="text-xs italic" style={{ color: '#fcd34d' }}>“{carryoverNote}”</p>
              )}
              {canManage && (
                <button
                  onClick={() => {
                    setCarryoverForm({
                      amount: carryoverAmount ? carryoverAmount.toLocaleString() : '',
                      note: carryoverNote || '',
                    })
                    setShowCarryoverEdit(true)
                  }}
                  className="mt-2 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.35)' }}>
                  <Edit2 size={11} />{ko ? '이월금 수정' : 'Edit'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 이월금 편집 모달 */}
      {showCarryoverEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setShowCarryoverEdit(false)}>
          <div className="bg-gray-900 rounded-t-3xl px-6 pt-6 modal-sheet-pb w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">{ko ? '이전 이월금 편집' : 'Edit Carryover'}</h3>
            <p className="text-[11px]" style={{ color: '#fcd34d' }}>
              💡 {ko ? '이전 회계 기간에서 넘어온 잔액을 입력하세요. 잔액 계산에 자동 포함됩니다.' : 'Enter balance carried over from previous period.'}
            </p>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? `금액 (${sym})` : `Amount (${sym})`}</label>
              <input
                type="text"
                inputMode="numeric"
                value={carryoverForm.amount}
                onChange={e => {
                  // 숫자만 추출 → 자동 쉼표 포맷
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  const formatted = raw ? Number(raw).toLocaleString() : ''
                  setCarryoverForm(f => ({ ...f, amount: formatted }))
                }}
                onWheel={e => (e.target as HTMLInputElement).blur()}  // 스크롤 변경 차단
                placeholder="0"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg" />
              {carryoverForm.amount && (
                <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>
                  💰 {sym}{carryoverForm.amount}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '메모 (선택)' : 'Note (optional)'}</label>
              <input
                value={carryoverForm.note}
                onChange={e => setCarryoverForm(f => ({ ...f, note: e.target.value }))}
                placeholder={ko ? '예: 2025년 이월' : 'e.g. From 2025'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCarryoverEdit(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={saveCarryover} disabled={carryoverSaving}
                className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                {carryoverSaving ? (ko ? '저장 중...' : 'Saving...') : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━ 회비 납부 현황 — 모두 열람 가능, 미납자 명단은 임원만 ━━━━━━━━━━ */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          className="w-full px-4 py-3.5 flex items-center gap-3"
          onClick={() => setShowFeeStatus(v => !v)}
        >
          <span className="text-sm font-semibold text-white flex-1 text-left">
            {ko ? `회비 납부 현황 (${currentYear}년)` : `Fee Status (${currentYear})`}
          </span>
          <span className="text-xs mr-1" style={{ color: '#9aae9a' }}>
            {ko
              ? `납부 ${paidCount}명 / 미납 ${unpaidCount}명`
              : `Paid ${paidCount} / Unpaid ${unpaidCount}`}
          </span>
          {showFeeStatus ? <ChevronUp size={14} style={{ color: '#9aae9a' }} /> : <ChevronDown size={14} style={{ color: '#9aae9a' }} />}
        </button>
        {showFeeStatus && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
            {/* 납부 완료 — 임원·고문: 전체 명단 / 일반 회원: 본인 카드만 + 명수 안내 */}
            {paidMembers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold mb-2" style={{ color: '#4ade80' }}>
                  ✅ {ko ? `납부 완료 (${paidMembers.length}명)` : `Paid (${paidMembers.length})`}
                </p>
                {(() => {
                  const visible = canViewFinance
                    ? paidMembers
                    : paidMembers.filter((m: any) => m.user_id === user?.id)
                  return (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {visible.map((m: any) => {
                          const canOpen = canViewFinance || m.user_id === user?.id
                          const ChipInner = (
                            <>
                              <span>
                                {lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                                {!canViewFinance && m.user_id === user?.id && (
                                  <span className="ml-1 text-[9px]" style={{ color: '#86efac' }}>({ko ? '본인' : 'You'})</span>
                                )}
                              </span>
                              {m.amount ? (
                                <span className="text-[10px] mt-0.5" style={{ color: '#86efac' }}>
                                  {sym}{Number(m.amount).toLocaleString()}{m.date ? ` · ${m.date.slice(5)}` : ''}
                                </span>
                              ) : null}
                            </>
                          )
                          return canOpen ? (
                            <button key={m.user_id} type="button"
                              onClick={() => openFeeHistory(m)}
                              className="inline-flex flex-col items-start px-2.5 py-1.5 rounded-xl text-xs font-medium transition active:scale-95 hover:opacity-80"
                              style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                              {ChipInner}
                            </button>
                          ) : (
                            <span key={m.user_id}
                              className="inline-flex flex-col items-start px-2.5 py-1.5 rounded-xl text-xs font-medium"
                              style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                              {ChipInner}
                            </span>
                          )
                        })}
                      </div>
                      {!canViewFinance && (
                        <p className="text-[10px] mt-1.5" style={{ color: '#9aae9a' }}>
                          {ko
                            ? `전체 납부자 명단은 회장·총무·감사·고문만 볼 수 있습니다.`
                            : `Only president/secretary/auditor/advisor can see the full paid list.`}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            {/* 미납 —
                - 회장·총무·감사·고문: 전체 명단 (canManage 는 탭으로 납부확인 모달)
                - 일반 회원: 본인 카드만 표시 + 전체 미납 인원수 안내 */}
            {unpaidMembers.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold mb-2" style={{ color: '#f87171' }}>
                  ❌ {ko ? `미납 (${unpaidMembers.length}명)` : `Unpaid (${unpaidMembers.length})`}
                </p>
                {(() => {
                  const visible = canViewFinance
                    ? unpaidMembers
                    : unpaidMembers.filter((m: any) => m.user_id === user?.id)
                  return (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {visible.map((m: any) => canManage ? (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() => {
                              setPayingMember(m)
                              // 회원의 fee_type 우선 — 없으면 클럽 설정에 있는 쪽으로 fallback
                              const kind: 'annual'|'monthly' =
                                (m.fee_type as 'annual'|'monthly'|null) ??
                                (clubFees.monthly > 0 ? 'monthly' : 'annual')
                              setFeeKind(kind)
                              const info = memberUnpaidInfo(m)
                              const defaultAmt = kind === 'monthly'
                                ? info.expected || clubFees.monthly || 0
                                : clubFees.annual || 0
                              setPayingAmount(defaultAmt ? String(defaultAmt) : '')
                              setPayingDate(new Date().toISOString().split('T')[0])
                            }}
                            className="inline-flex flex-col items-start px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80 active:scale-95"
                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                          >
                            <span>{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</span>
                            {(() => {
                              const info = memberUnpaidInfo(m)
                              if (m.fee_type === 'monthly' && info.months.length > 0) {
                                return (
                                  <span className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>
                                    {info.months.length}{ko ? '개월 미납' : ' months unpaid'}
                                  </span>
                                )
                              }
                              return (
                                <span className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>
                                  {ko ? '탭하여 납부확인' : 'Tap to confirm'}
                                </span>
                              )
                            })()}
                          </button>
                        ) : (
                          <span
                            key={m.user_id}
                            className="inline-flex flex-col items-start px-2.5 py-1.5 rounded-xl text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                          >
                            <span>
                              {lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}
                              {!canViewFinance && m.user_id === user?.id && (
                                <span className="ml-1 text-[9px]" style={{ color: '#fca5a5' }}>({ko ? '본인' : 'You'})</span>
                              )}
                            </span>
                            {(() => {
                              const info = memberUnpaidInfo(m)
                              if (m.fee_type === 'monthly' && info.months.length > 0) {
                                return (
                                  <span className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>
                                    {info.months.length}{ko ? '개월 미납' : ' months unpaid'}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </span>
                        ))}
                      </div>
                      {!canViewFinance && (
                        <p className="text-[10px] mt-1.5" style={{ color: '#9aae9a' }}>
                          {ko
                            ? `전체 미납자 명단은 회장·총무·감사·고문만 볼 수 있습니다.`
                            : `Only president/secretary/auditor/advisor can see the full unpaid list.`}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
            {paidMembers.length === 0 && unpaidMembers.length === 0 && (
              <p className="text-xs text-gray-400 mt-3 text-center">{ko ? '회원 데이터가 없습니다' : 'No member data'}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 송금 정보 카드 — 평상시 접힘, 헤더 탭하면 펼침 ── */}
      {(payInfo || canManage) && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowPayInfo(v => !v)}
            className="w-full px-4 py-3.5 flex items-center gap-3"
          >
            <Building2 size={16} className="text-blue-400" />
            <p className="text-sm font-semibold text-white flex-1 text-left">{ko ? '회비 납부 계좌' : 'Payment Account'}</p>
            {payInfo?.bank_name && (
              <span className="text-xs mr-1 truncate max-w-[140px]" style={{ color: '#9aae9a' }}>
                {payInfo.bank_name}
              </span>
            )}
            {showPayInfo
              ? <ChevronUp   size={14} style={{ color: '#9aae9a' }} />
              : <ChevronDown size={14} style={{ color: '#9aae9a' }} />}
          </button>
          {showPayInfo && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
              {canManage && (
                <div className="flex justify-end pt-3">
                  <button onClick={() => setShowPayEdit(true)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-400 transition border border-gray-700 hover:border-green-700 rounded-full px-2.5 py-1">
                    <Edit2 size={11} />{ko ? '편집' : 'Edit'}
                  </button>
                </div>
              )}

              {payInfo ? (
                <div className="flex gap-3">
                  {/* 텍스트 정보 */}
                  <div className="flex-1 space-y-2">
                    {payInfo.bank_name && (
                      <div>
                        <p className="text-xs text-gray-400">{ko ? '은행/앱' : 'Bank'}</p>
                        <p className="text-sm font-semibold text-white">{payInfo.bank_name}</p>
                      </div>
                    )}
                    {payInfo.bank_account && (
                      <div>
                        <p className="text-xs text-gray-400">{ko ? '계좌번호' : 'Account No.'}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono text-white">{payInfo.bank_account}</p>
                          <button onClick={copyAccount}
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg transition ${copied ? 'bg-green-800 text-green-300' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                            {copied ? <Check size={11} /> : <Copy size={11} />}
                            {copied ? (ko ? '복사됨' : 'Copied') : (ko ? '복사' : 'Copy')}
                          </button>
                        </div>
                      </div>
                    )}
                    {payInfo.bank_holder && (
                      <div>
                        <p className="text-xs text-gray-400">{ko ? '예금주' : 'Holder'}</p>
                        <p className="text-sm text-white">{payInfo.bank_holder}</p>
                      </div>
                    )}
                    {payInfo.memo && (
                      <p className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 rounded-lg px-2.5 py-1.5 mt-1">
                        {payInfo.memo}
                      </p>
                    )}
                  </div>

                  {/* QR / 통장 이미지 */}
                  {payInfo.qr_image_url && (
                    <button onClick={() => setViewQr(true)}
                      className="flex-shrink-0 w-20 h-20 bg-white rounded-xl overflow-hidden flex items-center justify-center border border-gray-700 hover:border-green-500 transition">
                      <img src={payInfo.qr_image_url} alt="QR" className="w-full h-full object-contain" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <QrCode size={28} className="text-gray-400" />
                  <p className="text-xs text-gray-400">
                    {ko ? '총무가 계좌 정보를 등록하면 여기에 표시됩니다.' : 'Secretary can register payment info here.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 임원용 유형별 상세 */}
      {isOfficer && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-3">
            {ko ? '유형별 내역 (임원 전용)' : 'Breakdown by Type (Officers)'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TYPE_LABELS).map(([type, [labelKo, labelEn]]) => (
              <div key={type} className="bg-gray-800/60 rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-gray-400">{ko ? labelKo : labelEn}</span>
                <span className={`text-xs font-semibold ${type === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
                  {sym}{(byType[type] ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 지출 분류별 (전 회원 열람 — 투명성) */}
      {expenseTxns.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#fbbf24' }}>
              {ko ? '지출 분류별' : 'Expenses by Category'}
            </p>
            <p className="text-[11px] text-gray-400">
              {ko ? `총 ${sym}${byType.expense.toLocaleString()}` : `Total ${sym}${byType.expense.toLocaleString()}`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([cat, [labelKo, labelEn]]) => {
              const amt = byExpenseCat[cat] ?? 0
              if (amt === 0) return null
              const pct = byType.expense > 0 ? Math.round((amt / byType.expense) * 100) : 0
              return (
                <div key={cat} className="bg-gray-800/60 rounded-xl px-3 py-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-300">{ko ? labelKo : labelEn}</span>
                    <span className="text-xs font-semibold text-red-400">
                      {sym}{amt.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#fbbf24,#a07830)' }} />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: '#a3a3a3' }}>{pct}%</p>
                </div>
              )
            })}
            {expenseUncategorized > 0 && (
              <div className="bg-gray-800/60 rounded-xl px-3 py-2.5 col-span-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">{ko ? '미분류 지출' : 'Uncategorized'}</span>
                  <span className="text-xs font-semibold text-gray-400">{sym}{expenseUncategorized.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 관리 버튼 */}
      {canManage && (
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-medium transition">
            <Plus size={16} /> {ko ? '내역 추가' : 'Add Transaction'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={ocrLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 py-3 rounded-xl text-sm font-medium transition">
            <Camera size={16} /> {ocrLoading ? (ko ? '분석 중...' : 'Scanning...') : (ko ? '영수증 촬영' : 'Scan Receipt')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptScan} />
        </div>
      )}

      {/* 거래 내역 — 월별 아코디언 + 분류별 그룹화 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          📁 {ko ? '월별 거래 내역' : 'Transactions by Month'}
          <span className="text-[10px] font-normal" style={{ color: '#9aae9a' }}>
            {ko ? '(개인 회비 제외)' : '(excl. personal fees)'}
          </span>
        </h3>
        {(() => {
          // 회원별 회비 납부(type=fee + member_id) 만 숨김
          const visibleTxns = txns.filter(t => !(t.type === 'fee' && t.member_id))
          if (loading) return <p className="text-center text-gray-400 py-6">{ko ? '로딩 중...' : 'Loading...'}</p>
          if (visibleTxns.length === 0) return <p className="text-center text-gray-400 py-6">{ko ? '내역이 없습니다' : 'No transactions'}</p>

          // 1) 월별 그룹화
          const byMonth: Record<string, any[]> = {}
          visibleTxns.forEach(t => {
            const ym = (t.transaction_date ?? '').slice(0, 7) || 'unknown'
            ;(byMonth[ym] = byMonth[ym] || []).push(t)
          })
          const months = Object.keys(byMonth).sort().reverse()

          return months.map(ym => {
            const items = byMonth[ym]
            const isOpen = expandedMonth === ym || (expandedMonth === null && ym === months[0])
            // 월 통계
            const income  = items.filter(t => INCOME_TYPES.includes(t.type)).reduce((s, t) => s + Number(t.amount), 0)
            const expense = items.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
            const net = income - expense
            const [y, m] = ym.split('-')
            const monthLabel = ym === 'unknown' ? (ko ? '날짜 없음' : 'Undated') : (ko ? `${y}년 ${parseInt(m,10)}월` : `${y}.${m}`)

            return (
              <div key={ym} className="glass-card rounded-xl overflow-hidden">
                {/* 월 헤더 — 클릭 토글 */}
                <button onClick={() => setExpandedMonth(isOpen ? '' : ym)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left transition"
                  style={{ background: isOpen ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{monthLabel}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]">
                      {income > 0 && <span style={{ color: '#4ade80' }}>+{sym}{income.toLocaleString()}</span>}
                      {expense > 0 && <span style={{ color: '#f87171' }}>-{sym}{expense.toLocaleString()}</span>}
                      <span style={{ color: '#9ca3af' }}>· {items.length}건</span>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {net >= 0 ? '+' : ''}{sym}{net.toLocaleString()}
                  </span>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </button>

                {/* 본문 — 펼쳐지면 분류별 그룹 */}
                {isOpen && (() => {
                  // 분류별 그룹화 (지출 분류 + 수입 type)
                  const buckets: Record<string, { label: string; emoji: string; color: string; items: any[]; total: number }> = {}
                  items.forEach(t => {
                    let key: string, label: string, emoji: string, color: string
                    if (t.type === 'expense') {
                      const c = t.expense_category ?? 'other'
                      key = `exp:${c}`
                      const map: Record<string,[string,string]> = {
                        condolence: ['🌸','경조사'], gift: ['🎁','상품·화환'],
                        event: ['🎉','모임 운영'], admin: ['🏢','사무비'], other: ['📦','기타 지출'],
                      }
                      const [e, l] = map[c] ?? ['📦','기타 지출']
                      emoji = e; label = l; color = '#fca5a5'
                    } else if (t.type === 'fee') {
                      key = 'fee'; emoji = '💰'; label = '회비 (클럽 적립)'; color = '#4ade80'
                    } else if (t.type === 'donation') {
                      key = 'donation'; emoji = '💝'; label = '찬조'; color = '#c4b5fd'
                    } else if (t.type === 'fine') {
                      key = 'fine'; emoji = '⚠️'; label = '벌금'; color = '#fbbf24'
                    } else {
                      key = 'other'; emoji = '📌'; label = '기타'; color = '#9ca3af'
                    }
                    if (!buckets[key]) buckets[key] = { label, emoji, color, items: [], total: 0 }
                    buckets[key].items.push(t)
                    buckets[key].total += Number(t.amount)
                  })
                  return (
                    <div className="px-3 py-2 space-y-2" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
                      {Object.entries(buckets).map(([k, b]) => (
                        <div key={k} className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)' }}>
                          <div className="px-3 py-2 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: b.color }}>
                              <span>{b.emoji}</span> {b.label}
                              <span className="text-[10px] font-normal" style={{ color: '#94a3b8' }}>· {b.items.length}건</span>
                            </span>
                            <span className="text-xs font-bold" style={{ color: b.color }}>
                              {sym}{b.total.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            {b.items.map((t: any) => {
                              const isIncome = INCOME_TYPES.includes(t.type)
                              return (
                                <button key={t.id}
                                  onClick={() => setDetailTxn(t)}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left transition active:bg-white/[0.03]"
                                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white truncate">
                                      {t.description}
                                      {t.item_name && <span className="ml-1 text-[10px]" style={{ color: '#c4b5fd' }}>🎁 {t.item_name}</span>}
                                    </p>
                                    <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                                      {t.transaction_date?.slice(5) ?? ''}
                                      {(t.users?.full_name || extractMemberName(t)) && (
                                        <> · {t.users?.full_name ?? extractMemberName(t)}</>
                                      )}
                                    </p>
                                  </div>
                                  <span className={`text-xs font-semibold flex-shrink-0 ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                                    {isIncome ? '+' : '-'}{sym}{Number(t.amount).toLocaleString()}
                                  </span>
                                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )
          })
        })()}
      </div>

      {/* ── 내역 추가/수정 모달 ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => { setShowAdd(false); setEditingId(null) }}>
          <div className="bg-gray-900 rounded-t-3xl px-6 pt-6 modal-sheet-pb w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">
              {editingId
                ? (ko ? '내역 수정' : 'Edit Transaction')
                : (ko ? '내역 추가' : 'Add Transaction')}
            </h3>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '유형' : 'Type'}</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                {Object.entries(TYPE_LABELS).map(([v, [k, e]]) => <option key={v} value={v}>{ko ? k : e}</option>)}
              </select>
            </div>

            {/* 지출 분류 (type === 'expense' 일 때만) */}
            {form.type === 'expense' && (
              <>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">{ko ? '지출 분류' : 'Category'}</label>
                  <select
                    value={form.expense_category}
                    onChange={(e) => setForm((f) => ({ ...f, expense_category: e.target.value, item_name: e.target.value === 'gift' ? f.item_name : '' }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                  >
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, [k, en]]) => (
                      <option key={v} value={v}>{ko ? k : en}</option>
                    ))}
                  </select>
                </div>
                {form.expense_category === 'gift' && (
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">
                      {ko ? '물품명' : 'Item Name'}
                      <span className="text-[10px] ml-1 text-gray-400">{ko ? '(예: 근조화환, 골프공 1박스)' : '(e.g. Funeral wreath, Golf balls)'}</span>
                    </label>
                    <input
                      type="text"
                      value={form.item_name}
                      onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
                      placeholder={ko ? '물품명을 입력하세요' : 'Enter item name'}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                    />
                  </div>
                )}
              </>
            )}

            {/* 회원 선택 (전 유형) */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '관련 회원 (선택)' : 'Member (optional)'}</label>
              {/* tab switcher */}
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setMemberInputTab('select')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${memberInputTab === 'select' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {ko ? '회원 선택' : 'Select Member'}
                </button>
                <button
                  onClick={() => setMemberInputTab('text')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${memberInputTab === 'text' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {ko ? '직접 입력' : 'Free Text'}
                </button>
              </div>
              {memberInputTab === 'select' ? (
                <select value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value, memberNameText: '' }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                  <option value="">{ko ? '선택 안함' : 'None'}</option>
                  {members.map((m: any) => <option key={m.user_id} value={m.user_id}>{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.memberNameText}
                  onChange={(e) => setForm((f) => ({ ...f, memberNameText: e.target.value, memberId: '' }))}
                  placeholder={ko ? '이름 직접 입력...' : 'Enter name...'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white"
                />
              )}
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? `금액 (${sym})` : `Amount (${sym})`}</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" placeholder="0" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '내용' : 'Description'}</label>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '날짜' : 'Date'}</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowAdd(false); setEditingId(null); setMemberInputTab('select') }} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={addTransaction} className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">
                {editingId ? (ko ? '수정 저장' : 'Update') : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 송금 정보 편집 모달 (총무·회장 전용) ── */}
      {showPayEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setShowPayEdit(false)}>
          <div className="bg-gray-900 rounded-t-3xl px-5 pt-5 modal-sheet-pb w-full space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={18} className="text-blue-400" />
              <h3 className="text-base font-bold text-white flex-1">{ko ? '납부 계좌 등록' : 'Register Payment Info'}</h3>
              <button onClick={() => setShowPayEdit(false)} className="text-gray-400"><X size={18} /></button>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '은행 / 앱 이름' : 'Bank / App Name'}</label>
              <input
                value={payForm.bankName}
                onChange={e => setPayForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder={ko ? '예: Vietcombank, MoMo, ZaloPay' : 'e.g. Vietcombank, MoMo'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '계좌번호 / 전화번호' : 'Account No. / Phone'}</label>
              <input
                value={payForm.bankAccount}
                onChange={e => setPayForm(f => ({ ...f, bankAccount: e.target.value }))}
                placeholder="0123456789"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '예금주 / 수신자' : 'Account Holder'}</label>
              <input
                value={payForm.bankHolder}
                onChange={e => setPayForm(f => ({ ...f, bankHolder: e.target.value }))}
                placeholder={ko ? '예: 홍길동' : 'e.g. NGUYEN VAN A'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '안내 메모 (선택)' : 'Memo (optional)'}</label>
              <textarea
                rows={2}
                value={payForm.memo}
                onChange={e => setPayForm(f => ({ ...f, memo: e.target.value }))}
                placeholder={ko ? '예: 송금 시 성함 입력해주세요' : 'e.g. Please include your name in the transfer'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? 'QR코드 / 통장 사본 이미지' : 'QR Code / Passbook Image'}</label>
              {(qrPreview || payInfo?.qr_image_url) ? (
                <div className="relative">
                  <img
                    src={qrPreview ?? payInfo.qr_image_url}
                    alt="QR"
                    className="w-full max-h-48 object-contain rounded-xl bg-white"
                  />
                  <button
                    onClick={() => { setQrFile(null); setQrPreview(null); qrInputRef.current && (qrInputRef.current.value = '') }}
                    className="absolute top-2 right-2 bg-gray-900/80 rounded-full p-1 text-red-400 hover:text-red-300"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={() => qrInputRef.current?.click()}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-white py-2 border border-gray-700 rounded-xl transition"
                  >
                    {ko ? '이미지 교체' : 'Replace Image'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => qrInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-700 hover:border-green-700 rounded-xl transition text-gray-400 hover:text-green-400"
                >
                  <Upload size={22} />
                  <span className="text-xs">{ko ? '이미지 선택 (카메라 / 갤러리)' : 'Select Image (camera / gallery)'}</span>
                </button>
              )}
              <input
                ref={qrInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleQrFileChange}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowPayEdit(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={savePaymentInfo} disabled={paySaving}
                className="flex-1 py-3 rounded-xl bg-green-700 disabled:opacity-50 text-white font-semibold text-sm">
                {paySaving ? '...' : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━ 벌금 규정 (전 회원 열람, canManage 항상 표시) ━━━━━━━━━━━━━━━━━━ */}
      {(fineRules || canManage) && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div
            role="button"
            tabIndex={0}
            className="w-full px-4 py-3.5 flex items-center gap-3 cursor-pointer"
            onClick={() => setShowFineRules(v => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowFineRules(v => !v) } }}
          >
            <AlertTriangle size={16} style={{ color: '#fbbf24' }} className="flex-shrink-0" />
            <span className="text-sm font-semibold text-white flex-1 text-left">
              {ko ? '🏌️ 벌금 규정' : '🏌️ Fine Rules'}
            </span>
            {fineRules?.fine_handicap_per_stroke && (
              <span className="text-xs mr-1" style={{ color: '#9aae9a' }}>
                {sym}{Number(fineRules.fine_handicap_per_stroke).toLocaleString()}{ko ? '/타' : '/stroke'}
              </span>
            )}
            {canManage && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowFineEdit(true) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-400 transition border border-gray-700 hover:border-yellow-700 rounded-full px-2 py-0.5 mr-1"
                title={ko ? '벌금 규정 편집' : 'Edit fine rules'}
              >
                <Edit2 size={11} />
              </button>
            )}
            {showFineRules ? <ChevronUp size={14} style={{ color: '#9aae9a' }} /> : <ChevronDown size={14} style={{ color: '#9aae9a' }} />}
          </div>
          {showFineRules && (
            <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
              {fineRules?.fine_handicap_per_stroke ? (
                <div className="mt-3 rounded-xl px-3.5 py-3"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>
                    {ko ? '헨디오버 벌금' : 'Handicap-over fine'}
                  </p>
                  <p className="text-sm font-bold text-white">
                    {sym}{Number(fineRules.fine_handicap_per_stroke).toLocaleString()}
                    <span className="text-xs font-normal ml-1" style={{ color: '#a3b8a3' }}>{ko ? '/ 타당' : '/ stroke'}</span>
                    {fineRules.fine_handicap_max && (
                      <>
                        <span style={{ color: '#9aae9a' }}> · </span>
                        <span style={{ color: '#fde68a' }}>{ko ? '최고' : 'max'} </span>
                        {sym}{Number(fineRules.fine_handicap_max).toLocaleString()}
                      </>
                    )}
                  </p>
                </div>
              ) : canManage && (
                <p className="text-xs text-center mt-3" style={{ color: '#9aae9a' }}>
                  {ko ? '편집 버튼으로 벌금 규정을 설정하세요.' : 'Use the edit button to set fine rules.'}
                </p>
              )}
              {fineRules?.fine_notes && (
                <div className="rounded-xl px-3.5 py-3"
                  style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.1)' }}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#c0b060' }}>
                    {fineRules.fine_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ━━ 찬조 내역 (전 회원 열람, 임원이 추가/수정/삭제) ━━━━━━━━━━━━━━ */}
      {(sponsorships.length > 0 || canManage) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift size={14} style={{ color: '#a78bfa' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#a3b8a3' }}>{ko ? '찬조 내역' : 'Sponsorships'}</h3>
              <span className="text-[11px]" style={{ color: '#9aae9a' }}>
                ({sponsorships.length})
              </span>
            </div>
            {canManage && (
              <button
                onClick={() => { setSpForm(emptySpForm); setEditingSpId(null); setShowSpModal(true) }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition active:scale-95"
                style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }}>
                <Plus size={12} /> {ko ? '찬조 추가' : 'Add'}
              </button>
            )}
          </div>
          {sponsorships.length === 0 ? (
            <div className="glass-card rounded-xl py-6 text-center">
              <p className="text-sm" style={{ color: '#7a9a7a' }}>{ko ? '찬조 내역이 없습니다' : 'No sponsorships'}</p>
            </div>
          ) : sponsorships.map(s => {
            const cSym = { KRW: '₩', VND: '₫', IDR: 'Rp' }[s.currency as string] ?? sym
            const hasCash = s.amount != null && Number(s.amount) > 0
            const hasItem = !!s.item_description
            return (
              <div key={s.id} className="rounded-xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,13,6,0.95))', border: '1px solid rgba(124,58,237,0.25)' }}>
                <div className="px-4 py-3 flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 leading-none mt-0.5">
                    {hasCash && hasItem ? '💝' : hasItem ? '🎁' : '💰'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* 1행: 회원 이름 + 유형 뱃지(들) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-white font-bold text-sm">{s.member_name}</p>
                      {hasCash && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' }}>
                          💰 {ko ? '현금' : 'Cash'}
                        </span>
                      )}
                      {hasItem && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(244,114,182,0.2)', color: '#f9a8d4', border: '1px solid rgba(244,114,182,0.4)' }}>
                          🎁 {ko ? '상품' : 'Item'}
                        </span>
                      )}
                    </div>
                    {/* 2행: 현금 금액 (있으면) */}
                    {hasCash && (
                      <p className="text-base font-bold mt-1" style={{ color: '#86efac' }}>
                        +{cSym}{Number(s.amount).toLocaleString()}
                      </p>
                    )}
                    {/* 3행: 상품 정보 (있으면) */}
                    {hasItem && (
                      <div className="mt-1">
                        <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>{s.item_description}</p>
                        {s.estimated_value && (
                          <p className="text-[11px] mt-0.5" style={{ color: '#c4b5fd' }}>
                            ≈ {cSym}{Number(s.estimated_value).toLocaleString()} {ko ? '상당' : 'est.'}
                          </p>
                        )}
                      </div>
                    )}
                    {/* 4행: 메모 */}
                    {s.note && <p className="text-[11px] italic mt-1" style={{ color: '#9b8eb8' }}>“{s.note}”</p>}
                    {/* 5행: 날짜 + 임원 액션 */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px]" style={{ color: '#7a6a9a' }}>📅 {s.sponsor_date}</span>
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => startEditSponsorship(s)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-95"
                            style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd' }}>
                            <Edit2 size={11} />
                          </button>
                          <button onClick={() => deleteSponsorship(s.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-95"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ━━ 찬조 추가/수정 모달 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showSpModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => { setShowSpModal(false); setEditingSpId(null) }}>
          <div className="bg-gray-900 rounded-t-3xl px-6 pt-6 modal-sheet-pb w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">
              {editingSpId ? (ko ? '찬조 수정' : 'Edit Sponsorship') : (ko ? '찬조 추가' : 'Add Sponsorship')}
            </h3>
            <p className="text-[11px] -mt-2" style={{ color: '#86efac' }}>
              💡 {ko ? '한 회원이 현금·상품을 같이 찬조한 경우 양쪽 모두 입력하세요' : 'Fill both if cash + item donated together'}
            </p>
            <div className="rounded-lg px-3 py-2 -mt-1"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-[11px] font-bold" style={{ color: '#fca5a5' }}>
                ⚠️ {ko ? '회비 (월·연회비)는 찬조에 입력하지 마세요' : 'Do NOT enter membership fees here'}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: '#fcd34d' }}>
                {ko ? '회비는 위 "회비 납부 현황" 섹션의 미납 회원 카드를 탭해 등록하세요' : 'Use "회비 납부 현황" section above'}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '찬조한 회원' : 'Sponsor'}</label>
              <input value={spForm.member_name} onChange={e => setSpForm(f => ({ ...f, member_name: e.target.value }))}
                placeholder={ko ? '회원 이름' : 'Member name'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>

            {/* 💰 현금 섹션 */}
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <p className="text-sm font-bold text-white">{ko ? '현금' : 'Cash'}</p>
                <span className="text-[10px] ml-auto" style={{ color: '#86efac' }}>
                  {ko ? '비워두면 현금 없음' : 'Leave blank if no cash'}
                </span>
              </div>
              <input type="number" inputMode="numeric" value={spForm.amount}
                onChange={e => setSpForm(f => ({ ...f, amount: e.target.value }))}
                placeholder={ko ? `금액 (${sym})` : `Amount (${sym})`}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm" />
            </div>

            {/* 🎁 상품 섹션 */}
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: 'rgba(244,114,182,0.06)', border: '1px solid rgba(244,114,182,0.25)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎁</span>
                <p className="text-sm font-bold text-white">{ko ? '상품' : 'Item'}</p>
                <span className="text-[10px] ml-auto" style={{ color: '#f9a8d4' }}>
                  {ko ? '비워두면 상품 없음' : 'Leave blank if no item'}
                </span>
              </div>
              <input value={spForm.item_description}
                onChange={e => setSpForm(f => ({ ...f, item_description: e.target.value }))}
                placeholder={ko ? '상품명 (예: 상품권, 골프공, 와인)' : 'Item (e.g. gift card, golf balls)'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm" />
              <input type="number" inputMode="numeric" value={spForm.estimated_value}
                onChange={e => setSpForm(f => ({ ...f, estimated_value: e.target.value }))}
                placeholder={ko ? `상당 가치 (${sym}, 선택)` : `Estimated value (${sym}, optional)`}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm" />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '찬조 날짜' : 'Date'}</label>
              <input type="date" value={spForm.sponsor_date}
                onChange={e => setSpForm(f => ({ ...f, sponsor_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '메모 (선택)' : 'Note (optional)'}</label>
              <input value={spForm.note}
                onChange={e => setSpForm(f => ({ ...f, note: e.target.value }))}
                placeholder={ko ? '특이사항' : 'Notes'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowSpModal(false); setEditingSpId(null) }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={saveSponsorship} disabled={spSaving}
                className="flex-1 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}>
                {spSaving ? (ko ? '저장 중...' : 'Saving...') : (editingSpId ? (ko ? '수정 저장' : 'Update') : (ko ? '저장' : 'Save'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 영수증 라이트박스 */}
      {receiptUrl && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4" onClick={() => setReceiptUrl(null)}>
          <img src={receiptUrl} alt="receipt" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      {/* QR 라이트박스 */}
      {/* ━━ 거래 상세 팝업 — 클릭한 거래의 전체 정보 ━━━━━━━━━━━━━━━━━━━━━ */}
      {detailTxn && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setDetailTxn(null)}>
          <div className="w-full max-w-md rounded-t-2xl overflow-hidden"
            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-base font-bold text-white">
                {ko ? '거래 상세' : 'Transaction Detail'}
              </h3>
              <button onClick={() => setDetailTxn(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X size={16} />
              </button>
            </div>

            {/* 본문 (스크롤) */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
              {/* 금액 헤드라인 */}
              <div className="rounded-xl p-4"
                style={{
                  background: INCOME_TYPES.includes(detailTxn.type)
                    ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(6,13,6,0.95))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(6,13,6,0.95))',
                  border: `1px solid ${INCOME_TYPES.includes(detailTxn.type) ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                <p className="text-[11px]" style={{ color: INCOME_TYPES.includes(detailTxn.type) ? '#86efac' : '#fca5a5' }}>
                  {TYPE_LABELS[detailTxn.type]?.[ko ? 0 : 1] ?? detailTxn.type}
                  {detailTxn.expense_category && EXPENSE_CATEGORY_LABELS[detailTxn.expense_category] && (
                    <> · {EXPENSE_CATEGORY_LABELS[detailTxn.expense_category][ko ? 0 : 1]}</>
                  )}
                </p>
                <p className="text-2xl font-black mt-1"
                  style={{ color: INCOME_TYPES.includes(detailTxn.type) ? '#4ade80' : '#f87171' }}>
                  {INCOME_TYPES.includes(detailTxn.type) ? '+' : '-'}{sym}{Number(detailTxn.amount).toLocaleString()}
                </p>
              </div>

              {/* 내용 (전체 — 안 잘림) */}
              <div className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[11px] font-bold mb-1" style={{ color: '#9ca3af' }}>
                  {ko ? '내용' : 'Description'}
                </p>
                <p className="text-sm text-white whitespace-pre-wrap break-words">
                  {detailTxn.description}
                </p>
                {detailTxn.item_name && (
                  <p className="text-sm mt-1.5 font-semibold" style={{ color: '#c4b5fd' }}>
                    🎁 {detailTxn.item_name}
                  </p>
                )}
              </div>

              {/* 메타 정보 */}
              <div className="rounded-xl divide-y divide-white/5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="px-3 py-2 flex justify-between text-xs">
                  <span className="text-gray-400">{ko ? '날짜' : 'Date'}</span>
                  <span className="text-white">{detailTxn.transaction_date}</span>
                </div>
                {(detailTxn.users?.full_name || extractMemberName(detailTxn)) && (
                  <div className="px-3 py-2 flex justify-between text-xs">
                    <span className="text-gray-400">{ko ? '관련 회원' : 'Member'}</span>
                    <span className="text-white">{detailTxn.users?.full_name ?? extractMemberName(detailTxn)}</span>
                  </div>
                )}
                {detailTxn.recorder && (
                  <div className="px-3 py-2 flex justify-between text-xs">
                    <span className="text-gray-400">{ko ? '기록자' : 'Recorded by'}</span>
                    <span className="text-white">
                      {lang === 'ko' ? detailTxn.recorder.full_name : (detailTxn.recorder.full_name_en || detailTxn.recorder.full_name)}
                    </span>
                  </div>
                )}
                <div className="px-3 py-2 flex justify-between text-xs">
                  <span className="text-gray-400">{ko ? '거래 ID' : 'Transaction ID'}</span>
                  <span className="text-gray-400 font-mono text-[10px]">{detailTxn.id?.slice(0, 8)}…</span>
                </div>
              </div>

              {/* 영수증 */}
              {detailTxn.receipt_url && (
                <button onClick={() => { setReceiptUrl(detailTxn.receipt_url); setDetailTxn(null) }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd' }}>
                  <Receipt size={14} />{ko ? '영수증 보기' : 'View Receipt'}
                </button>
              )}
            </div>

            {/* 푸터 — 임원만 수정/삭제 */}
            {canManage && (
              <div className="flex gap-2 px-5 py-3 flex-shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <button onClick={() => { startEdit(detailTxn); setDetailTxn(null) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd' }}>
                  <Edit2 size={14} />{ko ? '수정' : 'Edit'}
                </button>
                <button onClick={() => { deleteTransaction(detailTxn.id); setDetailTxn(null) }} disabled={deleting === detailTxn.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>
                  <Trash2 size={14} />{ko ? '삭제' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━ 개인 회비 내역 모달 (회장·총무·감사·고문 + 본인) ━━━━━━━━━━━━━ */}
      {feeHistoryMember && typeof window !== 'undefined' && createPortal((() => {
        const m = feeHistoryMember
        const memberName = lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)
        const totalPaid = feeHistoryTxns.reduce((s, t) => s + Number(t.amount ?? 0), 0)
        const info = memberUnpaidInfo(m)
        const enteredAmt = parseInt((addPayForm.amount || '0').replace(/[^\d]/g,'')) || 0
        const fee = m.fee_type as 'annual'|'monthly'|null
        return (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => setFeeHistoryMember(null)}>
            <div className="w-full max-w-md rounded-t-2xl overflow-hidden flex flex-col"
              style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', maxHeight: '92dvh' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Wallet size={16} className="text-green-400 flex-shrink-0" />
                  <h3 className="text-base font-bold text-white truncate">
                    {memberName} {ko ? '회비 내역' : 'Fee History'}
                  </h3>
                </div>
                <button onClick={() => setFeeHistoryMember(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
                {/* 요약 카드 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <p className="text-[10px]" style={{ color: '#86efac' }}>{ko ? '올해 총 납부' : 'Paid YTD'}</p>
                    <p className="text-base font-bold text-green-400 mt-0.5">{sym}{totalPaid.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}>
                    <p className="text-[10px]" style={{ color: '#93c5fd' }}>{ko ? '회비 종류' : 'Fee Type'}</p>
                    <p className="text-sm font-bold text-blue-300 mt-0.5">
                      {fee === 'annual' ? (ko ? '년회비' : 'Annual')
                       : fee === 'monthly' ? (ko ? '월회비' : 'Monthly')
                       : (ko ? '면제' : 'Exempt')}
                      {fee === 'monthly' && clubFees.monthly > 0 && (
                        <span className="text-[10px] font-normal ml-1" style={{ color: '#94a3b8' }}>
                          {sym}{clubFees.monthly.toLocaleString()}/{ko ? '월' : 'mo'}
                        </span>
                      )}
                      {fee === 'annual' && clubFees.annual > 0 && (
                        <span className="text-[10px] font-normal ml-1" style={{ color: '#94a3b8' }}>
                          {sym}{clubFees.annual.toLocaleString()}/{ko ? '년' : 'yr'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {fee === 'monthly' && info.months.length > 0 && (
                  <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <p className="text-[11px] font-bold" style={{ color: '#fca5a5' }}>
                      ❌ {ko ? '미납' : 'Unpaid'} :
                      <span className="font-mono ml-1">{info.months.map(mm => `${mm}${ko ? '월' : ''}`).join(', ')}</span>
                      <span className="ml-1.5">({sym}{info.expected.toLocaleString()})</span>
                    </p>
                  </div>
                )}

                {/* 거래 내역 */}
                <div>
                  <p className="text-[11px] font-bold mb-1.5" style={{ color: '#9ca3af' }}>
                    {ko ? `납부 거래 (${feeHistoryTxns.length}건)` : `Transactions (${feeHistoryTxns.length})`}
                  </p>
                  {feeHistoryLoading ? (
                    <p className="text-xs text-center py-4" style={{ color: '#94a3b8' }}>{ko ? '불러오는 중…' : 'Loading…'}</p>
                  ) : feeHistoryTxns.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: '#94a3b8' }}>{ko ? '아직 납부 기록이 없습니다.' : 'No payments yet.'}</p>
                  ) : (
                    <div className="rounded-xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {feeHistoryTxns.map((t: any, i: number) => (
                        <div key={t.id}
                          className="px-3 py-2 flex items-center gap-2"
                          style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{t.description}</p>
                            <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                              {t.transaction_date}
                              {t.recorder?.full_name && <> · {ko ? '기록' : 'rec'}: {t.recorder.full_name}</>}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-green-400 flex-shrink-0">
                            +{sym}{Number(t.amount).toLocaleString()}
                          </span>
                          {canManage && (
                            <button onClick={() => deleteFeeTxn(t.id)}
                              title={ko ? '삭제' : 'Delete'}
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(239,68,68,0.10)', color: '#fca5a5' }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 납부 추가 폼 — canManage (총무) 전용 */}
                {canManage && (
                  <div className="rounded-xl p-3 space-y-2.5"
                    style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#86efac' }}>
                      <Plus size={12} />{ko ? '회비 추가 납부' : 'Add Payment'}
                    </p>
                    {(clubFees.monthly > 0 || clubFees.annual > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {clubFees.monthly > 0 && [1,2,3,6].map(n => (
                          <button key={`m${n}`} type="button"
                            onClick={() => setAddPayForm(f => ({...f, amount: String(clubFees.monthly * n)}))}
                            className="text-[10px] font-bold px-2 py-1 rounded-md active:scale-95"
                            style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.35)' }}>
                            {n}{ko ? '개월' : 'mo'}
                          </button>
                        ))}
                        {clubFees.annual > 0 && (
                          <button type="button"
                            onClick={() => setAddPayForm(f => ({...f, amount: String(clubFees.annual)}))}
                            className="text-[10px] font-bold px-2 py-1 rounded-md active:scale-95"
                            style={{ background: 'rgba(251,191,36,0.15)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.35)' }}>
                            {ko ? '년회비' : 'Annual'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px]" style={{ color: '#94a3b8' }}>{ko ? '금액' : 'Amount'} ({sym})</label>
                        <input type="text" inputMode="numeric"
                          value={addPayForm.amount ? Number((addPayForm.amount || '').replace(/[^\d]/g,'') || '0').toLocaleString() : ''}
                          onChange={e => setAddPayForm(f => ({...f, amount: e.target.value.replace(/[^\d]/g,'')}))}
                          placeholder="0"
                          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm font-bold focus:outline-none focus:border-green-500" />
                      </div>
                      <div>
                        <label className="text-[10px]" style={{ color: '#94a3b8' }}>{ko ? '날짜' : 'Date'}</label>
                        <input type="date"
                          value={addPayForm.date}
                          onChange={e => setAddPayForm(f => ({...f, date: e.target.value}))}
                          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-green-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px]" style={{ color: '#94a3b8' }}>{ko ? '메모 (선택)' : 'Note (optional)'}</label>
                      <input type="text"
                        value={addPayForm.note}
                        onChange={e => setAddPayForm(f => ({...f, note: e.target.value}))}
                        placeholder={fee === 'monthly' ? `${memberName} ${Number(addPayForm.date.slice(5,7))}월 회비 납부` : ''}
                        className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-green-500" />
                    </div>
                    {addPayError && (
                      <p className="text-[11px]" style={{ color: '#fca5a5' }}>{addPayError}</p>
                    )}
                    <button onClick={addFeePaymentForMember}
                      disabled={addPaySaving || enteredAmt <= 0}
                      className="w-full py-2 rounded-lg text-xs font-bold disabled:opacity-50 active:scale-95"
                      style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#86efac' }}>
                      {addPaySaving ? '...' : (ko ? `+ ${sym}${enteredAmt.toLocaleString()} 등록` : `+ Add ${sym}${enteredAmt.toLocaleString()}`)}
                    </button>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 flex-shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <button onClick={() => setFeeHistoryMember(null)}
                  className="w-full py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                  {ko ? '닫기' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )
      })(), document.body)}

      {/* ━━ 이중 확인 삭제 모달 — 실수 방지 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#1a0f0f', border: '1px solid rgba(239,68,68,0.5)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.45)' }}>
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">{confirmDelete.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#fca5a5' }}>
                  {ko ? '정말 삭제하시겠습니까?' : 'Are you sure?'}
                </p>
              </div>
            </div>
            <div className="px-5 pb-3">
              <div className="rounded-lg px-3 py-2.5 text-xs whitespace-pre-wrap"
                style={{ background: 'rgba(0,0,0,0.35)', color: '#fcd34d', border: '1px solid rgba(251,191,36,0.25)' }}>
                {confirmDelete.body}
              </div>
              <p className="text-[10px] mt-2" style={{ color: '#9ca3af' }}>
                ⚠️ {ko ? '이 작업은 되돌릴 수 없습니다.' : 'This cannot be undone.'}
              </p>
            </div>
            <div className="px-5 pb-5 pt-2 flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)' }}>
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={confirmDelete.onConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white active:scale-95"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', boxShadow: '0 4px 16px rgba(220,38,38,0.4)' }}>
                🗑 {ko ? '영구 삭제' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewQr && payInfo?.qr_image_url && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[200] p-6 gap-4" onClick={() => setViewQr(false)}>
          <p className="text-white font-semibold text-sm">{payInfo.bank_name ?? ''}</p>
          <div className="bg-white rounded-2xl p-4 w-full max-w-xs">
            <img src={payInfo.qr_image_url} alt="QR" className="w-full object-contain" />
          </div>
          {payInfo.bank_account && (
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-lg">{payInfo.bank_account}</span>
              <button onClick={(e) => { e.stopPropagation(); copyAccount() }}
                className="bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-green-400">
                {copied ? '✓' : ko ? '복사' : 'Copy'}
              </button>
            </div>
          )}
          {payInfo.bank_holder && <p className="text-gray-400 text-sm">{payInfo.bank_holder}</p>}
          {payInfo.memo && <p className="text-xs text-yellow-400 text-center max-w-xs">{payInfo.memo}</p>}
          <p className="text-gray-400 text-xs mt-2">{ko ? '탭하여 닫기' : 'Tap to close'}</p>
        </div>
      )}

      {/* ━━ 납부확인 모달 (canManage 전용) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {payingMember && (() => {
        // 미납 정보 (월납 회원만 사용)
        const info = memberUnpaidInfo(payingMember)
        const enteredAmt = parseInt((payingAmount || '0').replace(/[^\d]/g, '')) || 0
        // 차감 시뮬레이션 — 입금액으로 월회비를 차례로 덮을 때 어떤 달이 채워지는지
        let coveredFull: number[] = []
        let partialMonth: number | null = null
        let partialAmount = 0
        if (feeKind === 'monthly' && clubFees.monthly > 0) {
          let remaining = enteredAmt
          for (const mm of info.months) {
            if (remaining >= clubFees.monthly) {
              coveredFull.push(mm)
              remaining -= clubFees.monthly
            } else if (remaining > 0) {
              partialMonth = mm
              partialAmount = remaining
              remaining = 0
              break
            } else break
          }
        }
        return (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setPayingMember(null)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4 max-h-[92dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <h3 className="text-base font-bold text-white flex-1">
                {lang === 'ko'
                  ? `${payingMember.users?.full_name} 회비 납부 확인`
                  : `Confirm Fee: ${payingMember.users?.full_name_en || payingMember.users?.full_name}`}
              </h3>
              <button onClick={() => setPayingMember(null)} className="text-gray-400"><X size={18} /></button>
            </div>

            {/* 납부 방식 토글 — 년납 / 월납 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '납부 방식' : 'Fee Kind'}</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => {
                    setFeeKind('annual')
                    if (clubFees.annual > 0) setPayingAmount(String(clubFees.annual))
                  }}
                  className="py-3 rounded-xl text-sm font-bold transition"
                  style={{
                    background: feeKind === 'annual' ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${feeKind === 'annual' ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: feeKind === 'annual' ? '#86efac' : '#9ca3af',
                  }}>
                  {ko ? '년납' : 'Annual'}
                  {clubFees.annual > 0 && (
                    <div className="text-[10px] font-normal mt-0.5 opacity-80">{sym}{clubFees.annual.toLocaleString()}</div>
                  )}
                </button>
                <button type="button"
                  onClick={() => {
                    setFeeKind('monthly')
                    // 기본: 미납 월 × 월회비
                    const defaultAmt = (memberUnpaidInfo(payingMember).expected) || clubFees.monthly || 0
                    setPayingAmount(defaultAmt ? String(defaultAmt) : '')
                  }}
                  className="py-3 rounded-xl text-sm font-bold transition"
                  style={{
                    background: feeKind === 'monthly' ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${feeKind === 'monthly' ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: feeKind === 'monthly' ? '#93c5fd' : '#9ca3af',
                  }}>
                  {ko ? '월납' : 'Monthly'}
                  {clubFees.monthly > 0 && (
                    <div className="text-[10px] font-normal mt-0.5 opacity-80">{sym}{clubFees.monthly.toLocaleString()} / {ko ? '월' : 'mo'}</div>
                  )}
                </button>
              </div>
            </div>

            {/* 월납 — 미납 월 안내 */}
            {feeKind === 'monthly' && (
              <div className="rounded-xl p-3"
                style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <p className="text-[11px]" style={{ color: '#93c5fd' }}>
                  {ko ? '미납 월' : 'Unpaid months'} ({info.months.length}{ko ? '개월' : ' months'})
                </p>
                {info.months.length > 0 ? (
                  <p className="text-sm font-semibold mt-1 text-white">
                    {info.months.map(mm => `${mm}${ko ? '월' : ''}`).join(', ')}
                  </p>
                ) : (
                  <p className="text-sm font-semibold mt-1 text-green-400">
                    {ko ? '미납 월 없음 — 완납' : 'All caught up'}
                  </p>
                )}
                <p className="text-[10px] mt-1.5" style={{ color: '#9ca3af' }}>
                  {ko ? '예상 미납 금액' : 'Expected'} : {sym}{info.expected.toLocaleString()}
                </p>
                {cutoffM < currentMonth && (
                  <p className="text-[10px] mt-1" style={{ color: '#fbbf24' }}>
                    {ko
                      ? `※ ${currentMonth}월 월례회 전이므로 ${currentMonth}월 회비는 아직 미납으로 카운트되지 않습니다.`
                      : `※ ${currentMonth} fee not counted yet — monthly meeting hasn't happened.`}
                  </p>
                )}
              </div>
            )}

            {/* 금액 입력 */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? `납부 금액 (${sym})` : `Amount (${sym})`}</label>
              <input
                type="text"
                inputMode="numeric"
                value={payingAmount ? Number((payingAmount || '').replace(/[^\d]/g, '') || '0').toLocaleString() : ''}
                onChange={e => setPayingAmount(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="0"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-green-500"
              />

              {/* 월납 — 차감 미리보기 */}
              {feeKind === 'monthly' && clubFees.monthly > 0 && enteredAmt > 0 && (
                <div className="mt-2.5 rounded-xl p-3 space-y-1.5"
                  style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  {coveredFull.length > 0 && (
                    <p className="text-xs" style={{ color: '#86efac' }}>
                      ✅ {ko ? '완납 처리' : 'Fully paid'} :{' '}
                      <span className="font-bold">
                        {coveredFull.map(mm => `${mm}${ko ? '월' : ''}`).join(', ')}
                      </span>
                      {' '}({sym}{(coveredFull.length * clubFees.monthly).toLocaleString()})
                    </p>
                  )}
                  {partialMonth && (
                    <p className="text-xs" style={{ color: '#fbbf24' }}>
                      ⚠️ {partialMonth}{ko ? '월 부분납부' : ' partial'} : {sym}{partialAmount.toLocaleString()} /
                      {' '}{ko ? '잔액' : 'remaining'} {sym}{(clubFees.monthly - partialAmount).toLocaleString()}
                    </p>
                  )}
                  {coveredFull.length === 0 && !partialMonth && (
                    <p className="text-xs" style={{ color: '#fca5a5' }}>
                      ❌ {ko ? '월회비 미만 — 저장 불가' : 'Less than monthly fee'}
                    </p>
                  )}
                  {coveredFull.length === info.months.length && coveredFull.length > 0 && !partialMonth && enteredAmt === info.expected && (
                    <p className="text-xs font-bold" style={{ color: '#4ade80' }}>
                      🎉 {ko ? '전체 미납 정리 완료' : 'All unpaid months cleared'}
                    </p>
                  )}
                </div>
              )}

              {/* 년납 — 클럽 회비 안내 */}
              {feeKind === 'annual' && clubFees.annual > 0 && (
                <p className="text-[11px] mt-2" style={{ color: '#9ca3af' }}>
                  {ko ? '클럽 년회비' : 'Club annual fee'} : {sym}{clubFees.annual.toLocaleString()}
                </p>
              )}
            </div>

            {/* 납부 날짜 (년납 또는 잔액 처리용) */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                {feeKind === 'monthly'
                  ? (ko ? '날짜 (참고용 — 월별 자동 분배됨)' : 'Date (auto-distributed)')
                  : (ko ? '납부 날짜' : 'Payment Date')}
              </label>
              <input
                type="date"
                value={payingDate}
                onChange={e => setPayingDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setPayingMember(null)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
                {ko ? '취소' : 'Cancel'}
              </button>
              <button
                onClick={confirmPayment}
                disabled={
                  payingSaving ||
                  !payingAmount ||
                  (feeKind === 'monthly' && clubFees.monthly > 0 && enteredAmt < clubFees.monthly)
                }
                className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold text-sm transition"
              >
                {payingSaving ? '...' : (ko ? '납부 확인' : 'Confirm Payment')}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ━━ 벌금 규정 편집 모달 (canManage 전용) ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showFineEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setShowFineEdit(false)}>
          <div className="bg-gray-900 rounded-t-3xl px-6 pt-6 modal-sheet-pb w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
              <h3 className="text-base font-bold text-white flex-1">{ko ? '벌금 규정 편집' : 'Edit Fine Rules'}</h3>
              <button onClick={() => setShowFineEdit(false)} className="text-gray-400"><X size={18} /></button>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                {ko ? `타당 벌금 금액 (${sym})` : `Fine per stroke (${sym})`}
              </label>
              <input
                type="number"
                value={fineForm.perStroke}
                onChange={e => setFineForm(f => ({ ...f, perStroke: e.target.value }))}
                placeholder="0"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                {ko ? `최대 벌금 한도 (${sym})` : `Maximum fine cap (${sym})`}
              </label>
              <input
                type="number"
                value={fineForm.max}
                onChange={e => setFineForm(f => ({ ...f, max: e.target.value }))}
                placeholder={ko ? '한도 없음' : 'No limit'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1.5">
                {ko ? '기타 벌금 규정 (텍스트)' : 'Other fine rules (text)'}
              </label>
              <textarea
                rows={4}
                value={fineForm.notes}
                onChange={e => setFineForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={ko ? '예: OB 1회당 ₩10,000, 지각 ₩5,000 ...' : 'e.g. OB penalty ₩10,000 each, late ₩5,000 ...'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowFineEdit(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
                {ko ? '취소' : 'Cancel'}
              </button>
              <button onClick={saveFineRules} disabled={fineSaving}
                className="flex-1 py-3 rounded-xl bg-yellow-700 disabled:opacity-50 text-white font-semibold text-sm">
                {fineSaving ? '...' : (ko ? '저장' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
