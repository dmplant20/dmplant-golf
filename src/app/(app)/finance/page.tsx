'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { Plus, Camera, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

const TYPE_LABELS: Record<string, [string, string]> = {
  fee: ['회비', 'Fee'], expense: ['지출', 'Expense'],
  fine: ['벌금', 'Fine'], donation: ['찬조', 'Donation'], other: ['기타', 'Other'],
}
const CURRENCY_SYMBOL: Record<string, string> = { KRW: '₩', VND: '₫', IDR: 'Rp' }

export default function FinancePage() {
  const { currentClubId, lang, myClubs } = useAuthStore()
  const ko = lang === 'ko'
  const myRole = myClubs.find((c) => c.id === currentClubId)?.role ?? 'member'
  const canManage = ['president', 'secretary'].includes(myRole)

  const [txns, setTxns] = useState<any[]>([])
  const [currency, setCurrency] = useState('KRW')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ type: 'fee', amount: '', description: '', date: new Date().toISOString().split('T')[0], memberId: '' })
  const [members, setMembers] = useState<any[]>([])

  async function load() {
    if (!currentClubId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: transactions }, { data: club }, { data: mems }] = await Promise.all([
      supabase.from('finance_transactions').select('*, users(full_name, full_name_en)').eq('club_id', currentClubId).order('transaction_date', { ascending: false }),
      supabase.from('clubs').select('currency').eq('id', currentClubId).single(),
      supabase.from('club_memberships').select('user_id, users(full_name, full_name_en)').eq('club_id', currentClubId).eq('status', 'approved'),
    ])
    setTxns(transactions ?? [])
    if (club?.currency) setCurrency(club.currency)
    setMembers(mems ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentClubId])

  const sym = CURRENCY_SYMBOL[currency] ?? '₩'
  const income = txns.filter((t) => ['fee', 'donation', 'fine'].includes(t.type)).reduce((s, t) => s + t.amount, 0)
  const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  async function addTransaction() {
    if (!form.amount || !form.description) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('finance_transactions').insert({
      club_id: currentClubId, type: form.type, amount: parseInt(form.amount),
      currency, description: form.description, transaction_date: form.date,
      recorded_by: user!.id, member_id: form.memberId || null,
    })
    setShowAdd(false)
    setForm({ type: 'fee', amount: '', description: '', date: new Date().toISOString().split('T')[0], memberId: '' })
    load()
  }

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

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Summary */}
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

      {/* Actions (secretary only) */}
      {canManage && (
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-medium transition">
            <Plus size={16} /> {ko ? '내역 추가' : 'Add Transaction'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={ocrLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 py-3 rounded-xl text-sm font-medium transition">
            <Camera size={16} /> {ocrLoading ? (ko ? '분석 중...' : 'Scanning...') : (ko ? '영수증 촬영' : 'Scan Receipt')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptScan} />
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">{ko ? '거래 내역' : 'Transactions'}</h3>
        {loading ? (
          <p className="text-center text-gray-600 py-6">{ko ? '로딩 중...' : 'Loading...'}</p>
        ) : txns.length === 0 ? (
          <p className="text-center text-gray-600 py-6">{ko ? '내역이 없습니다' : 'No transactions'}</p>
        ) : (
          txns.map((t) => {
            const isIncome = ['fee', 'donation', 'fine'].includes(t.type)
            return (
              <div key={t.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${isIncome ? 'bg-green-900/60' : 'bg-red-900/60'}`}>
                  {isIncome ? '↑' : '↓'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{TYPE_LABELS[t.type]?.[ko ? 0 : 1]}</span>
                    {t.users?.full_name && <span className="text-xs text-gray-500">· {lang === 'ko' ? t.users.full_name : (t.users.full_name_en || t.users.full_name)}</span>}
                    <span className="text-xs text-gray-600">· {t.transaction_date}</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                  {isIncome ? '+' : '-'}{sym}{t.amount.toLocaleString()}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 rounded-t-3xl p-6 w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">{ko ? '내역 추가' : 'Add Transaction'}</h3>
            <div>
              <label className="text-sm text-gray-400 block mb-1">{ko ? '유형' : 'Type'}</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                {Object.entries(TYPE_LABELS).map(([v, [k, e]]) => <option key={v} value={v}>{ko ? k : e}</option>)}
              </select>
            </div>
            {['fee', 'fine'].includes(form.type) && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">{ko ? '회원' : 'Member'}</label>
                <select value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
                  <option value="">{ko ? '선택 안함' : 'None'}</option>
                  {members.map((m: any) => <option key={m.user_id} value={m.user_id}>{lang === 'ko' ? m.users?.full_name : (m.users?.full_name_en || m.users?.full_name)}</option>)}
                </select>
              </div>
            )}
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
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300">{ko ? '취소' : 'Cancel'}</button>
              <button onClick={addTransaction} className="flex-1 py-3 rounded-xl bg-green-700 text-white font-semibold">{ko ? '저장' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
