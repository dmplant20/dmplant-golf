import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,carryover_amount,carryover_note').eq('name','MGF').single()
console.log('이월금:', (c.carryover_amount??0).toLocaleString(), c.carryover_note??'')

const {data:tx}=await a.from('finance_transactions')
  .select('type,amount,description,transaction_date,member_id,users:member_id(full_name)')
  .eq('club_id',c.id).order('transaction_date')

let income=0, expense=0
const byType={}
const byMember={}
;(tx??[]).forEach(t=>{
  if(['fee','donation','fine','other'].includes(t.type)){ income+=t.amount }
  else if(t.type==='expense'){ expense+=t.amount }
  byType[t.type]=(byType[t.type]??0)+t.amount
  if(t.type==='fee'){
    const n=t.users?.full_name ?? '(member 없음)'
    byMember[n]=(byMember[n]??0)+t.amount
  }
})

console.log('\n전체 트랜잭션 합계:')
for(const [k,v] of Object.entries(byType)) console.log(`  ${k}: ${v.toLocaleString()}`)
console.log(`\n수입 합계: ${income.toLocaleString()}`)
console.log(`지출 합계: ${expense.toLocaleString()}`)
console.log(`이월금   : ${(c.carryover_amount??0).toLocaleString()}`)
console.log(`잔액     : ${((c.carryover_amount??0)+income-expense).toLocaleString()}`)

console.log('\n회원별 회비 납부:')
for(const [n,v] of Object.entries(byMember).sort((a,b)=>b[1]-a[1])){
  console.log(`  ${n.padEnd(8)} ${v.toLocaleString()}`)
}

console.log('\n전체 회비 트랜잭션 상세:')
for(const t of (tx??[]).filter(x=>x.type==='fee')){
  const n=t.users?.full_name ?? '(NULL member_id)'
  console.log(`  ${t.transaction_date}  ${String(t.amount).padStart(11)}  ${n.padEnd(8)}  ${t.description}`)
}

// sponsorships도 확인
const {data:sps}=await a.from('sponsorships').select('member_name,amount,sponsor_date,type,note').eq('club_id',c.id).order('sponsor_date')
console.log('\n찬조 내역 (sponsorships 테이블):')
;(sps??[]).forEach(s=>console.log(`  ${s.sponsor_date}  ${s.type}  ${(s.amount??0).toLocaleString()}  ${s.member_name}  ${s.note??''}`))
