import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id,full_name,email').eq('full_name','임현재').single()
const {data:mem}=await a.from('club_memberships').select('role,status,fee_type,joined_at').eq('club_id',c.id).eq('user_id',u.id).single()
console.log('임현재 user:', u)
console.log('임현재 멤버십:', mem)

// 회비 트랜잭션 확인
const {data:tx}=await a.from('finance_transactions').select('*').eq('club_id',c.id).eq('member_id',u.id)
console.log('임현재 거래:', tx?.length ?? 0, '건')

// 잔액 재검증
const {data:club}=await a.from('clubs').select('carryover_amount').eq('id',c.id).single()
const {data:all}=await a.from('finance_transactions').select('type,amount').eq('club_id',c.id)
let inc=0, exp=0
all.forEach(t=>{ if(['fee','donation','fine','other'].includes(t.type)) inc+=t.amount; else if(t.type==='expense') exp+=t.amount })
const bal = (club.carryover_amount??0) + inc - exp
console.log(`\n잔액: ${bal.toLocaleString()}  (예상 105,710,000 ${bal===105_710_000?'✅':'❌'})`)

// 정회원 카운트 변화 확인
const {count}=await a.from('club_memberships').select('*',{count:'exact',head:true}).eq('club_id',c.id).eq('status','approved').neq('role','guest')
const {count:guestCnt}=await a.from('club_memberships').select('*',{count:'exact',head:true}).eq('club_id',c.id).eq('status','approved').eq('role','guest')
console.log(`정회원: ${count}명, 게스트: ${guestCnt}명`)
