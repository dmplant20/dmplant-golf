import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,annual_fee,monthly_fee').eq('name','MGF').single()

// 전체 MGF 멤버
const {data:mems}=await a.from('club_memberships')
  .select('status, fee_type, joined_at, users(id,full_name)')
  .eq('club_id',c.id)
  .order('joined_at')

// 모든 회비 트랜잭션
const {data:tx}=await a.from('finance_transactions')
  .select('amount, member_id, transaction_date, description')
  .eq('club_id',c.id).eq('type','fee')

const paidByUser = new Map()
for(const t of tx){
  const k = t.member_id ?? 'NULL'
  paidByUser.set(k, (paidByUser.get(k)??0)+t.amount)
}

console.log('=== MGF 회원별 회비 납부 vs 예상 ===\n')
console.log('이름      상태       유형       가입       납부합        예상       비고')
console.log('─'.repeat(95))
let totalActual = 0
let totalExpectedAnnual = 0
let totalExpectedMonthly = 0
let underPay = []

for(const m of mems){
  const u = m.users
  const paid = paidByUser.get(u.id) ?? 0
  totalActual += paid

  let expected = 0
  let note = ''
  if(m.status !== 'approved'){
    note = `[${m.status}]`
  } else if(m.fee_type === 'annual'){
    expected = c.annual_fee
    totalExpectedAnnual += expected
    if(paid < expected) note = `❗ 년회비 미납 ${(expected-paid).toLocaleString()}`
  } else if(m.fee_type === 'monthly'){
    // 가입월부터 4월(cutoff)까지의 예상 (월례회 전이므로)
    const ja = m.joined_at?.slice(0,10) ?? ''
    const startM = ja.startsWith('2026') ? Number(ja.slice(5,7)) : 1
    const months = Math.max(0, 4 - startM + 1)
    expected = months * c.monthly_fee
    totalExpectedMonthly += expected
    if(paid < expected) note = `❗ 월회비 미납 ${(expected-paid).toLocaleString()}`
  } else {
    note = '회비 미설정'
  }

  if(paid < expected) underPay.push({name:u.full_name, gap: expected-paid})

  console.log(`${u.full_name.padEnd(8)}  ${m.status.padEnd(10)}  ${(m.fee_type??'-').padEnd(9)}  ${(m.joined_at??'').slice(0,10)}  ${String(paid).padStart(11)}  ${String(expected).padStart(11)}  ${note}`)
}

console.log('─'.repeat(95))
console.log(`\n실 납부 합계 :      ${totalActual.toLocaleString().padStart(15)}`)
console.log(`년회비 예상  :      ${totalExpectedAnnual.toLocaleString().padStart(15)}`)
console.log(`월회비 예상  :      ${totalExpectedMonthly.toLocaleString().padStart(15)}`)
console.log(`예상 총수입  :      ${(totalExpectedAnnual+totalExpectedMonthly).toLocaleString().padStart(15)}`)
console.log(`차이         :      ${(totalExpectedAnnual+totalExpectedMonthly-totalActual).toLocaleString().padStart(15)}`)

// member_id NULL 트랜잭션 확인
const nullPaid = paidByUser.get('NULL') ?? 0
if(nullPaid > 0){
  console.log(`\n⚠ member_id NULL 회비 트랜잭션 합: ${nullPaid.toLocaleString()}`)
}

// 사용자 매칭 안 된 트랜잭션 상세
const {data:nullTx}=await a.from('finance_transactions')
  .select('transaction_date,amount,description')
  .eq('club_id',c.id).eq('type','fee').is('member_id',null)
if(nullTx?.length){
  console.log('\nmember_id 없는 회비 트랜잭션:')
  nullTx.forEach(t=>console.log(`  ${t.transaction_date}  ${t.amount.toLocaleString()}  ${t.description}`))
}
