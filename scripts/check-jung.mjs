import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const {data:c}=await a.from('clubs').select('id,monthly_fee,annual_fee,currency').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id,full_name').in('full_name',['정동수','이상철','이태화'])
console.log('MGF:',c)
for(const x of u){
  const {data:t}=await a.from('finance_transactions').select('transaction_date,amount,description,type').eq('club_id',c.id).eq('member_id',x.id).eq('type','fee').order('transaction_date')
  console.log(`\n${x.full_name} (${x.id.slice(0,8)}):`)
  ;(t??[]).forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}  ${r.description}`))
}
