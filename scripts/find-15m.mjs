import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,carryover_amount').eq('name','MGF').single()
const {data:tx}=await a.from('finance_transactions')
  .select('transaction_date,amount,type,description,users:member_id(full_name)')
  .eq('club_id',c.id).order('transaction_date',{ascending:true}).order('created_at',{ascending:true})

let income=0, expense=0
const byMember={}
console.log('=== 전체 거래 (시간순) ===\n')
tx.forEach(t=>{
  const n=t.users?.full_name ?? '(NULL)'
  if(['fee','donation','fine','other'].includes(t.type)) income+=t.amount
  else if(t.type==='expense') expense+=t.amount
  if(t.type==='fee'){
    byMember[n]=(byMember[n]??0)+t.amount
  }
  console.log(`  ${t.transaction_date}  ${t.type.padEnd(8)}  ${String(t.amount).padStart(10)}  ${n.padEnd(8)}  ${t.description?.slice(0,40)}`)
})

console.log('\n=== 회원별 회비 납부 합 ===')
for(const [n,v] of Object.entries(byMember).sort((a,b)=>b[1]-a[1])){
  console.log(`  ${n.padEnd(8)} ${v.toLocaleString()}`)
}
console.log(`\n수입: ${income.toLocaleString()}`)
console.log(`지출: ${expense.toLocaleString()}`)
console.log(`이월: ${(c.carryover_amount??0).toLocaleString()}`)
console.log(`잔액: ${((c.carryover_amount??0)+income-expense).toLocaleString()}`)
