import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,currency').eq('name','MGF').single()
const {data:pres}=await a.from('users').select('id').eq('full_name','최성복').single()
const {data:u}=await a.from('users').select('id').eq('full_name','김진태').single()

// 1) fee_type → annual
await a.from('club_memberships').update({
  fee_type:'annual'
}).eq('club_id',c.id).eq('user_id',u.id)

// 2) 기존 회비 2건 삭제 → 단일 ₫5M 행으로 합침 (4월 완납 시점)
const {data:old}=await a.from('finance_transactions')
  .select('id').eq('club_id',c.id).eq('member_id',u.id).eq('type','fee')
if(old?.length){
  await a.from('finance_transactions').delete().in('id', old.map(r=>r.id))
  console.log(`  - 김진태 기존 ${old.length}건 삭제`)
}
const {error}=await a.from('finance_transactions').insert({
  club_id:c.id, type:'fee', amount:5_000_000, currency:c.currency,
  description:'김진태 회비 납부 (년납)',
  transaction_date:'2026-04-15',
  recorded_by:pres.id, member_id:u.id,
})
if(error){ console.error('insert:',error.message); process.exit(1) }
console.log('✓ 김진태: annual, ₫5,000,000 단일 거래 (2026-04-15)')

// 잔액 검증
const {data:club}=await a.from('clubs').select('carryover_amount').eq('id',c.id).single()
const {data:tx}=await a.from('finance_transactions').select('type,amount').eq('club_id',c.id)
let inc=0, exp=0
tx.forEach(t=>{ if(['fee','donation','fine','other'].includes(t.type)) inc+=t.amount; else if(t.type==='expense') exp+=t.amount })
const bal = (club.carryover_amount??0) + inc - exp
console.log(`\n잔액: ${bal.toLocaleString()}  (예상: 105,710,000  ${bal===105_710_000?'✅':'❌'})`)

// 김진태 최종 상태
const {data:mem}=await a.from('club_memberships').select('fee_type,joined_at').eq('club_id',c.id).eq('user_id',u.id).single()
console.log(`김진태 멤버십: fee_type=${mem.fee_type}, joined=${mem.joined_at}`)
