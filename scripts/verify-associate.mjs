import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()

// 3명 상태 확인
console.log('=== 임현재·김경철·정동수 준회원 전환 결과 ===\n')
for(const name of ['임현재','김경철','정동수']){
  const {data:u}=await a.from('users').select('id').eq('full_name',name).maybeSingle()
  if(!u){ console.log(`${name}: ❌ user 없음`); continue }
  const {data:mem}=await a.from('club_memberships')
    .select('role,status,fee_type,joined_at')
    .eq('club_id',c.id).eq('user_id',u.id).maybeSingle()
  if(!mem){ console.log(`${name}: ❌ membership 없음`); continue }
  const ok = mem.role === 'associate' && mem.status === 'approved' && mem.fee_type === null
  console.log(`${name.padEnd(4)}  role=${mem.role.padEnd(10)}  status=${mem.status.padEnd(10)}  fee_type=${String(mem.fee_type).padEnd(6)}  ${ok?'✅':'❌'}`)
}

// 클럽 전체 역할 분포
const {data:all}=await a.from('club_memberships')
  .select('role,status,users(full_name)').eq('club_id',c.id)
const byRole = {}
all.forEach(m=>{
  const key = `${m.role}(${m.status})`
  byRole[key] = (byRole[key]??0)+1
})
console.log('\n=== MGF 멤버십 역할·상태 분포 ===')
for(const [k,v] of Object.entries(byRole).sort()) console.log(`  ${k.padEnd(28)} ${v}`)

// 정동수의 기존 거래 건재 확인
const {data:dsx}=await a.from('users').select('id').eq('full_name','정동수').single()
const {data:tx}=await a.from('finance_transactions')
  .select('transaction_date,amount,description').eq('member_id',dsx.id).eq('type','fee').order('transaction_date')
console.log(`\n정동수 기존 회비 납부 (보존됨): ${tx?.length ?? 0}건`)
;(tx??[]).forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}  ${r.description}`))

// 잔액 재검증
const {data:club}=await a.from('clubs').select('carryover_amount').eq('id',c.id).single()
const {data:txs}=await a.from('finance_transactions').select('type,amount').eq('club_id',c.id)
let inc=0, exp=0
txs.forEach(t=>{ if(['fee','donation','fine','other'].includes(t.type)) inc+=t.amount; else if(t.type==='expense') exp+=t.amount })
const bal = (club.carryover_amount??0)+inc-exp
console.log(`\n잔액: ${bal.toLocaleString()}  (예상 105,710,000 ${bal===105_710_000?'✅':'❌'})`)
