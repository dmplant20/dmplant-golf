'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Plus, Camera, TrendingUp, TrendingDown, Wallet,
  ChevronDown, ChevronUp, Receipt, Copy, Check,
  Edit2, Upload, Building2, X, QrCode, Gift, AlertTriangle,
} from 'lucide-react'
import { OFFICER_ROLES } from '../members/page'

const TYPE_LABELS: Record<string, [string, string]> = {
  fee:      ['회비', 'Fee'],
  expense:  ['지출', 'Expense'],
  fine:     ['벌금', 'Fine'],
  donation: ['찬조', 'Donation'],
  other:    ['기타', 'Other'],
}
const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp' }
const INCOME_TYPES = ['fee', 'donation', 'fine', 'other']

export default function FinancePage() {
  const { currentClubId, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)
  const isOfficer = OFFICER_ROLES.includes(myRole)

  const [txns,         setTxns]         = useState<any[]>([])
  const [sponsorships, setSponsorships] = useState<any[]>([])
  const [fineRules,    setFineRules]    = useState<any>(null)
  const [currency,     setCurrency]     = useState('KRW')
  const [showAdd,      setShowAdd]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
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
  const [showFeeStatus,   setShowFeeStatus]    = useState(false)
  const [clubFees,        setClubFees]         = useState<{annual: number; monthly: number}>({ annual: 0, monthly: 0 })

  // ── 납부확인 모달 ──────────────────────────────────────────────────────
  const [payingMember,    setPayingMember]     = useState<any>(null)  // null = closed
  const [payingAmount,    setPayingAmount]     = useState('')
  const [payingDate,      setPayingDate]       = useState(new Date().toISOString().split('T')[0])
  const [payingSaving,    setPayingSaving]     = useState(false)

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
  })

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

  // ── load ──────────────────────────────────────────────────────────────
  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const query = isOfficer
      ? supabase.from('finance_transactions').select('*, users!member_id(full_name, full_name_en), recorder:users!recorded_by(full_name, full_name_en)')
      : supabase.from('finance_transactions').select('*, users!member_id(full_name, full_name_en)')
    const [{ data: transactions }, { data: club }, { data: mems }, { data: pi }, { data: sponsors }] = await Promise.all([
      query.eq('club_id', currentClubId).order('transaction_date', { ascending: false }),
      supabase.from('clubs').select('currency,fine_handicap_per_stroke,fine_handicap_max,fine_notes,annual_fee,monthly_fee').eq('id', currentClubId).single(),
      supabase.from('club_memberships').select('user_id, users(full_name, full_name_en)').eq('club_id', currentClubId).eq('status', 'approved'),
      supabase.from('club_payment_info').select('*').eq('club_id', currentClubId).maybeSingle(),
      supabase.from('sponsorships').select('*').eq('club_id', currentClubId).order('sponsor_date', { ascending: false }),
    ])
    setTxns(transactions ?? [])
    setSponsorships(sponsors ?? [])
    if (club?.currency) setCurrency(club.currency)
    if (club?.fine_handicap_per_stroke || club?.fine_notes) setFineRules(club)
    else setFineRules(null)
    setClubFees({ annual: club?.annual_fee ?? 0, monthly: club?.monthly_fee ?? 0 })
    setMembers(mems ?? [])
    setPayInfo(pi ?? null)
    if (pi) setPayForm({ bankName: pi.bank_name ?? '', bankAccount: pi.bank_account ?? '', bankHolder: pi.bank_holder ?? '', memo: pi.memo ?? '' })
    setLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  const sym = CURRENCY_SYMBOL[currency] ?? '₩'
  const income  = txns.filter((t) => INCOME_TYPES.includes(t.type)).reduce((s, t) => s + t.amount, 0)
  const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  const byType = Object.keys(TYPE_LABELS).reduce((acc, type) => {
    acc[type] = txns.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
    return acc
  }, {} as Record<string, number>)

  // ── fee payment status (computed) ─────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const feeTxnsThisYear = txns.filter(
    (t) => t.type === 'fee' && t.transaction_date?.startsWith(String(currentYear))
  )
  const paidMemberIds = new Set(feeTxnsThisYear.filter((t) => t.member_id).map((t) => t.member_id))
  const paidMembers = canManage
    ? members.filter((m) => paidMemberIds.has(m.user_id)).map((m) => {
        const txn = feeTxnsThisYear.find((t) => t.member_id === m.user_id)
        return { ...m, amount: txn?.amount, date: txn?.transaction_date }
      })
    : []
  const unpaidMembers = canManage
    ? members.filter((m) => !paidMemberIds.has(m.user_id))
    : []
  const paidCount   = canManage ? paidMembers.length   : 0
  const unpaidCount = canManage ? unpaidMembers.length : 0

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

    await supabase.from('finance_transactions').insert({
      club_id: currentClubId, type: form.type, amount: parseInt(form.amount),
      currency, description: desc, transaction_date: form.date,
      recorded_by: user!.id, member_id: memberId,
    })
    setShowAdd(false)
    setForm({ type: 'fee', amount: '', description: '', date: new Date().toISOString().split('T')[0], memberId: '', memberNameText: '' })
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
      const base64 = (reader.result as string).split(',')[1]
      const res = await fetch('/api/ocr/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, currency, lang }) })
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
    setPayingSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const memberName = lang === 'ko'
      ? payingMember.users?.full_name
      : (payingMember.users?.full_name_en || payingMember.users?.full_name)
    await supabase.from('finance_transactions').insert({
      club_id:          currentClubId,
      type:             'fee',
      amount:           parseInt(payingAmount),
      currency,
      description:      ko ? `${memberName} 회비 납부` : `${memberName} fee payment`,
      transaction_date: payingDate,
      recorded_by:      user!.id,
      member_id:        payingMember.user_id,
    })
    setPayingSaving(false)
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

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-5 space-y-4">

      {/* 잔액 요약 */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">{ko ? '총 잔액' : 'Balance'}</span>
          <Wallet size={18} className="text-green-400" />
        </div>
        <p className="text-2xl font-bold text-white">{sym}{balance.toLocaleString()}</p>
        <div className="flex gap-4">
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

      {/* ━━ 회비 납부 현황 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          className="w-full px-4 py-3.5 flex items-center gap-3"
          onClick={() => setShowFeeStatus(v => !v)}
        >
          <span className="text-sm font-semibold text-white flex-1 text-left">
            {ko ? `회비 납부 현황 (${currentYear}년)` : `Fee Status (${currentYear})`}
          </span>
          <span className="text-xs mr-1" style={{ color: '#5a7a5a' }}>
            {ko
              ? `납부 ${paidCount}명 / 미납 ${unpaidCount}명`
              : `Paid ${paidCount} / Unpaid ${unpaidCount}`}
          </span>
          {showFeeStatus ? <ChevronUp size={14} style={{ color: '#5a7a5a' }} /> : <ChevronDown size={14} style={{ color: '#5a7a5a' }} />}
        </button>
        {showFeeStatus && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(34,197,94,0.1)' }}>
            {canManage ? (
              <>
                {/* 납부 완료 */}
                {paidMembers.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#4ade80' }}>
                      ✅ {ko ? `납부 완료 (${paidMembers.length}명)` : `Paid (${paidMembers.length})`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {paidMembers.map((m: any) => (
                        <span key={m.user_id}
                          className="inline-flex flex-col items-start px-2.5 py-1.5 rounded-xl text-xs font-medium"
                          style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                          <span>{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</span>
                          {m.amount ? (
                            <span className="text-[10px] mt-0.5" style={{ color: '#86efac' }}>
                              {sym}{Number(m.amount).toLocaleString()}{m.date ? ` · ${m.date.slice(5)}` : ''}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* 미납 — 납부확인 버튼 포함 */}
                {unpaidMembers.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#f87171' }}>
                      ❌ {ko ? `미납 (${unpaidMembers.length}명)` : `Unpaid (${unpaidMembers.length})`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unpaidMembers.map((m: any) => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => {
                            setPayingMember(m)
                            const defaultAmt = clubFees.annual || clubFees.monthly || 0
                            setPayingAmount(defaultAmt ? String(defaultAmt) : '')
                            setPayingDate(new Date().toISOString().split('T')[0])
                          }}
                          className="inline-flex flex-col items-start px-2.5 py-1.5 rounded-xl text-xs font-medium transition hover:opacity-80 active:scale-95"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                        >
                          <span>{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</span>
                          <span className="text-[10px] mt-0.5" style={{ color: '#fca5a5' }}>
                            {ko ? '탭하여 납부확인' : 'Tap to confirm'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {paidMembers.length === 0 && unpaidMembers.length === 0 && (
                  <p className="text-xs text-gray-600 mt-3 text-center">{ko ? '회원 데이터가 없습니다' : 'No member data'}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-600 mt-3 text-center">
                {ko ? `납부 0명 / 미납 0명` : `Paid 0 / Unpaid 0`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 송금 정보 카드 ── */}
      {(payInfo || canManage) && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-400" />
              <p className="text-sm font-semibold text-white">{ko ? '회비 납부 계좌' : 'Payment Account'}</p>
            </div>
            {canManage && (
              <button onClick={() => setShowPayEdit(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-400 transition border border-gray-700 hover:border-green-700 rounded-full px-2.5 py-1">
                <Edit2 size={11} />{ko ? '편집' : 'Edit'}
              </button>
            )}
          </div>

          {payInfo ? (
            <div className="flex gap-3">
              {/* 텍스트 정보 */}
              <div className="flex-1 space-y-2">
                {payInfo.bank_name && (
                  <div>
                    <p className="text-xs text-gray-500">{ko ? '은행/앱' : 'Bank'}</p>
                    <p className="text-sm font-semibold text-white">{payInfo.bank_name}</p>
                  </div>
                )}
                {payInfo.bank_account && (
                  <div>
                    <p className="text-xs text-gray-500">{ko ? '계좌번호' : 'Account No.'}</p>
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
                    <p className="text-xs text-gray-500">{ko ? '예금주' : 'Holder'}</p>
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
              <QrCode size={28} className="text-gray-600" />
              <p className="text-xs text-gray-500">
                {ko ? '총무가 계좌 정보를 등록하면 여기에 표시됩니다.' : 'Secretary can register payment info here.'}
              </p>
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

      {/* 거래 내역 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">{ko ? '거래 내역' : 'Transactions'}</h3>
        {loading ? (
          <p className="text-center text-gray-600 py-6">{ko ? '로딩 중...' : 'Loading...'}</p>
        ) : txns.length === 0 ? (
          <p className="text-center text-gray-600 py-6">{ko ? '내역이 없습니다' : 'No transactions'}</p>
        ) : (
          txns.map((t) => {
            const isIncome  = INCOME_TYPES.includes(t.type)
            const isExpanded = expandedId === t.id
            const freeTextName = extractMemberName(t)
            return (
              <div key={t.id} className="glass-card rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${isIncome ? 'bg-green-900/60' : 'bg-red-900/60'}`}>
                    {isIncome ? '↑' : '↓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{TYPE_LABELS[t.type]?.[ko ? 0 : 1]}</span>
                      {t.users?.full_name && (
                        <span className="text-xs text-gray-500">· {lang === 'ko' ? t.users.full_name : (t.users.full_name_en || t.users.full_name)}</span>
                      )}
                      {!t.users?.full_name && freeTextName && (
                        <span className="text-xs text-gray-500">· {freeTextName}</span>
                      )}
                      <span className="text-xs text-gray-600">· {t.transaction_date}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                    {isIncome ? '+' : '-'}{sym}{t.amount.toLocaleString()}
                  </span>
                  {isOfficer && (
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="text-gray-600 hover:text-gray-400 flex-shrink-0 ml-1">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>

                {isOfficer && isExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-800/60 pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{ko ? '기록자' : 'Recorded by'}</span>
                      <span className="text-gray-300">
                        {t.recorder ? (lang === 'ko' ? t.recorder.full_name : (t.recorder.full_name_en || t.recorder.full_name)) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{ko ? '거래 ID' : 'Transaction ID'}</span>
                      <span className="text-gray-600 font-mono">{t.id.slice(0, 8)}…</span>
                    </div>
                    {t.receipt_url && (
                      <button onClick={() => setReceiptUrl(t.receipt_url)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mt-1">
                        <Receipt size={12} /> {ko ? '영수증 보기' : 'View Receipt'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── 내역 추가 모달 ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">{ko ? '내역 추가' : 'Add Transaction'}</h3>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '유형' : 'Type'}</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                {Object.entries(TYPE_LABELS).map(([v, [k, e]]) => <option key={v} value={v}>{ko ? k : e}</option>)}
              </select>
            </div>

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
              <button onClick={() => { setShowAdd(false); setMemberInputTab('select') }} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={addTransaction} className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">{ko ? '저장' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 송금 정보 편집 모달 (총무·회장 전용) ── */}
      {showPayEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setShowPayEdit(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-5 w-full space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={18} className="text-blue-400" />
              <h3 className="text-base font-bold text-white flex-1">{ko ? '납부 계좌 등록' : 'Register Payment Info'}</h3>
              <button onClick={() => setShowPayEdit(false)} className="text-gray-500"><X size={18} /></button>
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
                  className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-700 hover:border-green-700 rounded-xl transition text-gray-500 hover:text-green-400"
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
          <button className="w-full px-4 py-3.5 flex items-center gap-3"
            onClick={() => setShowFineRules(v => !v)}>
            <AlertTriangle size={16} style={{ color: '#fbbf24' }} className="flex-shrink-0" />
            <span className="text-sm font-semibold text-white flex-1 text-left">
              {ko ? '🏌️ 벌금 규정' : '🏌️ Fine Rules'}
            </span>
            {fineRules?.fine_handicap_per_stroke && (
              <span className="text-xs mr-1" style={{ color: '#5a7a5a' }}>
                {sym}{Number(fineRules.fine_handicap_per_stroke).toLocaleString()}{ko ? '/타' : '/stroke'}
              </span>
            )}
            {canManage && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowFineEdit(true) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-400 transition border border-gray-700 hover:border-yellow-700 rounded-full px-2 py-0.5 mr-1"
                title={ko ? '벌금 규정 편집' : 'Edit fine rules'}
              >
                <Edit2 size={11} />
              </button>
            )}
            {showFineRules ? <ChevronUp size={14} style={{ color: '#5a7a5a' }} /> : <ChevronDown size={14} style={{ color: '#5a7a5a' }} />}
          </button>
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
                        <span style={{ color: '#5a7a5a' }}> · </span>
                        <span style={{ color: '#fde68a' }}>{ko ? '최고' : 'max'} </span>
                        {sym}{Number(fineRules.fine_handicap_max).toLocaleString()}
                      </>
                    )}
                  </p>
                </div>
              ) : canManage && (
                <p className="text-xs text-center mt-3" style={{ color: '#5a7a5a' }}>
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

      {/* ━━ 찬조 내역 (전 회원 열람) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(sponsorships.length > 0 || canManage) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift size={14} style={{ color: '#a78bfa' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#a3b8a3' }}>{ko ? '찬조 내역' : 'Sponsorships'}</h3>
            </div>
            {canManage && (
              <span className="text-xs" style={{ color: '#5a7a5a' }}>
                {ko ? '(클럽 설정에서 등록)' : '(Register in Settings)'}
              </span>
            )}
          </div>
          {sponsorships.length === 0 ? (
            <div className="glass-card rounded-xl py-6 text-center">
              <p className="text-sm" style={{ color: '#3a5a3a' }}>{ko ? '찬조 내역이 없습니다' : 'No sponsorships'}</p>
            </div>
          ) : sponsorships.map(s => {
            const cSym = { KRW: '₩', VND: '₫', IDR: 'Rp' }[s.currency as string] ?? sym
            const isItem = s.type === 'item'
            const valueStr = isItem
              ? `${s.item_description ?? ''}${s.estimated_value ? ` (${cSym}${Number(s.estimated_value).toLocaleString()} ${ko ? '상당' : 'est.'})` : ''}`
              : `${cSym}${Number(s.amount).toLocaleString()}`
            return (
              <div key={s.id} className="rounded-xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(6,13,6,0.95))', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{isItem ? '🎁' : '💰'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{s.member_name} {ko ? '회원' : ''}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#c4b5fd' }}>{valueStr}</p>
                    {s.note && <p className="text-xs italic mt-0.5" style={{ color: '#7a6a9a' }}>{s.note}</p>}
                  </div>
                  <p className="text-xs flex-shrink-0" style={{ color: '#5a4a7a' }}>{s.sponsor_date}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 영수증 라이트박스 */}
      {receiptUrl && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4" onClick={() => setReceiptUrl(null)}>
          <img src={receiptUrl} alt="receipt" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      {/* QR 라이트박스 */}
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
          <p className="text-gray-600 text-xs mt-2">{ko ? '탭하여 닫기' : 'Tap to close'}</p>
        </div>
      )}

      {/* ━━ 납부확인 모달 (canManage 전용) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {payingMember && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setPayingMember(null)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <h3 className="text-base font-bold text-white flex-1">
                {lang === 'ko'
                  ? `${payingMember.users?.full_name} 회비 납부 확인`
                  : `Confirm Fee: ${payingMember.users?.full_name_en || payingMember.users?.full_name}`}
              </h3>
              <button onClick={() => setPayingMember(null)} className="text-gray-500"><X size={18} /></button>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? `납부 금액 (${sym})` : `Amount (${sym})`}</label>
              <input
                type="number"
                value={payingAmount}
                onChange={e => setPayingAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-green-500"
              />
              {(clubFees.annual > 0 || clubFees.monthly > 0) && (
                <div className="flex gap-2 mt-2">
                  {clubFees.annual > 0 && (
                    <button type="button" onClick={() => setPayingAmount(String(clubFees.annual))}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-900/40 text-green-400 border border-green-800/50 hover:bg-green-900/60 transition">
                      {ko ? '년회비' : 'Annual'} {sym}{clubFees.annual.toLocaleString()}
                    </button>
                  )}
                  {clubFees.monthly > 0 && (
                    <button type="button" onClick={() => setPayingAmount(String(clubFees.monthly))}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60 transition">
                      {ko ? '월회비' : 'Monthly'} {sym}{clubFees.monthly.toLocaleString()}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">{ko ? '납부 날짜' : 'Payment Date'}</label>
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
                disabled={payingSaving || !payingAmount}
                className="flex-1 py-3 rounded-xl bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold text-sm transition"
              >
                {payingSaving ? '...' : (ko ? '납부 확인' : 'Confirm Payment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━ 벌금 규정 편집 모달 (canManage 전용) ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showFineEdit && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-[200]" onClick={() => setShowFineEdit(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-gray-700 rounded-full" /></div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
              <h3 className="text-base font-bold text-white flex-1">{ko ? '벌금 규정 편집' : 'Edit Fine Rules'}</h3>
              <button onClick={() => setShowFineEdit(false)} className="text-gray-500"><X size={18} /></button>
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
