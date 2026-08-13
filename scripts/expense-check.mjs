import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,annual_fee,monthly_fee').eq('name','MGF').single()
console.log('회비:', c)

const {data:mems}=await a.from('club_memberships')
  .select('fee_type,joined_at,users(full_name)')
  .eq('club_id',c.id).eq('status','approved')

console.log(`\n승인 회원 ${mems.length}명, fee_type 분포:`)
const byType={annual:0,monthly:0,null:0}
const names={annual:[],monthly:[],null:[]}
mems.forEach(m=>{
  const k = m.fee_type ?? 'null'
  byType[k]++
  names[k].push(m.users?.full_name)
})
for(const k of ['annual','monthly','null']){
  console.log(`  ${k}: ${byType[k]}명 → ${names[k].join(', ')}`)
}

console.log('\n지출 내역:')
const {data:tx}=await a.from('finance_transactions')
  .select('transaction_date,amount,description,expense_category')
  .eq('club_id',c.id).eq('type','expense').order('transaction_date')
let total=0
tx.forEach(t=>{ total+=t.amount; console.log(`  ${t.transaction_date}  ${String(t.amount).padStart(11)}  [${t.expense_category??'-'}]  ${t.description}`) })
console.log(`  합: ${total.toLocaleString()}`)
