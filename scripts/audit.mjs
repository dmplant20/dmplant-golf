import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const NAMES=['임현재','이규식','정동수','최규삼','신종섭','이태화']
for(const n of NAMES){
  const {data:u}=await a.from('users').select('id').eq('full_name',n).maybeSingle()
  if(!u){ console.log(`${n}: ❌ user 없음`); continue }
  const {data:mem}=await a.from('club_memberships').select('status,fee_type,joined_at').eq('club_id',c.id).eq('user_id',u.id).maybeSingle()
  const {data:tx}=await a.from('finance_transactions').select('transaction_date,amount').eq('club_id',c.id).eq('member_id',u.id).eq('type','fee').order('transaction_date')
  console.log(`\n${n} (${u.id.slice(0,8)})`)
  console.log(`  mem: status=${mem?.status} fee_type=${mem?.fee_type} joined=${mem?.joined_at}`)
  ;(tx??[]).forEach(r=>console.log(`  tx : ${r.transaction_date}  ${r.amount.toLocaleString()}`))
}
